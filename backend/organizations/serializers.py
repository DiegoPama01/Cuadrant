from rest_framework import serializers

from workforce.models import Position, Shift, StaffRequirement, Zone
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


class ZonePositionRequirementInputSerializer(serializers.Serializer):
    position = serializers.UUIDField()
    required_count = serializers.IntegerField(min_value=1)


class ZoneStaffRequirementInputSerializer(serializers.Serializer):
    shift = serializers.UUIDField()
    positions = ZonePositionRequirementInputSerializer(many=True, required=False)


class ZoneSerializer(serializers.ModelSerializer):
    staff_requirements = ZoneStaffRequirementInputSerializer(many=True, required=False, write_only=True)
    installation = serializers.PrimaryKeyRelatedField(queryset=Installation.objects.none(), required=False)

    class Meta:
        model = Zone
        fields = (
            "id",
            "installation",
            "name",
            "code",
            "description",
            "color",
            "sort_order",
            "active",
            "created_at",
            "updated_at",
            "staff_requirements",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        company = self.context.get("company")
        if company:
            self.fields["installation"].queryset = Installation.objects.filter(company=company)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        grouped = {}
        requirements = StaffRequirement.objects.filter(installation=instance.installation, zone=instance, active=True)
        for requirement in requirements:
            preset = grouped.setdefault(str(requirement.shift_id), {"shift": str(requirement.shift_id), "positions": {}})
            existing = preset["positions"].get(str(requirement.position_id))
            if existing is None or requirement.required_employees > existing["required_count"]:
                preset["positions"][str(requirement.position_id)] = {
                    "position": str(requirement.position_id),
                    "required_count": requirement.required_employees,
                }
        data["staff_requirements"] = [
            {"id": f"{instance.id}:{preset['shift']}", "shift": preset["shift"], "positions": list(preset["positions"].values())}
            for preset in grouped.values()
        ]
        return data

    def create(self, validated_data):
        staff_requirements = validated_data.pop("staff_requirements", [])
        instance = super().create(validated_data)
        self._sync_staff_requirements(instance, staff_requirements)
        return instance

    def update(self, instance, validated_data):
        staff_requirements = validated_data.pop("staff_requirements", None)
        instance = super().update(instance, validated_data)
        if staff_requirements is not None:
            self._sync_staff_requirements(instance, staff_requirements)
        return instance

    def _sync_staff_requirements(self, zone, staff_requirements):
        company = self.context["company"]
        StaffRequirement.objects.filter(installation=zone.installation, zone=zone, date__isnull=True).delete()
        for item in staff_requirements:
            shift = serializers.PrimaryKeyRelatedField(
                queryset=Shift.objects.filter(installation__company=company),
            ).to_internal_value(item["shift"])
            if shift.installation_id != zone.installation_id:
                raise serializers.ValidationError("All shifts must belong to the zone installation.")
            for position_item in item.get("positions", []):
                position = position_item["position"]
                if not Position.objects.filter(id=position, installation=zone.installation).exists():
                    raise serializers.ValidationError("All positions must belong to the zone installation.")
                for day_of_week in range(7):
                    StaffRequirement.objects.create(
                        installation=zone.installation,
                        zone=zone,
                        shift=shift,
                        position_id=position,
                        day_of_week=day_of_week,
                        required_employees=position_item.get("required_count", 1),
                        active=True,
                    )


class ShiftSerializer(serializers.ModelSerializer):
    installation = serializers.PrimaryKeyRelatedField(queryset=Installation.objects.none(), required=False)

    class Meta:
        model = Shift
        fields = (
            "id",
            "installation",
            "name",
            "code",
            "start_time",
            "end_time",
            "break_minutes",
            "color",
            "sort_order",
            "active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        company = self.context.get("company")
        if company:
            self.fields["installation"].queryset = Installation.objects.filter(company=company)
