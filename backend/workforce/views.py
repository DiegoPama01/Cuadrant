from django.db import IntegrityError
from django.shortcuts import get_object_or_404
from rest_framework import permissions, serializers, viewsets

from organizations.models import Company, Installation
from .models import (
    Employee,
    EmploymentContract,
    JobRole,
    ScheduleEntry,
    ShiftTemplate,
    StaffingRequirement,
    WorkArea,
)
from .serializers import (
    EmployeeSerializer,
    EmploymentContractSerializer,
    JobRoleSerializer,
    ScheduleEntrySerializer,
    ShiftTemplateSerializer,
    StaffingRequirementSerializer,
    WorkAreaSerializer,
)


class InstallationScopedViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_company(self):
        return get_object_or_404(
            Company,
            id=self.kwargs["company_id"],
            memberships__user=self.request.user,
        )

    def get_installation(self):
        return get_object_or_404(
            Installation,
            id=self.kwargs["installation_id"],
            company=self.get_company(),
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["company"] = self.get_company()
        context["installation"] = self.get_installation()
        return context

    def perform_create(self, serializer):
        serializer.save(installation=self.get_installation())


class JobRoleViewSet(InstallationScopedViewSet):
    serializer_class = JobRoleSerializer

    def get_queryset(self):
        return JobRole.objects.filter(installation=self.get_installation())


class WorkAreaViewSet(InstallationScopedViewSet):
    serializer_class = WorkAreaSerializer

    def get_queryset(self):
        return WorkArea.objects.filter(installation=self.get_installation())


class ShiftTemplateViewSet(InstallationScopedViewSet):
    serializer_class = ShiftTemplateSerializer

    def get_queryset(self):
        return ShiftTemplate.objects.filter(installation=self.get_installation())


class EmployeeViewSet(InstallationScopedViewSet):
    serializer_class = EmployeeSerializer

    def get_queryset(self):
        return (
            Employee.objects.filter(installation=self.get_installation())
            .select_related("installation", "user")
            .prefetch_related("employee_job_roles__job_role", "contracts")
        )


class EmploymentContractViewSet(InstallationScopedViewSet):
    serializer_class = EmploymentContractSerializer

    def get_queryset(self):
        return EmploymentContract.objects.filter(
            employee__installation=self.get_installation()
        ).select_related("employee")

    def perform_create(self, serializer):
        serializer.save()


class ScheduleEntryViewSet(InstallationScopedViewSet):
    serializer_class = ScheduleEntrySerializer

    def get_queryset(self):
        return ScheduleEntry.objects.filter(
            employee__installation=self.get_installation()
        ).select_related("employee", "job_role", "work_area", "shift_template", "created_by")

    def perform_create(self, serializer):
        try:
            serializer.save(created_by=self.request.user)
        except IntegrityError as exc:
            raise serializers.ValidationError(
                {"non_field_errors": "The employee already has an overlapping schedule entry."}
            ) from exc

    def perform_update(self, serializer):
        try:
            serializer.save()
        except IntegrityError as exc:
            raise serializers.ValidationError(
                {"non_field_errors": "The employee already has an overlapping schedule entry."}
            ) from exc


class StaffingRequirementViewSet(InstallationScopedViewSet):
    serializer_class = StaffingRequirementSerializer

    def get_queryset(self):
        return StaffingRequirement.objects.filter(
            shift_template__installation=self.get_installation()
        ).select_related("shift_template", "job_role", "work_area")

    def perform_create(self, serializer):
        serializer.save()
