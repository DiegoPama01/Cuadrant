from rest_framework import serializers
from organizations.models import Company, Installation


class InstallationInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150, required=False)
    code = serializers.CharField(max_length=50, required=False, allow_blank=True, allow_null=True)
    address = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    timezone = serializers.CharField(max_length=64, required=False, allow_blank=True, allow_null=True)
    active = serializers.BooleanField(required=False, default=True)


class CompanySerializer(serializers.ModelSerializer):
    initial_installation = InstallationInputSerializer(write_only=True, required=False)

    class Meta:
        model = Company
        fields = (
            "id",
            "name",
            "slug",
            "legal_name",
            "tax_id",
            "timezone",
            "active",
            "created_at",
            "updated_at",
            "initial_installation",
        )
        read_only_fields = ("id", "slug", "created_at", "updated_at")


class InstallationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Installation
        fields = (
            "id",
            "company",
            "name",
            "code",
            "address",
            "timezone",
            "active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "company", "created_at", "updated_at")
