from zoneinfo import ZoneInfo

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from organizations.models import CompanyMembership, Installation
from .models import (
    Employee,
    EmployeeJobRole,
    EmploymentContract,
    JobRole,
    ScheduleEntry,
    ShiftTemplate,
    StaffingRequirement,
    WorkArea,
)


def _same_installation(*objects):
    return len({item.installation_id for item in objects if item is not None}) <= 1


class InstallationScopedModelSerializer(serializers.ModelSerializer):
    employee_fields = ()
    installation_fields = ()
    job_role_fields = ()
    work_area_fields = ()
    shift_template_fields = ()
    schedule_entry_fields = ()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        installation = self.context.get("installation")
        if not installation:
            return
        for field_name in self.employee_fields:
            self.fields[field_name].queryset = Employee.objects.filter(installation=installation)
        for field_name in self.installation_fields:
            self.fields[field_name].queryset = Installation.objects.filter(pk=installation.pk)
        for field_name in self.job_role_fields:
            self.fields[field_name].queryset = JobRole.objects.filter(installation=installation)
        for field_name in self.work_area_fields:
            self.fields[field_name].queryset = WorkArea.objects.filter(installation=installation)
        for field_name in self.shift_template_fields:
            self.fields[field_name].queryset = ShiftTemplate.objects.filter(installation=installation)
        for field_name in self.schedule_entry_fields:
            self.fields[field_name].queryset = ScheduleEntry.objects.filter(employee__installation=installation)


class JobRoleSerializer(InstallationScopedModelSerializer):
    installation = serializers.PrimaryKeyRelatedField(queryset=Installation.objects.none(), required=False)

    class Meta:
        model = JobRole
        fields = ("id", "installation", "name", "code", "description", "color", "sort_order", "active", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")

    installation_fields = ("installation",)


class WorkAreaSerializer(JobRoleSerializer):
    class Meta(JobRoleSerializer.Meta):
        model = WorkArea


class ShiftTemplateSerializer(JobRoleSerializer):
    class Meta(JobRoleSerializer.Meta):
        model = ShiftTemplate
        fields = JobRoleSerializer.Meta.fields + ("start_time", "end_time", "break_minutes")


class EmployeeJobRolePayloadSerializer(serializers.Serializer):
    job_role = serializers.PrimaryKeyRelatedField(queryset=JobRole.objects.none())
    primary = serializers.BooleanField(required=False, default=False)
    proficiency = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        company = self.context.get("company")
        if company:
            self.fields["job_role"].queryset = JobRole.objects.filter(installation__company=company)


class EmploymentContractPayloadSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmploymentContract
        fields = ("id", "start_date", "end_date", "weekly_hours", "work_percentage", "calculation_period", "active")
        read_only_fields = ("id",)


class EmployeeSerializer(serializers.ModelSerializer):
    installation = serializers.PrimaryKeyRelatedField(queryset=Installation.objects.none(), required=False)
    job_roles = EmployeeJobRolePayloadSerializer(many=True, required=True, write_only=True)
    contract = EmploymentContractPayloadSerializer(required=False, allow_null=True)
    grant_quadrant_access = serializers.BooleanField(write_only=True, required=False, default=False)

    class Meta:
        model = Employee
        fields = (
            "id", "installation", "user", "employee_code", "first_name", "last_name", "email", "phone",
            "hire_date", "termination_date", "color", "active", "created_at", "updated_at", "job_roles",
            "contract", "grant_quadrant_access",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        installation = self.context.get("installation")
        if installation:
            self.fields["installation"].queryset = Installation.objects.filter(pk=installation.pk)
            self.fields["job_roles"].child.fields["job_role"].queryset = JobRole.objects.filter(installation=installation)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["job_roles"] = EmployeeJobRolePayloadSerializer(instance.employee_job_roles.select_related("job_role"), many=True).data
        contract = instance.contracts.filter(active=True).order_by("-start_date").first()
        data["contract"] = EmploymentContractPayloadSerializer(contract).data if contract else None
        return data

    def validate(self, attrs):
        installation = attrs.get("installation") or getattr(self.instance, "installation", None)
        job_roles = attrs.get("job_roles")
        if job_roles is not None:
            if not job_roles:
                raise serializers.ValidationError({"job_roles": "At least one job role is required."})
            role_ids = [item["job_role"].id for item in job_roles]
            if len(role_ids) != len(set(role_ids)):
                raise serializers.ValidationError({"job_roles": "Each job role can only be selected once."})
            if len([item for item in job_roles if item["primary"]]) > 1:
                raise serializers.ValidationError({"job_roles": "Only one primary job role is allowed."})
            if installation and any(item["job_role"].installation_id != installation.id for item in job_roles):
                raise serializers.ValidationError({"job_roles": "Job roles must belong to the employee installation."})
        if self.instance is None and job_roles is None:
            raise serializers.ValidationError({"job_roles": "At least one job role is required."})
        contract = attrs.get("contract")
        if contract and contract.get("end_date") and contract.get("start_date") and contract["end_date"] < contract["start_date"]:
            raise serializers.ValidationError({"contract": {"end_date": "End date must be on or after start date."}})
        return attrs

    def _sync_job_roles(self, employee, job_roles):
        if job_roles is None:
            return
        EmployeeJobRole.objects.filter(employee=employee).delete()
        EmployeeJobRole.objects.bulk_create([EmployeeJobRole(employee=employee, **item) for item in job_roles])

    def _sync_contract(self, employee, contract):
        if contract is None:
            return
        active_contract = employee.contracts.filter(active=True).order_by("-start_date").first()
        if active_contract:
            for key, value in contract.items():
                setattr(active_contract, key, value)
            active_contract.save()
        else:
            EmploymentContract.objects.create(employee=employee, **contract)

    @transaction.atomic
    def create(self, validated_data):
        job_roles = validated_data.pop("job_roles")
        contract = validated_data.pop("contract", None)
        validated_data.pop("grant_quadrant_access", None)
        employee = super().create(validated_data)
        self._sync_job_roles(employee, job_roles)
        self._sync_contract(employee, contract)
        return employee

    @transaction.atomic
    def update(self, instance, validated_data):
        job_roles = validated_data.pop("job_roles", None)
        contract = validated_data.pop("contract", None)
        validated_data.pop("grant_quadrant_access", None)
        employee = super().update(instance, validated_data)
        self._sync_job_roles(employee, job_roles)
        self._sync_contract(employee, contract)
        return employee


class EmploymentContractSerializer(InstallationScopedModelSerializer):
    employee = serializers.PrimaryKeyRelatedField(queryset=Employee.objects.none())

    class Meta:
        model = EmploymentContract
        fields = ("id", "employee", "start_date", "end_date", "weekly_hours", "work_percentage", "calculation_period", "active", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")

    employee_fields = ("employee",)


class ScheduleEntrySerializer(InstallationScopedModelSerializer):
    employee = serializers.PrimaryKeyRelatedField(queryset=Employee.objects.none())
    job_role = serializers.PrimaryKeyRelatedField(queryset=JobRole.objects.none())
    work_area = serializers.PrimaryKeyRelatedField(queryset=WorkArea.objects.none(), required=False, allow_null=True, default=None)
    shift_template = serializers.PrimaryKeyRelatedField(queryset=ShiftTemplate.objects.none(), required=False, allow_null=True)

    class Meta:
        model = ScheduleEntry
        fields = ("id", "employee", "date", "starts_at", "ends_at", "job_role", "work_area", "shift_template", "notes", "created_by", "created_at", "updated_at")
        read_only_fields = ("id", "created_by", "created_at", "updated_at")

    employee_fields = ("employee",)
    job_role_fields = ("job_role",)
    work_area_fields = ("work_area",)
    shift_template_fields = ("shift_template",)

    def validate(self, attrs):
        employee = attrs.get("employee", getattr(self.instance, "employee", None))
        job_role = attrs.get("job_role", getattr(self.instance, "job_role", None))
        work_area = attrs.get("work_area", getattr(self.instance, "work_area", None))
        shift_template = attrs.get("shift_template", getattr(self.instance, "shift_template", None))
        starts_at = attrs.get("starts_at", getattr(self.instance, "starts_at", None))
        ends_at = attrs.get("ends_at", getattr(self.instance, "ends_at", None))
        date = attrs.get("date", getattr(self.instance, "date", None))

        if not _same_installation(employee, job_role, work_area, shift_template):
            raise serializers.ValidationError("Employee, job role, work area, and shift template must belong to the same installation.")
        if not employee.employee_job_roles.filter(job_role=job_role).exists():
            raise serializers.ValidationError({"job_role": "The employee cannot be assigned this job role."})
        if ends_at <= starts_at:
            raise serializers.ValidationError({"ends_at": "End must be after start."})
        timezone_name = employee.installation.timezone or employee.installation.company.timezone
        local_start_date = timezone.localtime(starts_at, ZoneInfo(timezone_name)).date()
        if date != local_start_date:
            raise serializers.ValidationError({"date": "Date must match the local start date."})
        overlaps = ScheduleEntry.objects.filter(employee=employee, starts_at__lt=ends_at, ends_at__gt=starts_at)
        if self.instance:
            overlaps = overlaps.exclude(pk=self.instance.pk)
        if overlaps.exists():
            raise serializers.ValidationError({"non_field_errors": "The employee already has an overlapping schedule entry."})
        return attrs


class StaffingRequirementSerializer(InstallationScopedModelSerializer):
    shift_template = serializers.PrimaryKeyRelatedField(queryset=ShiftTemplate.objects.none())
    job_role = serializers.PrimaryKeyRelatedField(queryset=JobRole.objects.none())
    work_area = serializers.PrimaryKeyRelatedField(queryset=WorkArea.objects.none(), required=False, allow_null=True, default=None)

    class Meta:
        model = StaffingRequirement
        fields = ("id", "shift_template", "job_role", "work_area", "required_employees", "minimum_employees", "notes", "active", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")

    shift_template_fields = ("shift_template",)
    job_role_fields = ("job_role",)
    work_area_fields = ("work_area",)

    def validate(self, attrs):
        template = attrs.get("shift_template", getattr(self.instance, "shift_template", None))
        job_role = attrs.get("job_role", getattr(self.instance, "job_role", None))
        work_area = attrs.get("work_area", getattr(self.instance, "work_area", None))
        if not _same_installation(template, job_role, work_area):
            raise serializers.ValidationError("Shift template, job role, and work area must belong to the same installation.")
        required = attrs.get("required_employees", getattr(self.instance, "required_employees", None))
        minimum = attrs.get("minimum_employees", getattr(self.instance, "minimum_employees", None))
        if minimum is not None and minimum > required:
            raise serializers.ValidationError({"minimum_employees": "Minimum employees cannot exceed required employees."})
        return attrs
