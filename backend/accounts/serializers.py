from django.core.exceptions import ValidationError as DjangoValidationError
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from accounts.models import User
from organizations.models import CompanyMembership


class CompanyMembershipSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source="company.id", read_only=True)
    name = serializers.CharField(source="company.name", read_only=True)
    slug = serializers.CharField(source="company.slug", read_only=True)

    class Meta:
        model = CompanyMembership
        fields = (
            "id",
            "name",
            "slug",
            "role",
        )


class MeSerializer(serializers.ModelSerializer):
    companies = CompanyMembershipSerializer(
        source="company_memberships",
        many=True,
        read_only=True,
    )

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "authentik_sub",
            "first_name",
            "last_name",
            "companies",
        )
        read_only_fields = ("authentik_sub",)


class SignupSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    confirm_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_email(self, value: str) -> str:
        return value.lower()

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError(
                {"confirm_password": "Passwords do not match."}
            )

        user = User(email=attrs["email"])
        _apply_name(user, attrs["name"])
        try:
            validate_password(attrs["password"], user=user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)}) from exc
        return attrs


class OidcCodeExchangeSerializer(serializers.Serializer):
    code = serializers.CharField()
    code_verifier = serializers.CharField()
    redirect_uri = serializers.URLField()


class OidcRefreshSerializer(serializers.Serializer):
    refresh_token = serializers.CharField()


def _apply_name(user: User, name: str) -> None:
    first_name, _, last_name = name.strip().partition(" ")
    setattr(user, "first_name", first_name)
    setattr(user, "last_name", last_name.strip())
