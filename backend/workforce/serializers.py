import datetime

from django.db import transaction
from django.db.models import Q
from rest_framework import serializers

from organizations.models import CompanyMembership, Installation
from .models import (
    Assignment,
    Contract,
    Employee,
    EmployeeAvailability,
    EmployeeAvailabilityException,
    EmployeePosition,
    EmployeeTimeOff,
    EmployeeZone,
    Planning,
    Position,
    Shift,
    StaffRequirement,
    TimeBalanceEntry,
    Zone,
)


def _same_installation(*objects):
    installation_ids = {
        item.id if isinstance(item, Installation) else item.installation_id
        for item in objects
        if item is not None
    }
    return len(installation_ids) <= 1


def _belongs_to_company(company, *objects):
    return all(item.company_id == company.id for item in objects if item is not None)


def _has_partial_time_pair(serializer, attrs, start_field="start_time", end_field="end_time"):
    start = attrs.get(start_field) if start_field in attrs else getattr(serializer.instance, start_field, None)
    end = attrs.get(end_field) if end_field in attrs else getattr(serializer.instance, end_field, None)
    return (start is None) != (end is None)


class PositionSerializer(serializers.ModelSerializer):
    installation = serializers.PrimaryKeyRelatedField(queryset=Installation.objects.none(), required=False)

    class Meta:
        model = Position
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
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        company = self.context.get("company")
        if company:
            self.fields["installation"].queryset = Installation.objects.filter(company=company)


class EmployeeContractPayloadSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    start_date = serializers.DateField()
    end_date = serializers.DateField(required=False, allow_null=True)
    weekly_hours = serializers.DecimalField(max_digits=5, decimal_places=2)
    work_percentage = serializers.IntegerField(required=False, allow_null=True, min_value=0, max_value=100)
    calculation_period = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    active = serializers.BooleanField(required=False, default=True)


class EmployeePositionPayloadSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    position = serializers.PrimaryKeyRelatedField(queryset=Position.objects.none())
    primary = serializers.BooleanField(required=False, default=False)
    proficiency = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        company = self.context.get("company")
        if company:
            self.fields["position"].queryset = Position.objects.filter(installation__company=company)


class EmployeeZonePayloadSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    zone = serializers.PrimaryKeyRelatedField(queryset=Zone.objects.none())
    preferred = serializers.BooleanField(required=False, default=False)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        company = self.context.get("company")
        if company:
            self.fields["zone"].queryset = Zone.objects.filter(installation__company=company)


class EmployeeAvailabilityPayloadSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    day_of_week = serializers.IntegerField(min_value=0, max_value=6)
    available = serializers.BooleanField(required=False, default=True)
    start_time = serializers.TimeField(required=False, allow_null=True)
    end_time = serializers.TimeField(required=False, allow_null=True)

    def validate(self, attrs):
        start = attrs.get("start_time")
        end = attrs.get("end_time")
        if (start is None) != (end is None):
            raise serializers.ValidationError("Start time and end time must both be set or both be empty.")
        if start is not None and end is not None and end <= start:
            raise serializers.ValidationError({"end_time": "End time must be after start time."})
        return attrs


class EmployeeSerializer(serializers.ModelSerializer):
    installation = serializers.PrimaryKeyRelatedField(queryset=Installation.objects.none(), required=False)
    position = serializers.PrimaryKeyRelatedField(
        queryset=Position.objects.none(),
        required=False,
        allow_null=True,
    )
    allowed_zones = serializers.PrimaryKeyRelatedField(
        queryset=Zone.objects.none(),
        many=True,
        required=False,
    )
    contract = EmployeeContractPayloadSerializer(required=False, allow_null=True)
    employee_positions = EmployeePositionPayloadSerializer(many=True, required=False)
    employee_zones = EmployeeZonePayloadSerializer(many=True, required=False)
    availabilities = EmployeeAvailabilityPayloadSerializer(many=True, required=False)
    grant_quadrant_access = serializers.BooleanField(write_only=True, required=False, default=False)
    has_quadrant_access = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Employee
        fields = (
            "id",
            "installation",
            "user",
            "employee_code",
            "first_name",
            "last_name",
            "email",
            "phone",
            "hire_date",
            "termination_date",
            "color",
            "notes",
            "active",
            "all_zones",
            "availability_unrestricted",
            "created_at",
            "updated_at",
            "position",
            "allowed_zones",
            "contract",
            "employee_positions",
            "employee_zones",
            "availabilities",
            "grant_quadrant_access",
            "has_quadrant_access",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        company = self.context.get("company")

        if company:
            self.fields["installation"].queryset = Installation.objects.filter(company=company)
            self.fields["position"].queryset = Position.objects.filter(
                installation__company=company,
            )
            self.fields["allowed_zones"].child_relation.queryset = Zone.objects.filter(
                installation__company=company,
            )
            self.fields["employee_positions"].child.fields["position"].queryset = Position.objects.filter(
                installation__company=company,
            )
            self.fields["employee_zones"].child.fields["zone"].queryset = Zone.objects.filter(
                installation__company=company,
            )

    def get_has_quadrant_access(self, obj):
        if not obj.user_id:
            return False
        return CompanyMembership.objects.filter(company=obj.company, user=obj.user).exists()

    def to_representation(self, instance):
        data = super().to_representation(instance)
        active_contract = instance.contracts.filter(active=True).order_by("-start_date").first()
        data["contract"] = EmployeeContractPayloadSerializer(active_contract).data if active_contract else None
        data["employee_positions"] = EmployeePositionPayloadSerializer(instance.employee_positions.all(), many=True).data
        data["employee_zones"] = EmployeeZonePayloadSerializer(instance.employee_zones.all(), many=True).data
        data["availabilities"] = EmployeeAvailabilityPayloadSerializer(instance.availabilities.all(), many=True).data
        return data

    def validate(self, attrs):
        # Preserve the pre-existing flat endpoint validation while adding the
        # composite employee form payload checks.
        installation = attrs.get("installation") or getattr(self.instance, "installation", None)
        company = self.context.get("company")
        if installation is None and company:
            installation = Installation.objects.filter(company=company).order_by("created_at").first()

        if installation is not None:
            position = attrs.get("position")
            if position and position.installation_id != installation.id:
                raise serializers.ValidationError({"position": "Position must belong to the employee installation."})

            for zone in attrs.get("allowed_zones", []):
                if zone.installation_id != installation.id:
                    raise serializers.ValidationError({"allowed_zones": "Zones must belong to the employee installation."})

        nested_positions = attrs.get("employee_positions")
        if nested_positions is not None:
            if len([item for item in nested_positions if item.get("primary")]) > 1:
                raise serializers.ValidationError({"employee_positions": "Only one primary position is allowed."})
            position_ids = [item["position"].id for item in nested_positions]
            if len(position_ids) != len(set(position_ids)):
                raise serializers.ValidationError({"employee_positions": "Each position can only be selected once."})
            for item in nested_positions:
                if installation and item["position"].installation_id != installation.id:
                    raise serializers.ValidationError({"employee_positions": "Positions must belong to the employee installation."})

        nested_zones = attrs.get("employee_zones")
        all_zones = attrs.get("all_zones", getattr(self.instance, "all_zones", True))
        if nested_zones is not None:
            if all_zones and nested_zones:
                raise serializers.ValidationError({"employee_zones": "Zone restrictions cannot be provided when all_zones is true."})
            for item in nested_zones:
                if installation and item["zone"].installation_id != installation.id:
                    raise serializers.ValidationError({"employee_zones": "Zones must belong to the employee installation."})
            zone_ids = [item["zone"].id for item in nested_zones]
            if len(zone_ids) != len(set(zone_ids)):
                raise serializers.ValidationError({"employee_zones": "Each zone can only be selected once."})

        nested_availabilities = attrs.get("availabilities")
        unrestricted = attrs.get("availability_unrestricted", getattr(self.instance, "availability_unrestricted", True))
        if nested_availabilities is not None:
            if unrestricted and nested_availabilities:
                raise serializers.ValidationError({"availabilities": "Availability windows cannot be provided when availability_unrestricted is true."})
            days = [item["day_of_week"] for item in nested_availabilities]
            if len(days) != len(set(days)):
                raise serializers.ValidationError({"availabilities": "Only one habitual availability entry per day is supported by this endpoint."})

        contract = attrs.get("contract")
        if contract:
            end_date = contract.get("end_date")
            if end_date and end_date < contract["start_date"]:
                raise serializers.ValidationError({"contract": {"end_date": "End date must be on or after start date."}})

        return attrs

    def _sync_contract(self, employee, contract_data):
        if contract_data is None:
            return
        active_contract = employee.contracts.filter(active=True).order_by("-start_date").first()
        if active_contract:
            for key, value in contract_data.items():
                setattr(active_contract, key, value)
            active_contract.save()
        else:
            if contract_data.get("active", True):
                employee.contracts.update(active=False)
            Contract.objects.create(employee=employee, **contract_data)

    def _sync_positions(self, employee, positions_data):
        if positions_data is None:
            return
        EmployeePosition.objects.filter(employee=employee).delete()
        EmployeePosition.objects.bulk_create(
            [EmployeePosition(employee=employee, **item) for item in positions_data]
        )
        primary = next((item["position"] for item in positions_data if item.get("primary")), None)
        if primary and employee.position_id != primary.id:
            employee.position = primary
            employee.save(update_fields=["position"])

    def _sync_zones(self, employee, zones_data):
        if zones_data is None:
            return
        EmployeeZone.objects.filter(employee=employee).delete()
        if employee.all_zones:
            employee.allowed_zones.clear()
            return
        EmployeeZone.objects.bulk_create([EmployeeZone(employee=employee, **item) for item in zones_data])
        employee.allowed_zones.set([item["zone"] for item in zones_data])

    def _sync_availabilities(self, employee, availabilities_data):
        if availabilities_data is None:
            return
        EmployeeAvailability.objects.filter(employee=employee).delete()
        if employee.availability_unrestricted:
            return
        EmployeeAvailability.objects.bulk_create(
            [EmployeeAvailability(employee=employee, **item) for item in availabilities_data]
        )

    def _grant_quadrant_access(self, employee):
        if employee.user_id:
            CompanyMembership.objects.get_or_create(
                company=employee.company,
                user=employee.user,
                defaults={"role": CompanyMembership.Role.MEMBER},
            )

    @transaction.atomic
    def create(self, validated_data):
        contract_data = validated_data.pop("contract", None)
        positions_data = validated_data.pop("employee_positions", None)
        zones_data = validated_data.pop("employee_zones", None)
        availabilities_data = validated_data.pop("availabilities", None)
        grant_access = validated_data.pop("grant_quadrant_access", False)
        allowed_zones = validated_data.pop("allowed_zones", None)

        employee = super().create(validated_data)
        if allowed_zones is not None:
            employee.allowed_zones.set(allowed_zones)
        self._sync_contract(employee, contract_data)
        self._sync_positions(employee, positions_data)
        self._sync_zones(employee, zones_data)
        self._sync_availabilities(employee, availabilities_data)
        if grant_access:
            self._grant_quadrant_access(employee)
        return employee

    @transaction.atomic
    def update(self, instance, validated_data):
        contract_data = validated_data.pop("contract", None)
        positions_data = validated_data.pop("employee_positions", None)
        zones_data = validated_data.pop("employee_zones", None)
        availabilities_data = validated_data.pop("availabilities", None)
        grant_access = validated_data.pop("grant_quadrant_access", False)
        employee = super().update(instance, validated_data)
        self._sync_contract(employee, contract_data)
        self._sync_positions(employee, positions_data)
        self._sync_zones(employee, zones_data)
        self._sync_availabilities(employee, availabilities_data)
        if employee.all_zones and zones_data is None:
            EmployeeZone.objects.filter(employee=employee).delete()
            employee.allowed_zones.clear()
        if employee.availability_unrestricted and availabilities_data is None:
            EmployeeAvailability.objects.filter(employee=employee).delete()
        if grant_access:
            self._grant_quadrant_access(employee)
        return employee


class CompanyScopedModelSerializer(serializers.ModelSerializer):
    employee_fields = ()
    installation_fields = ()
    position_fields = ()
    zone_fields = ()
    shift_fields = ()
    assignment_fields = ()
    time_off_fields = ()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        company = self.context.get("company")
        if not company:
            return
        for field_name in self.employee_fields:
            self.fields[field_name].queryset = Employee.objects.filter(installation__company=company)
        for field_name in self.installation_fields:
            self.fields[field_name].queryset = Installation.objects.filter(company=company)
        for field_name in self.position_fields:
            self.fields[field_name].queryset = Position.objects.filter(installation__company=company)
        for field_name in self.zone_fields:
            self.fields[field_name].queryset = Zone.objects.filter(installation__company=company)
        for field_name in self.shift_fields:
            self.fields[field_name].queryset = Shift.objects.filter(installation__company=company)
        for field_name in self.assignment_fields:
            self.fields[field_name].queryset = Assignment.objects.filter(employee__installation__company=company)
        for field_name in self.time_off_fields:
            self.fields[field_name].queryset = EmployeeTimeOff.objects.filter(employee__installation__company=company)


class ContractSerializer(CompanyScopedModelSerializer):
    employee = serializers.PrimaryKeyRelatedField(queryset=Employee.objects.none())

    class Meta:
        model = Contract
        fields = ("id", "employee", "start_date", "end_date", "weekly_hours", "work_percentage", "calculation_period", "active", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")

    employee_fields = ("employee",)

    def validate(self, attrs):
        start_date = attrs.get("start_date") or getattr(self.instance, "start_date", None)
        end_date = attrs.get("end_date") if "end_date" in attrs else getattr(self.instance, "end_date", None)
        if end_date and start_date and end_date < start_date:
            raise serializers.ValidationError({"end_date": "End date must be on or after start date."})
        if attrs.get("work_percentage") is not None and attrs["work_percentage"] > 100:
            raise serializers.ValidationError({"work_percentage": "Work percentage cannot exceed 100."})
        return attrs


class EmployeePositionSerializer(CompanyScopedModelSerializer):
    employee = serializers.PrimaryKeyRelatedField(queryset=Employee.objects.none())
    position = serializers.PrimaryKeyRelatedField(queryset=Position.objects.none())

    class Meta:
        model = EmployeePosition
        fields = ("id", "employee", "position", "primary", "proficiency", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")

    employee_fields = ("employee",)
    position_fields = ("position",)

    def validate(self, attrs):
        employee = attrs.get("employee") or getattr(self.instance, "employee", None)
        position = attrs.get("position") or getattr(self.instance, "position", None)
        if not _same_installation(employee, position):
            raise serializers.ValidationError("Employee and position must belong to the same installation.")
        return attrs


class EmployeeZoneSerializer(CompanyScopedModelSerializer):
    employee = serializers.PrimaryKeyRelatedField(queryset=Employee.objects.none())
    zone = serializers.PrimaryKeyRelatedField(queryset=Zone.objects.none())

    class Meta:
        model = EmployeeZone
        fields = ("id", "employee", "zone", "preferred", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")

    employee_fields = ("employee",)
    zone_fields = ("zone",)

    def validate(self, attrs):
        employee = attrs.get("employee") or getattr(self.instance, "employee", None)
        zone = attrs.get("zone") or getattr(self.instance, "zone", None)
        if not _same_installation(employee, zone):
            raise serializers.ValidationError("Employee and zone must belong to the same installation.")
        return attrs


class EmployeeAvailabilitySerializer(CompanyScopedModelSerializer):
    employee = serializers.PrimaryKeyRelatedField(queryset=Employee.objects.none())

    class Meta:
        model = EmployeeAvailability
        fields = ("id", "employee", "day_of_week", "available", "start_time", "end_time", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")

    employee_fields = ("employee",)

    def validate(self, attrs):
        day_of_week = attrs.get("day_of_week", getattr(self.instance, "day_of_week", None))
        if not 0 <= day_of_week <= 6:
            raise serializers.ValidationError({"day_of_week": "Day of week must be between 0 and 6."})
        if _has_partial_time_pair(self, attrs):
            raise serializers.ValidationError("Start time and end time must both be set or both be empty.")
        return attrs


class EmployeeAvailabilityExceptionSerializer(CompanyScopedModelSerializer):
    employee = serializers.PrimaryKeyRelatedField(queryset=Employee.objects.none())

    class Meta:
        model = EmployeeAvailabilityException
        fields = ("id", "employee", "date", "available", "start_time", "end_time", "reason", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")

    employee_fields = ("employee",)

    def validate(self, attrs):
        if _has_partial_time_pair(self, attrs):
            raise serializers.ValidationError("Start time and end time must both be set or both be empty.")
        return attrs


class EmployeeTimeOffSerializer(CompanyScopedModelSerializer):
    employee = serializers.PrimaryKeyRelatedField(queryset=Employee.objects.none())

    class Meta:
        model = EmployeeTimeOff
        fields = ("id", "employee", "type", "start_date", "end_date", "start_time", "end_time", "minutes", "status", "notes", "created_by", "created_at", "updated_at")
        read_only_fields = ("id", "created_by", "created_at", "updated_at")

    employee_fields = ("employee",)

    def validate(self, attrs):
        start_date = attrs.get("start_date") or getattr(self.instance, "start_date", None)
        end_date = attrs.get("end_date") or getattr(self.instance, "end_date", None)
        if end_date < start_date:
            raise serializers.ValidationError({"end_date": "End date must be on or after start date."})
        if _has_partial_time_pair(self, attrs):
            raise serializers.ValidationError("Start time and end time must both be set or both be empty.")
        return attrs


class AssignmentSerializer(CompanyScopedModelSerializer):
    employee = serializers.PrimaryKeyRelatedField(queryset=Employee.objects.none())
    shift = serializers.PrimaryKeyRelatedField(queryset=Shift.objects.none())
    zone = serializers.PrimaryKeyRelatedField(queryset=Zone.objects.none())
    position = serializers.PrimaryKeyRelatedField(queryset=Position.objects.none())

    class Meta:
        model = Assignment
        fields = ("id", "employee", "date", "shift", "zone", "position", "start_time_override", "end_time_override", "break_minutes_override", "notes", "created_by", "created_at", "updated_at")
        read_only_fields = ("id", "created_by", "created_at", "updated_at")

    employee_fields = ("employee",)
    shift_fields = ("shift",)
    zone_fields = ("zone",)
    position_fields = ("position",)

    def validate(self, attrs):
        related = (
            attrs.get("employee") or getattr(self.instance, "employee", None),
            attrs.get("shift") or getattr(self.instance, "shift", None),
            attrs.get("zone") or getattr(self.instance, "zone", None),
            attrs.get("position") or getattr(self.instance, "position", None),
        )
        if not _same_installation(*related):
            raise serializers.ValidationError("Employee, shift, zone, and position must belong to the same installation.")
        if _has_partial_time_pair(self, attrs, "start_time_override", "end_time_override"):
            raise serializers.ValidationError("Override start and end time must both be set or both be empty.")
        return attrs


class TimeBalanceEntrySerializer(CompanyScopedModelSerializer):
    employee = serializers.PrimaryKeyRelatedField(queryset=Employee.objects.none())
    assignment = serializers.PrimaryKeyRelatedField(queryset=Assignment.objects.none(), required=False, allow_null=True)
    time_off = serializers.PrimaryKeyRelatedField(queryset=EmployeeTimeOff.objects.none(), required=False, allow_null=True)

    class Meta:
        model = TimeBalanceEntry
        fields = ("id", "employee", "date", "type", "minutes", "assignment", "time_off", "notes", "created_by", "created_at", "updated_at")
        read_only_fields = ("id", "created_by", "created_at", "updated_at")

    employee_fields = ("employee",)
    assignment_fields = ("assignment",)
    time_off_fields = ("time_off",)

    def validate(self, attrs):
        employee = attrs.get("employee") or getattr(self.instance, "employee", None)
        assignment = attrs.get("assignment")
        time_off = attrs.get("time_off")
        if assignment and assignment.employee_id != employee.id:
            raise serializers.ValidationError({"assignment": "Assignment must belong to the selected employee."})
        if time_off and time_off.employee_id != employee.id:
            raise serializers.ValidationError({"time_off": "Time off must belong to the selected employee."})
        return attrs


class StaffRequirementSerializer(CompanyScopedModelSerializer):
    installation = serializers.PrimaryKeyRelatedField(queryset=Installation.objects.none())
    zone = serializers.PrimaryKeyRelatedField(queryset=Zone.objects.none())
    shift = serializers.PrimaryKeyRelatedField(queryset=Shift.objects.none())
    position = serializers.PrimaryKeyRelatedField(queryset=Position.objects.none())

    class Meta:
        model = StaffRequirement
        fields = ("id", "installation", "zone", "shift", "position", "day_of_week", "date", "required_employees", "minimum_employees", "notes", "active", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")

    installation_fields = ("installation",)
    zone_fields = ("zone",)
    shift_fields = ("shift",)
    position_fields = ("position",)

    def validate(self, attrs):
        related = (
            attrs.get("installation") or getattr(self.instance, "installation", None),
            attrs.get("zone") or getattr(self.instance, "zone", None),
            attrs.get("shift") or getattr(self.instance, "shift", None),
            attrs.get("position") or getattr(self.instance, "position", None),
        )
        if not _same_installation(*related):
            raise serializers.ValidationError("Installation, zone, shift, and position must match.")
        day_of_week = attrs.get("day_of_week") if "day_of_week" in attrs else getattr(self.instance, "day_of_week", None)
        date = attrs.get("date") if "date" in attrs else getattr(self.instance, "date", None)
        required_employees = attrs.get("required_employees") or getattr(self.instance, "required_employees", None)
        minimum_employees = attrs.get("minimum_employees") if "minimum_employees" in attrs else getattr(self.instance, "minimum_employees", None)
        if (day_of_week is None) == (date is None):
            raise serializers.ValidationError("Exactly one of day_of_week or date is required.")
        if day_of_week is not None and not 0 <= day_of_week <= 6:
            raise serializers.ValidationError({"day_of_week": "Day of week must be between 0 and 6."})
        if required_employees is not None and required_employees < 1:
            raise serializers.ValidationError({"required_employees": "Required employees must be at least 1."})
        if minimum_employees is not None and required_employees is not None and minimum_employees > required_employees:
            raise serializers.ValidationError({"minimum_employees": "Minimum employees cannot exceed required employees."})
        return attrs


class PlanningSerializer(CompanyScopedModelSerializer):
    installation = serializers.PrimaryKeyRelatedField(queryset=Installation.objects.none())

    class Meta:
        model = Planning
        fields = ("id", "installation", "start_date", "end_date", "status", "version", "published_at", "published_by", "created_at", "updated_at")
        read_only_fields = ("id", "published_by", "created_at", "updated_at")

    installation_fields = ("installation",)

    def validate(self, attrs):
        start_date = attrs.get("start_date") or getattr(self.instance, "start_date", None)
        end_date = attrs.get("end_date") or getattr(self.instance, "end_date", None)
        if end_date < start_date:
            raise serializers.ValidationError({"end_date": "End date must be on or after start date."})
        return attrs


class PlanningWeekSerializer(serializers.Serializer):
    week_start = serializers.DateField()
    week_end = serializers.DateField()
    assignments = serializers.SerializerMethodField()
    requirements = StaffRequirementSerializer(many=True, required=False)
    staff_requirements = StaffRequirementSerializer(many=True, required=False)

    def get_assignments(self, obj):
        return [
            {
                "id": str(assignment.id),
                "employee": str(assignment.employee_id),
                "date": assignment.date.isoformat(),
                "work_date": assignment.date.isoformat(),
                "zone": str(assignment.zone_id),
                "shift": str(assignment.shift_id),
                "position": str(assignment.position_id),
                "notes": assignment.notes or "",
                "note": assignment.notes or "",
            }
            for assignment in obj.get("assignments", [])
        ]


class PlanningWeekAssignmentWriteSerializer(serializers.Serializer):
    employee = serializers.PrimaryKeyRelatedField(queryset=Employee.objects.none())
    date = serializers.DateField(required=False)
    work_date = serializers.DateField(required=False)
    zone = serializers.PrimaryKeyRelatedField(queryset=Zone.objects.none())
    shift = serializers.PrimaryKeyRelatedField(queryset=Shift.objects.none())
    position = serializers.PrimaryKeyRelatedField(queryset=Position.objects.none())
    note = serializers.CharField(required=False, allow_blank=True, trim_whitespace=True)
    notes = serializers.CharField(required=False, allow_blank=True, trim_whitespace=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        company = self.context.get("company")

        if company:
            self.fields["employee"].queryset = Employee.objects.filter(installation__company=company)
            self.fields["zone"].queryset = Zone.objects.filter(installation__company=company)
            self.fields["shift"].queryset = Shift.objects.filter(installation__company=company)
            self.fields["position"].queryset = Position.objects.filter(installation__company=company)

    def validate(self, attrs):
        company = self.context["company"]
        week_start = self.context["week_start"]
        week_end = week_start + datetime.timedelta(days=6)
        employee = attrs["employee"]
        zone = attrs["zone"]
        shift = attrs["shift"]
        position = attrs["position"]
        work_date = attrs.get("date") or attrs.get("work_date")

        if work_date is None:
            raise serializers.ValidationError({"date": "Date is required."})
        attrs["date"] = work_date
        attrs["notes"] = attrs.get("notes", attrs.get("note", ""))

        if employee.company_id != company.id:
            raise serializers.ValidationError(
                {"employee": "Employee must belong to the active company."}
            )

        if zone.company_id != company.id:
            raise serializers.ValidationError(
                {"zone": "Zone must belong to the active company."}
            )

        if shift.company_id != company.id:
            raise serializers.ValidationError(
                {"shift": "Shift must belong to the active company."}
            )

        if position.company_id != company.id:
            raise serializers.ValidationError(
                {"position": "Position must belong to the active company."}
            )

        if len({employee.installation_id, zone.installation_id, shift.installation_id, position.installation_id}) != 1:
            raise serializers.ValidationError(
                "Employee, zone, shift, and position must belong to the same installation."
            )

        if not employee.all_zones and not employee.employee_zones.filter(zone=zone).exists():
            raise serializers.ValidationError(
                {"zone": "Zone is not allowed for this employee."}
            )

        if not employee.employee_positions.filter(position=position).exists():
            raise serializers.ValidationError(
                {"position": "Position is not allowed for this employee."}
            )

        if not employee.active:
            raise serializers.ValidationError({"employee": "Inactive employees cannot be assigned."})

        requirement_query = StaffRequirement.objects.filter(
            installation=employee.installation,
            zone=zone,
            shift=shift,
            position=position,
            active=True,
        ).filter(
            Q(date=work_date) | Q(date__isnull=True, day_of_week=work_date.weekday())
        )
        if not requirement_query.exists():
            raise serializers.ValidationError({"position": "This position is not required for this zone and shift on this date."})

        if work_date < week_start or work_date > week_end:
            raise serializers.ValidationError(
                {"date": "Date must belong to the selected week."}
            )

        if not self._is_employee_available(employee, shift, work_date):
            raise serializers.ValidationError({"employee": "Employee is not available for this shift."})

        return attrs

    def _is_employee_available(self, employee, shift, work_date):
        time_offs = EmployeeTimeOff.objects.filter(
            employee=employee,
            status=EmployeeTimeOff.Status.APPROVED,
            start_date__lte=work_date,
            end_date__gte=work_date,
        )
        for time_off in time_offs:
            if not time_off.start_time or not time_off.end_time:
                return False
            if time_off.start_time < shift.end_time and time_off.end_time > shift.start_time:
                return False

        exceptions = EmployeeAvailabilityException.objects.filter(employee=employee, date=work_date)
        for exception in exceptions:
            if exception.available:
                continue
            if not exception.start_time or not exception.end_time:
                return False
            if exception.start_time < shift.end_time and exception.end_time > shift.start_time:
                return False

        if employee.availability_unrestricted:
            return True

        day_of_week = work_date.weekday()
        availabilities = EmployeeAvailability.objects.filter(employee=employee, day_of_week=day_of_week)
        if not availabilities.exists():
            return False

        return any(
            availability.available
            and (
                not availability.start_time
                or not availability.end_time
                or (availability.start_time <= shift.start_time and availability.end_time >= shift.end_time)
            )
            for availability in availabilities
        )


class PlanningWeekWriteSerializer(serializers.Serializer):
    assignments = PlanningWeekAssignmentWriteSerializer(many=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        company = self.context.get("company")
        week_start = self.context.get("week_start")

        if not company or not week_start:
            return

        child = self.fields["assignments"].child
        child.context.update(
            {
                "company": company,
                "week_start": week_start,
            }
        )
        child.fields["employee"].queryset = Employee.objects.filter(installation__company=company)
        child.fields["zone"].queryset = Zone.objects.filter(installation__company=company)
        child.fields["shift"].queryset = Shift.objects.filter(installation__company=company)
        child.fields["position"].queryset = Position.objects.filter(installation__company=company)

    def validate(self, attrs):
        assignments = attrs["assignments"]
        seen_keys = set()

        for assignment in assignments:
            key = (assignment["employee"].id, assignment["date"])

            if key in seen_keys:
                raise serializers.ValidationError(
                    {
                        "assignments": "Each employee can only have one assignment per day."
                    }
                )

            seen_keys.add(key)

        return attrs
