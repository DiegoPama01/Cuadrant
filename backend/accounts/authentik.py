import json
import ssl
from dataclasses import dataclass
from typing import Any
from urllib import error, parse, request

from django.conf import settings


@dataclass(slots=True)
class AuthentikUser:
    id: int
    sub: str


class AuthentikProvisioningError(Exception):
    def __init__(self, message: str, *, status_code: int = 502):
        super().__init__(message)
        self.status_code = status_code


def create_user(*, name: str, email: str, password: str) -> AuthentikUser:
    _ensure_management_configured()

    payload = {
        "username": email,
        "name": name,
        "email": email,
        "is_active": True,
        "type": "internal",
    }
    group_ids = _get_default_group_ids()
    if group_ids:
        payload["groups"] = group_ids

    created_user = _request_json("POST", "/api/v3/core/users/", payload)
    user_id = created_user.get("pk")
    sub = created_user.get("uid")

    if not isinstance(user_id, int) or not isinstance(sub, str) or not sub:
        raise AuthentikProvisioningError("Authentik did not return a valid user id.")

    try:
        _request_json(
            "POST",
            f"/api/v3/core/users/{user_id}/set_password/",
            {"password": password},
            expected_statuses={204},
        )
    except AuthentikProvisioningError as exc:
        delete_user(user_id)
        raise AuthentikProvisioningError(
            f"User was created in Authentik but the password could not be set. Check that the service token can change users and set passwords. Original error: {exc}",
            status_code=exc.status_code,
        ) from exc

    return AuthentikUser(id=user_id, sub=sub)


def find_user_by_email(email: str) -> dict[str, Any] | None:
    """Find an Authentik user before provisioning to avoid split accounts."""
    _ensure_management_configured()
    response = _request_json(
        "GET",
        f"/api/v3/core/users/?email={parse.quote(email)}",
        None,
    )
    results = response.get("results")
    if not isinstance(results, list):
        return None

    return next(
        (item for item in results if isinstance(item, dict) and item.get("email", "").lower() == email.lower()),
        None,
    )


def exchange_code(
    *, code: str, code_verifier: str, redirect_uri: str
) -> dict[str, Any]:
    _ensure_oidc_configured()
    payload = {
        "grant_type": "authorization_code",
        "client_id": settings.AUTHENTIK["CLIENT_ID"],
        "code": code,
        "redirect_uri": redirect_uri,
        "code_verifier": code_verifier,
    }
    if settings.AUTHENTIK["CLIENT_SECRET"]:
        payload["client_secret"] = settings.AUTHENTIK["CLIENT_SECRET"]
    return _request_form("/application/o/token/", payload)


def authenticate_with_password(*, username: str, password: str) -> dict[str, Any]:
    _ensure_oidc_configured()
    payload = {
        "grant_type": "password",
        "client_id": settings.AUTHENTIK["CLIENT_ID"],
        "username": username,
        "password": password,
        "scope": settings.AUTHENTIK["SCOPES"],
    }
    if settings.AUTHENTIK["CLIENT_SECRET"]:
        payload["client_secret"] = settings.AUTHENTIK["CLIENT_SECRET"]
    return _request_form("/application/o/token/", payload)


def refresh_token(*, refresh_token_value: str) -> dict[str, Any]:
    _ensure_oidc_configured()
    payload = {
        "grant_type": "refresh_token",
        "client_id": settings.AUTHENTIK["CLIENT_ID"],
        "refresh_token": refresh_token_value,
    }
    if settings.AUTHENTIK["CLIENT_SECRET"]:
        payload["client_secret"] = settings.AUTHENTIK["CLIENT_SECRET"]
    return _request_form("/application/o/token/", payload)


def get_userinfo(access_token: str) -> dict[str, Any]:
    if not access_token:
        raise AuthentikProvisioningError("Missing access token.", status_code=401)

    req = request.Request(
        _build_api_url("/application/o/userinfo/"),
        method="GET",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
        },
    )

    try:
        with request.urlopen(req, context=_get_ssl_context()) as response:
            raw_body = response.read().decode("utf-8")
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8")
        raise AuthentikProvisioningError(
            _extract_error_message(detail, exc.code),
            status_code=401 if exc.code in {400, 401, 403} else 502,
        ) from exc
    except error.URLError as exc:
        raise AuthentikProvisioningError("Could not reach Authentik.") from exc

    if not raw_body:
        raise AuthentikProvisioningError(
            "Authentik returned an empty userinfo response."
        )

    return json.loads(raw_body)


def delete_user(user_id: int) -> None:
    try:
        _request_json(
            "DELETE", f"/api/v3/core/users/{user_id}/", None, expected_statuses={204}
        )
    except AuthentikProvisioningError:
        pass


def _ensure_oidc_configured() -> None:
    if not settings.AUTHENTIK["ISSUER_URL"]:
        raise AuthentikProvisioningError(
            "Authentik issuer URL is not configured.", status_code=500
        )
    if not settings.AUTHENTIK["CLIENT_ID"]:
        raise AuthentikProvisioningError(
            "Authentik client id is not configured.", status_code=500
        )


def _ensure_management_configured() -> None:
    _ensure_oidc_configured()
    if not settings.AUTHENTIK["SERVICE_TOKEN"]:
        raise AuthentikProvisioningError(
            "Authentik service token is not configured.", status_code=500
        )


def _request_json(
    method: str,
    path: str,
    payload: dict[str, Any] | None,
    *,
    expected_statuses: set[int] | None = None,
) -> dict[str, Any]:
    expected_statuses = expected_statuses or {200, 201}
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    api_url = _build_api_url(path)
    req = request.Request(
        api_url,
        data=body,
        method=method,
        headers={
            "Authorization": f"Bearer {settings.AUTHENTIK['SERVICE_TOKEN']}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
    )

    try:
        with request.urlopen(req, context=_get_ssl_context()) as response:
            status_code = response.getcode()
            raw_body = response.read().decode("utf-8")
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8")
        raise AuthentikProvisioningError(
            _extract_error_message(detail, exc.code),
            status_code=400 if exc.code in {400, 409} else 502,
        ) from exc
    except error.URLError as exc:
        raise AuthentikProvisioningError("Could not reach Authentik.") from exc

    if status_code not in expected_statuses:
        raise AuthentikProvisioningError("Authentik returned an unexpected response.")

    if status_code == 204 or not raw_body:
        return {}

    return json.loads(raw_body)


def _request_form(path: str, payload: dict[str, str]) -> dict[str, Any]:
    body = parse.urlencode(payload).encode("utf-8")
    req = request.Request(
        _build_api_url(path),
        data=body,
        method="POST",
        headers={
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )

    try:
        with request.urlopen(req, context=_get_ssl_context()) as response:
            raw_body = response.read().decode("utf-8")
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8")
        raise AuthentikProvisioningError(
            _extract_error_message(detail, exc.code),
            status_code=400 if exc.code in {400, 401, 403} else 502,
        ) from exc
    except error.URLError as exc:
        raise AuthentikProvisioningError("Could not reach Authentik.") from exc

    if not raw_body:
        raise AuthentikProvisioningError("Authentik returned an empty token response.")

    return json.loads(raw_body)


def _resolve_group_ids(group_names: list[str]) -> list[str]:
    resolved_group_ids: list[str] = []

    for group_name in group_names:
        normalized_name = group_name.strip()
        if not normalized_name:
            continue

        response = _request_json(
            "GET",
            f"/api/v3/core/groups/?name={parse.quote(normalized_name)}",
            None,
        )
        results = response.get("results") if isinstance(response, dict) else None
        if not isinstance(results, list):
            raise AuthentikProvisioningError(
                f"Could not resolve Authentik group '{normalized_name}'."
            )

        match = next(
            (
                item
                for item in results
                if isinstance(item, dict) and item.get("name") == normalized_name
            ),
            None,
        )
        if not isinstance(match, dict) or not isinstance(match.get("pk"), str):
            raise AuthentikProvisioningError(
                f"Could not resolve Authentik group '{normalized_name}'."
            )

        resolved_group_ids.append(match["pk"])

    return resolved_group_ids


def _get_default_group_ids() -> list[str]:
    configured_group_ids = settings.AUTHENTIK["DEFAULT_GROUP_IDS"]
    if configured_group_ids:
        return configured_group_ids

    configured_group_names = settings.AUTHENTIK["DEFAULT_GROUPS"]
    if not configured_group_names:
        return []

    try:
        return _resolve_group_ids(configured_group_names)
    except AuthentikProvisioningError as exc:
        if exc.status_code == 502:
            raise AuthentikProvisioningError(
                "Could not resolve Authentik groups by name. Set AUTHENTIK_DEFAULT_GROUP_IDS with the group's UUID or grant the service token permission to view groups.",
                status_code=500,
            ) from exc
        raise


def _build_api_url(path: str) -> str:
    issuer_url = settings.AUTHENTIK["INTERNAL_URL"] or settings.AUTHENTIK["ISSUER_URL"]
    parsed_issuer = parse.urlparse(issuer_url)
    base_url = parse.urlunparse(
        (parsed_issuer.scheme, parsed_issuer.netloc, "", "", "", "")
    )
    return parse.urljoin(f"{base_url}/", path.lstrip("/"))


def _get_ssl_context() -> ssl.SSLContext | None:
    if settings.AUTHENTIK["VERIFY_SSL"]:
        return None
    return ssl._create_unverified_context()


def _extract_error_message(response_body: str, status_code: int) -> str:
    if not response_body:
        return f"Authentik request failed with status {status_code}."

    try:
        payload = json.loads(response_body)
    except json.JSONDecodeError:
        return f"Authentik request failed with status {status_code}."

    if isinstance(payload, dict):
        if "detail" in payload and isinstance(payload["detail"], str):
            return payload["detail"]
        messages: list[str] = []
        for field, errors in payload.items():
            if isinstance(errors, list):
                for item in errors:
                    if isinstance(item, dict) and isinstance(item.get("string"), str):
                        messages.append(item["string"])
                    elif isinstance(item, str):
                        messages.append(item)
            elif isinstance(errors, str):
                messages.append(f"{field}: {errors}")
        if messages:
            return " ".join(messages)

    return f"Authentik request failed with status {status_code}."
