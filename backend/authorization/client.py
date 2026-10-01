import json
from dataclasses import dataclass
from urllib import error, request
from uuid import UUID

from django.conf import settings


PLANNING_RESOURCE_TYPES = {
    "contract",
    "employee_position",
    "employee_zone",
    "employee_availability",
    "employee_availability_exception",
    "employee_time_off",
    "time_balance_entry",
    "assignment",
    "staff_requirement",
    "planning",
}

INSTALLATION_RESOURCE_TYPES = {"employee", "position", "zone", "shift"}


class OpenFGAError(Exception):
    pass


@dataclass(frozen=True, slots=True)
class TupleKey:
    user: str
    relation: str
    object: str

    def as_dict(self) -> dict[str, str]:
        return {
            "user": self.user,
            "relation": self.relation,
            "object": self.object,
        }


class OpenFGAClient:
    def __init__(self):
        pass

    @property
    def config(self):
        return settings.OPENFGA

    def check(self, *, user: str, relation: str, object: str) -> bool:
        if not self.config["ENABLED"]:
            return True

        response = self._request(
            "POST",
            "/check",
            {
                "tuple_key": TupleKey(user, relation, object).as_dict(),
                "authorization_model_id": self.config["AUTHORIZATION_MODEL_ID"],
            },
        )
        return response.get("allowed") is True

    def write(self, *tuples: TupleKey) -> None:
        if not self.config["ENABLED"] or not tuples:
            return

        payload = {
            "writes": {"tuple_keys": [tuple_key.as_dict() for tuple_key in tuples]},
            "authorization_model_id": self.config["AUTHORIZATION_MODEL_ID"],
        }
        self._request("POST", "/write", payload)

    def provision_user(self, sub: str) -> None:
        # OpenFGA users are identifiers, not records that need to be created.
        # The user becomes known when an installation tuple references user:{sub}.
        return None

    def provision_company(self, *, company_id: UUID, user_sub: str, relation: str = "owner") -> None:
        self._write_if_missing(
            TupleKey(
                user=f"user:{user_sub}",
                relation=relation,
                object=f"company:{company_id}",
            )
        )

    def provision_installation(
        self,
        *,
        installation_id: UUID,
        user_sub: str,
        company_id: UUID | None = None,
        relation: str = "owner",
    ) -> None:
        installation = f"installation:{installation_id}"
        tuples = []
        if company_id:
            tuples.append(
                TupleKey(
                    user=f"company:{company_id}",
                    relation="company",
                    object=installation,
                )
            )
        tuples.append(
            TupleKey(
                user=f"user:{user_sub}",
                relation=relation,
                object=installation,
            )
        )
        for tuple_key in tuples:
            self._write_if_missing(tuple_key)

    def provision_installation_resource(
        self,
        *,
        resource_type: str,
        resource_id: UUID | str,
        installation_id: UUID | str,
        user_sub: str | None = None,
    ) -> None:
        """Create OpenFGA tuples for resources directly owned by an installation."""
        if resource_type not in INSTALLATION_RESOURCE_TYPES:
            raise ValueError(f"Unsupported OpenFGA installation resource type: {resource_type}")

        resource = f"{resource_type}:{resource_id}"
        tuples = [
            TupleKey(
                user=f"installation:{installation_id}",
                relation="installation",
                object=resource,
            )
        ]
        if resource_type == "employee" and user_sub:
            tuples.append(
                TupleKey(
                    user=f"user:{user_sub}",
                    relation="user",
                    object=resource,
                )
            )

        for tuple_key in tuples:
            self._write_if_missing(tuple_key)

    def provision_planning_resource(
        self,
        *,
        resource_type: str,
        resource_id: UUID | str,
        installation_id: UUID | str,
        employee_id: UUID | str | None = None,
        position_id: UUID | str | None = None,
        zone_id: UUID | str | None = None,
        shift_id: UUID | str | None = None,
        availability_id: UUID | str | None = None,
        created_by_sub: str | None = None,
        published_by_sub: str | None = None,
    ) -> None:
        """Create OpenFGA relationship tuples for planning-owned resources.

        The API intentionally accepts primitive ids so newly introduced domain
        entities can call it from serializers/services without coupling this
        authorization layer to model classes that may evolve independently.
        """
        if resource_type not in PLANNING_RESOURCE_TYPES:
            raise ValueError(f"Unsupported OpenFGA planning resource type: {resource_type}")

        resource = f"{resource_type}:{resource_id}"
        tuples = [
            TupleKey(
                user=f"installation:{installation_id}",
                relation="installation",
                object=resource,
            )
        ]

        related_objects = {
            "employee": ("employee", employee_id),
            "position": ("position", position_id),
            "zone": ("zone", zone_id),
            "shift": ("shift", shift_id),
            "availability": ("employee_availability", availability_id),
        }
        for relation, (object_type, object_id) in related_objects.items():
            if object_id:
                tuples.append(
                    TupleKey(
                        user=f"{object_type}:{object_id}",
                        relation=relation,
                        object=resource,
                    )
                )

        if created_by_sub:
            tuples.append(
                TupleKey(
                    user=f"user:{created_by_sub}",
                    relation="created_by",
                    object=resource,
                )
            )

        if published_by_sub:
            tuples.append(
                TupleKey(
                    user=f"user:{published_by_sub}",
                    relation="published_by",
                    object=resource,
                )
            )

        for tuple_key in tuples:
            self._write_if_missing(tuple_key)

    def _write_if_missing(self, tuple_key: TupleKey) -> None:
        try:
            if self.check(
                user=tuple_key.user,
                relation=tuple_key.relation,
                object=tuple_key.object,
            ):
                return
        except OpenFGAError as exc:
            if self._is_authorization_model_mismatch(exc):
                return
            raise

        try:
            self.write(tuple_key)
        except OpenFGAError as exc:
            # Another request may have created the tuple after the check.
            if "tuple to be written already existed" not in str(exc) and not self._is_authorization_model_mismatch(exc):
                raise

    def _is_authorization_model_mismatch(self, exc: OpenFGAError) -> bool:
        message = str(exc)
        return "validation_error" in message and (
            "type '" in message and "' not found" in message
            or "invalid relation" in message
        )

    def _request(self, method: str, path: str, payload: dict) -> dict:
        body = json.dumps(payload).encode("utf-8")
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        if self.config["API_TOKEN"]:
            headers["Authorization"] = f"Bearer {self.config['API_TOKEN']}"

        req = request.Request(
            f"{self.config['API_URL'].rstrip('/')}/stores/{self.config['STORE_ID']}{path}",
            data=body,
            method=method,
            headers=headers,
        )
        try:
            with request.urlopen(req, timeout=self.config["TIMEOUT_SECONDS"]) as response:
                raw_body = response.read().decode("utf-8")
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8")
            raise OpenFGAError(
                f"OpenFGA request failed with status {exc.code}: {detail}"
            ) from exc
        except error.URLError as exc:
            raise OpenFGAError("Could not reach OpenFGA.") from exc

        return json.loads(raw_body) if raw_body else {}
