import datetime

from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import permissions, serializers, status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from organizations.models import Company, CompanyMembership, Installation
from authorization import fga
from authorization.permissions import (
    InstallationPlanningPermission,
    OpenFGAPlanningResourcePermission,
    can_access_planning_resource,
    can_access_installation_planning,
)
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
    StaffRequirement,
    TimeBalanceEntry,
)
from .serializers import (
    AssignmentSerializer,
    ContractSerializer,
    EmployeeSerializer,
    EmployeeAvailabilityExceptionSerializer,
    EmployeeAvailabilitySerializer,
    EmployeePositionSerializer,
    EmployeeTimeOffSerializer,
    EmployeeZoneSerializer,
    PlanningSerializer,
    PlanningWeekSerializer,
    PlanningWeekWriteSerializer,
    PositionSerializer,
    StaffRequirementSerializer,
    TimeBalanceEntrySerializer,
)


class CompanyScopedViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_company(self):
        return get_object_or_404(Company, id=self.kwargs["company_id"], memberships__user=self.request.user)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["company"] = self.get_company()
        return context

    def perform_create(self, serializer):
        serializer.save(company=self.get_company())


class OpenFGAPlanningResourceViewSet(CompanyScopedViewSet):
    permission_classes = [permissions.IsAuthenticated, OpenFGAPlanningResourcePermission]
    openfga_resource_type = None

    def _get_create_installation(self, serializer):
        data = serializer.validated_data
        if data.get("installation"):
            return data["installation"]
        if data.get("employee"):
            return data["employee"].installation
        return None

    def _check_create_permission(self, serializer):
        installation = self._get_create_installation(serializer)
        if installation and not can_access_installation_planning(
            self.request.user,
            installation_id=installation.id,
            action="edit",
        ):
            raise PermissionDenied("You do not have permission to edit this installation's planning.")

    def _user_sub(self, user=None):
        user = user or self.request.user
        return getattr(user, "authentik_sub", None) or user.id

    def _provision_instance(self, instance):
        if not self.openfga_resource_type:
            return

        employee = getattr(instance, "employee", None)
        installation = getattr(instance, "installation", None) or getattr(employee, "installation", None)
        if not installation:
            return

        fga.provision_planning_resource(
            resource_type=self.openfga_resource_type,
            resource_id=instance.id,
            installation_id=installation.id,
            employee_id=getattr(employee, "id", None),
            position_id=getattr(getattr(instance, "position", None), "id", None),
            zone_id=getattr(getattr(instance, "zone", None), "id", None),
            shift_id=getattr(getattr(instance, "shift", None), "id", None),
            created_by_sub=self._user_sub(instance.created_by) if getattr(instance, "created_by", None) else None,
            published_by_sub=self._user_sub(instance.published_by) if getattr(instance, "published_by", None) else None,
        )

    def perform_create(self, serializer):
        self._check_create_permission(serializer)
        instance = serializer.save()
        self._provision_instance(instance)


def get_default_installation(company):
    return company.installations.order_by("created_at").first() or Installation.objects.create(
        company=company,
        name=company.name,
        timezone=company.timezone,
        active=company.active,
    )


class CreatedByCompanyScopedViewSet(CompanyScopedViewSet):
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ContractViewSet(OpenFGAPlanningResourceViewSet):
    serializer_class = ContractSerializer
    openfga_resource_type = "contract"

    def get_queryset(self):
        return Contract.objects.filter(employee__installation__company=self.get_company()).select_related("employee", "employee__installation")


class EmployeePositionViewSet(OpenFGAPlanningResourceViewSet):
    serializer_class = EmployeePositionSerializer
    openfga_resource_type = "employee_position"

    def get_queryset(self):
        return EmployeePosition.objects.filter(employee__installation__company=self.get_company()).select_related("employee", "position")


class EmployeeZoneViewSet(OpenFGAPlanningResourceViewSet):
    serializer_class = EmployeeZoneSerializer
    openfga_resource_type = "employee_zone"

    def get_queryset(self):
        return EmployeeZone.objects.filter(employee__installation__company=self.get_company()).select_related("employee", "zone")


class EmployeeAvailabilityViewSet(OpenFGAPlanningResourceViewSet):
    serializer_class = EmployeeAvailabilitySerializer
    openfga_resource_type = "employee_availability"

    def get_queryset(self):
        return EmployeeAvailability.objects.filter(employee__installation__company=self.get_company()).select_related("employee")


class EmployeeAvailabilityExceptionViewSet(OpenFGAPlanningResourceViewSet):
    serializer_class = EmployeeAvailabilityExceptionSerializer
    openfga_resource_type = "employee_availability_exception"

    def get_queryset(self):
        return EmployeeAvailabilityException.objects.filter(employee__installation__company=self.get_company()).select_related("employee")


class EmployeeTimeOffViewSet(OpenFGAPlanningResourceViewSet):
    serializer_class = EmployeeTimeOffSerializer
    openfga_resource_type = "employee_time_off"

    def get_queryset(self):
        return EmployeeTimeOff.objects.filter(employee__installation__company=self.get_company()).select_related("employee", "created_by")

    def perform_create(self, serializer):
        self._check_create_permission(serializer)
        instance = serializer.save(created_by=self.request.user)
        self._provision_instance(instance)

    def perform_update(self, serializer):
        status = serializer.validated_data.get("status")
        if status == EmployeeTimeOff.Status.APPROVED and not can_access_planning_resource(
            self.request.user,
            resource_type=self.openfga_resource_type,
            resource_id=self.get_object().id,
            action="approve",
        ):
            raise PermissionDenied("You do not have permission to approve this time off request.")
        serializer.save()


class AssignmentViewSet(OpenFGAPlanningResourceViewSet):
    serializer_class = AssignmentSerializer
    openfga_resource_type = "assignment"

    def get_queryset(self):
        return Assignment.objects.filter(employee__installation__company=self.get_company()).select_related("employee", "shift", "zone", "position", "created_by")

    def perform_create(self, serializer):
        self._check_create_permission(serializer)
        instance = serializer.save(created_by=self.request.user)
        self._provision_instance(instance)


class TimeBalanceEntryViewSet(OpenFGAPlanningResourceViewSet):
    serializer_class = TimeBalanceEntrySerializer
    openfga_resource_type = "time_balance_entry"

    def get_queryset(self):
        return TimeBalanceEntry.objects.filter(employee__installation__company=self.get_company()).select_related("employee", "assignment", "time_off", "created_by")

    def perform_create(self, serializer):
        self._check_create_permission(serializer)
        instance = serializer.save(created_by=self.request.user)
        self._provision_instance(instance)


class StaffRequirementViewSet(OpenFGAPlanningResourceViewSet):
    serializer_class = StaffRequirementSerializer
    openfga_resource_type = "staff_requirement"

    def get_queryset(self):
        return StaffRequirement.objects.filter(installation__company=self.get_company()).select_related("installation", "zone", "shift", "position")


class PlanningViewSet(OpenFGAPlanningResourceViewSet):
    serializer_class = PlanningSerializer
    openfga_resource_type = "planning"

    def get_queryset(self):
        return Planning.objects.filter(installation__company=self.get_company()).select_related("installation", "published_by")

    def perform_create(self, serializer):
        self._check_create_permission(serializer)
        instance = serializer.save(published_by=self.request.user if serializer.validated_data.get("status") == Planning.Status.PUBLISHED else None)
        self._provision_instance(instance)

    def perform_update(self, serializer):
        status = serializer.validated_data.get("status")
        if status == Planning.Status.PUBLISHED and not can_access_planning_resource(
            self.request.user,
            resource_type=self.openfga_resource_type,
            resource_id=self.get_object().id,
            action="publish",
        ):
            raise PermissionDenied("You do not have permission to publish this planning.")
        serializer.save(published_by=self.request.user if status == Planning.Status.PUBLISHED else getattr(serializer.instance, "published_by", None))


class PositionViewSet(viewsets.ModelViewSet):
    serializer_class = PositionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_company(self):
        return get_object_or_404(
            Company,
            id=self.kwargs["company_id"],
            memberships__user=self.request.user,
        )

    def get_queryset(self):
        company = self.get_company()

        return Position.objects.filter(
            installation__company=company,
        ).select_related("installation", "installation__company").order_by("sort_order", "name")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["company"] = self.get_company()
        return context

    def perform_create(self, serializer):
        company = self.get_company()
        position = serializer.save(
            installation=serializer.validated_data.get("installation") or get_default_installation(company),
        )
        fga.provision_installation_resource(
            resource_type="position",
            resource_id=position.id,
            installation_id=position.installation_id,
        )


class EmployeeViewSet(viewsets.ModelViewSet):
    serializer_class = EmployeeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_company(self):
        return get_object_or_404(
            Company,
            id=self.kwargs["company_id"],
            memberships__user=self.request.user,
        )

    def get_queryset(self):
        return (
            Employee.objects.filter(installation__company=self.get_company())
            .select_related("installation", "installation__company", "position", "user")
            .prefetch_related(
                "allowed_zones",
                "contracts",
                "employee_positions",
                "employee_positions__position",
                "employee_zones",
                "employee_zones__zone",
                "availabilities",
            )
            .order_by("first_name", "last_name")
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["company"] = self.get_company()
        return context

    def perform_create(self, serializer):
        company = self.get_company()
        employee = serializer.save(
            installation=serializer.validated_data.get("installation") or get_default_installation(company),
        )
        self._provision_employee_and_related(employee)

    def perform_update(self, serializer):
        employee = serializer.save()
        self._provision_employee_and_related(employee)

    def _user_sub(self, user):
        return getattr(user, "authentik_sub", None) or user.id

    def _provision_employee_and_related(self, employee):
        fga.provision_installation_resource(
            resource_type="employee",
            resource_id=employee.id,
            installation_id=employee.installation_id,
            user_sub=getattr(employee.user, "authentik_sub", None) or employee.user_id if employee.user_id else None,
        )
        if employee.user_id and CompanyMembership.objects.filter(company=employee.company, user=employee.user).exists():
            fga.provision_company(
                company_id=employee.company_id,
                user_sub=self._user_sub(employee.user),
                relation="member",
            )

        for contract in employee.contracts.all():
            fga.provision_planning_resource(
                resource_type="contract",
                resource_id=contract.id,
                installation_id=employee.installation_id,
                employee_id=employee.id,
            )
        for employee_position in employee.employee_positions.select_related("position"):
            fga.provision_planning_resource(
                resource_type="employee_position",
                resource_id=employee_position.id,
                installation_id=employee.installation_id,
                employee_id=employee.id,
                position_id=employee_position.position_id,
            )
        for employee_zone in employee.employee_zones.select_related("zone"):
            fga.provision_planning_resource(
                resource_type="employee_zone",
                resource_id=employee_zone.id,
                installation_id=employee.installation_id,
                employee_id=employee.id,
                zone_id=employee_zone.zone_id,
            )
        for availability in employee.availabilities.all():
            fga.provision_planning_resource(
                resource_type="employee_availability",
                resource_id=availability.id,
                installation_id=employee.installation_id,
                employee_id=employee.id,
            )


class PlanningWeekView(APIView):
    permission_classes = [permissions.IsAuthenticated, InstallationPlanningPermission]

    def get_company(self):
        return get_object_or_404(
            Company,
            id=self.kwargs["company_id"],
            memberships__user=self.request.user,
        )

    def get_week_start(self):
        try:
            week_start = datetime.date.fromisoformat(self.kwargs["week_start"])
        except ValueError as exc:
            raise serializers.ValidationError(
                {"week_start": "Week start must be a valid ISO date."}
            ) from exc

        if week_start.weekday() != 0:
            raise serializers.ValidationError(
                {"week_start": "Week start must be a Monday."}
            )

        return week_start

    def get_queryset(self):
        company = self.get_company()
        week_start = self.get_week_start()
        week_end = week_start + datetime.timedelta(days=6)

        return Assignment.objects.filter(
            employee__installation__company=company,
            date__range=(week_start, week_end),
        ).select_related("employee", "zone", "shift", "position")

    def get_staff_requirements(self, company, week_start):
        week_end = week_start + datetime.timedelta(days=6)
        weekdays = [(week_start + datetime.timedelta(days=offset)).weekday() for offset in range(7)]
        return StaffRequirement.objects.filter(
            installation__company=company,
            active=True,
        ).filter(
            Q(date__range=(week_start, week_end))
            | Q(date__isnull=True, day_of_week__in=weekdays)
        ).select_related("installation", "zone", "shift", "position")

    def get(self, request, *args, **kwargs):
        week_start = self.get_week_start()
        serializer = PlanningWeekSerializer(
            {
                "week_start": week_start,
                "week_end": week_start + datetime.timedelta(days=6),
                "assignments": self.get_queryset(),
                "requirements": self.get_staff_requirements(self.get_company(), week_start),
                "staff_requirements": self.get_staff_requirements(self.get_company(), week_start),
            }
        )
        return Response(serializer.data)

    def put(self, request, *args, **kwargs):
        company = self.get_company()
        week_start = self.get_week_start()
        serializer = PlanningWeekWriteSerializer(
            data=request.data,
            context={
                "company": company,
                "week_start": week_start,
            },
        )
        serializer.is_valid(raise_exception=True)

        assignments_data = serializer.validated_data["assignments"]
        existing_assignments = {(assignment.employee_id, assignment.date): assignment for assignment in self.get_queryset()}
        seen_keys = set()
        saved_assignments = []

        with transaction.atomic():
            for assignment_data in assignments_data:
                key = (assignment_data["employee"].id, assignment_data["date"])
                seen_keys.add(key)
                instance = existing_assignments.get(key)

                if instance is None:
                    instance = Assignment(
                        employee=assignment_data["employee"],
                        date=assignment_data["date"],
                    )

                instance.zone = assignment_data["zone"]
                instance.shift = assignment_data["shift"]
                instance.position = assignment_data["position"]
                instance.notes = assignment_data.get("notes", "")
                instance.created_by = instance.created_by or request.user
                instance.save()
                saved_assignments.append(instance)
                fga.provision_planning_resource(
                    resource_type="assignment",
                    resource_id=instance.id,
                    installation_id=instance.employee.installation_id,
                    employee_id=instance.employee_id,
                    position_id=instance.position_id,
                    zone_id=instance.zone_id,
                    shift_id=instance.shift_id,
                    created_by_sub=getattr(request.user, "authentik_sub", None) or request.user.id,
                )

            for key, instance in existing_assignments.items():
                if key not in seen_keys:
                    instance.delete()

        response_serializer = PlanningWeekSerializer(
            {
                "week_start": week_start,
                "week_end": week_start + datetime.timedelta(days=6),
                "assignments": saved_assignments,
                "requirements": self.get_staff_requirements(company, week_start),
                "staff_requirements": self.get_staff_requirements(company, week_start),
            }
        )
        return Response(response_serializer.data, status=status.HTTP_200_OK)
