from typing import Any

from django.db import IntegrityError
from rest_framework import permissions, status
from rest_framework.exceptions import APIException
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from organizations.bootstrap import ensure_user_company_membership
from authorization import fga

from .authentik import (
    AuthentikProvisioningError,
    create_user,
    delete_user,
    exchange_code,
    find_user_by_email,
    refresh_token,
)
from .models import User
from .serializers import (
    MeSerializer,
    OidcCodeExchangeSerializer,
    OidcRefreshSerializer,
    SignupSerializer,
)


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = MeSerializer(request.user)

        return Response(serializer.data)


class SignupView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        name = _validated_string(serializer, "name")
        email = _validated_string(serializer, "email")
        password = _validated_string(serializer, "password")

        local_user = User.objects.filter(email__iexact=email).first()

        try:
            authentik_user = find_user_by_email(email)
        except AuthentikProvisioningError as exc:
            if exc.status_code >= 500:
                raise APIException(str(exc)) from exc
            raise ValidationError({"email": [str(exc)]}) from exc

        if authentik_user is not None:
            raise ValidationError({"email": ["An account with this email already exists in Authentik."]})

        try:
            created_authentik_user = create_user(
                name=name,
                email=email,
                password=password,
            )
        except AuthentikProvisioningError as exc:
            if exc.status_code >= 500:
                raise APIException(str(exc)) from exc
            raise ValidationError({"email": [str(exc)]}) from exc

        if local_user is None:
            try:
                local_user = User.objects.create_user(
                    email=email,
                    password=password,
                    first_name=_first_name(name),
                    last_name=_last_name(name),
                    authentik_sub=created_authentik_user.sub,
                )
            except IntegrityError as exc:
                delete_user(created_authentik_user.id)
                raise ValidationError(
                    {"email": ["An account with this email already exists."]}
                ) from exc
        elif local_user.authentik_sub != created_authentik_user.sub:
            local_user.authentik_sub = created_authentik_user.sub
            local_user.save(update_fields=["authentik_sub"])

        ensure_user_company_membership(local_user)
        fga.provision_user(created_authentik_user.sub)

        return Response(
            {
                "account_created": True,
                "login_succeeded": False,
                "login_error": None,
            },
            status=status.HTTP_201_CREATED,
        )


class AuthentikTokenView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = _request_string(request.data, "email")
        password = _request_string(request.data, "password")

        try:
            tokens = authenticate_with_password(username=email, password=password)
        except AuthentikProvisioningError as exc:
            if exc.status_code >= 500:
                raise APIException(str(exc)) from exc
            raise ValidationError({"detail": [str(exc)]}) from exc

        return Response(_serialize_token_response(tokens))


class OidcExchangeView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = OidcCodeExchangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            tokens = exchange_code(
                code=_validated_string(serializer, "code"),
                code_verifier=_validated_string(serializer, "code_verifier"),
                redirect_uri=_validated_string(serializer, "redirect_uri"),
            )
        except AuthentikProvisioningError as exc:
            if exc.status_code >= 500:
                raise APIException(str(exc)) from exc
            raise ValidationError({"code": [str(exc)]}) from exc

        return Response(_serialize_token_response(tokens))


class OidcRefreshView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        refresh_token_value = _request_string(
            request.data,
            "refresh_token",
            fallback_keys=("refresh",),
        )

        try:
            tokens = refresh_token(refresh_token_value=refresh_token_value)
        except AuthentikProvisioningError as exc:
            if exc.status_code >= 500:
                raise APIException(str(exc)) from exc
            raise ValidationError({"refresh_token": [str(exc)]}) from exc

        return Response(_serialize_token_response(tokens))


def _first_name(name: str) -> str:
    return name.strip().partition(" ")[0]


def _last_name(name: str) -> str:
    return name.strip().partition(" ")[2].strip()


def _validated_string(serializer: Any, key: str) -> str:
    validated_data = getattr(serializer, "validated_data", None)
    if not isinstance(validated_data, dict):
        raise ValidationError({key: ["This field is required."]})

    value = validated_data.get(key)
    if not isinstance(value, str):
        raise ValidationError({key: ["This field is required."]})
    return value


def _serialize_token_response(tokens: dict[str, Any]) -> dict[str, Any]:
    return {
        "access": tokens.get("access_token", ""),
        "refresh": tokens.get("refresh_token", ""),
        "expires_in": tokens.get("expires_in"),
        "token_type": tokens.get("token_type", "Bearer"),
    }


def _request_string(data: Any, key: str, fallback_keys: tuple[str, ...] = ()) -> str:
    if not isinstance(data, dict):
        raise ValidationError({key: ["This field is required."]})
    value = data.get(key)
    if not isinstance(value, str):
        for fallback_key in fallback_keys:
            fallback_value = data.get(fallback_key)
            if isinstance(fallback_value, str):
                value = fallback_value
                break
    if not isinstance(value, str) or not value.strip():
        raise ValidationError({key: ["This field is required."]})
    return value.strip()
