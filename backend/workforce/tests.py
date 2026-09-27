from types import SimpleNamespace
from unittest.mock import call, patch

import datetime

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.test import SimpleTestCase, override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from authorization import fga
from authorization.client import OpenFGAError, TupleKey
from authorization.permissions import can_access_planning_resource
from organizations.models import Company, CompanyMembership, Installation
from .models import Assignment, Contract, Employee, EmployeeAvailability, EmployeePosition, EmployeeZone, Position, Shift, StaffRequirement, Zone
from .serializers import AssignmentSerializer, EmployeePositionSerializer, PlanningWeekAssignmentWriteSerializer, StaffRequirementSerializer


OPENFGA_ENABLED = {
    "ENABLED": True,
    "API_URL": "http://localhost:8080",
    "STORE_ID": "test-store",
    "AUTHORIZATION_MODEL_ID": "test-model",
    "API_TOKEN": "",
    "TIMEOUT_SECONDS": 5,
    "PROJECT_OBJECT": "project:cuadrant",
}

OPENFGA_DISABLED = {
    **OPENFGA_ENABLED,
    "ENABLED": False,
}


class OpenFGAPlanningPermissionTests(SimpleTestCase):
    def test_provision_planning_resource_writes_expected_relationships(self):
        with patch.object(fga, "_write_if_missing") as write_if_missing:
            fga.provision_planning_resource(
                resource_type="assignment",
                resource_id="assignment-1",
                installation_id="installation-1",
                employee_id="employee-1",
                position_id="position-1",
                zone_id="zone-1",
                shift_id="shift-1",
                created_by_sub="manager-sub",
            )

        write_if_missing.assert_has_calls(
            [
                call(TupleKey("installation:installation-1", "installation", "assignment:assignment-1")),
                call(TupleKey("employee:employee-1", "employee", "assignment:assignment-1")),
                call(TupleKey("position:position-1", "position", "assignment:assignment-1")),
                call(TupleKey("zone:zone-1", "zone", "assignment:assignment-1")),
                call(TupleKey("shift:shift-1", "shift", "assignment:assignment-1")),
                call(TupleKey("user:manager-sub", "created_by", "assignment:assignment-1")),
            ]
        )

    def test_provision_employee_resource_writes_user_link(self):
        with patch.object(fga, "_write_if_missing") as write_if_missing:
            fga.provision_installation_resource(
                resource_type="employee",
                resource_id="employee-1",
                installation_id="installation-1",
                user_sub="employee-sub",
            )

        write_if_missing.assert_has_calls(
            [
                call(TupleKey("installation:installation-1", "installation", "employee:employee-1")),
                call(TupleKey("user:employee-sub", "user", "employee:employee-1")),
            ]
        )

    @override_settings(OPENFGA=OPENFGA_ENABLED)
    def test_can_access_planning_resource_maps_action_to_openfga_relation(self):
        user = SimpleNamespace(id="local-id", authentik_sub="manager-sub")

        with patch.object(fga, "check", return_value=True) as check:
            allowed = can_access_planning_resource(
                user,
                resource_type="employee_time_off",
                resource_id="time-off-1",
                action="approve",
            )

        self.assertTrue(allowed)
        check.assert_called_once_with(
            user="user:manager-sub",
            relation="can_approve",
            object="employee_time_off:time-off-1",
        )

    def test_can_access_planning_resource_rejects_unknown_resource_type(self):
        user = SimpleNamespace(id="local-id", authentik_sub="manager-sub")

        with self.assertRaises(ValueError):
            can_access_planning_resource(
                user,
                resource_type="unknown",
                resource_id="resource-1",
                action="view",
            )

    def test_provisioning_ignores_authorization_model_mismatch(self):
        with patch.object(
            fga,
            "check",
            side_effect=OpenFGAError(
                "OpenFGA request failed with status 400: {\"code\":\"validation_error\",\"message\":\"invalid relation: type 'position' not found\"}"
            ),
        ), patch.object(fga, "write") as write:
            fga.provision_installation_resource(
                resource_type="position",
                resource_id="position-1",
                installation_id="installation-1",
            )

        write.assert_not_called()


@override_settings(OPENFGA=OPENFGA_DISABLED)
class WorkforceInfrastructureTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(email="planner@example.com", password="password")
        self.other_user = user_model.objects.create_user(email="other@example.com", password="password")
        self.company = Company.objects.create(name="Hotel One", slug="hotel-one")
        self.other_company = Company.objects.create(name="Hotel Two", slug="hotel-two")
        CompanyMembership.objects.create(company=self.company, user=self.user, role=CompanyMembership.Role.OWNER)
        CompanyMembership.objects.create(company=self.other_company, user=self.other_user, role=CompanyMembership.Role.OWNER)
        self.installation = Installation.objects.create(company=self.company, name="Main")
        self.other_installation = Installation.objects.create(company=self.other_company, name="Other")
        self.position = Position.objects.create(installation=self.installation, name="Chef")
        self.other_position = Position.objects.create(installation=self.other_installation, name="Chef")
        self.zone = Zone.objects.create(installation=self.installation, name="Kitchen")
        self.shift = Shift.objects.create(
            installation=self.installation,
            name="Morning",
            start_time=datetime.time(8, 0),
            end_time=datetime.time(16, 0),
        )
        self.employee = Employee.objects.create(
            installation=self.installation,
            first_name="Alex",
            last_name="Planner",
            position=self.position,
        )
        self.client.force_authenticate(self.user)

    def test_employee_position_requires_same_installation(self):
        serializer = EmployeePositionSerializer(
            data={"employee": self.employee.id, "position": self.other_position.id, "primary": True},
            context={"company": self.company},
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("position", serializer.errors)

    def test_assignment_requires_related_resources_in_same_installation(self):
        serializer = AssignmentSerializer(
            data={
                "employee": self.employee.id,
                "date": "2026-09-28",
                "shift": self.shift.id,
                "zone": self.zone.id,
                "position": self.other_position.id,
            },
            context={"company": self.company},
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("position", serializer.errors)

    def test_staff_requirement_requires_exactly_one_day_or_date(self):
        serializer = StaffRequirementSerializer(
            data={
                "installation": self.installation.id,
                "zone": self.zone.id,
                "shift": self.shift.id,
                "position": self.position.id,
                "day_of_week": 0,
                "date": "2026-09-28",
                "required_employees": 2,
            },
            context={"company": self.company},
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("non_field_errors", serializer.errors)

    def test_contract_endpoint_is_scoped_to_company_membership(self):
        response = self.client.post(
            reverse("contract-list", kwargs={"company_id": self.company.id}),
            {
                "employee": str(self.employee.id),
                "start_date": "2026-10-01",
                "weekly_hours": "40.00",
                "work_percentage": 100,
                "active": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        other_response = self.client.get(reverse("contract-list", kwargs={"company_id": self.other_company.id}))
        self.assertEqual(other_response.status_code, status.HTTP_404_NOT_FOUND)

    def test_zone_form_persists_staff_requirements_for_each_weekday(self):
        response = self.client.post(
            reverse("zone-list", kwargs={"company_id": self.company.id}),
            {
                "installation": str(self.installation.id),
                "name": "Breakfast",
                "color": "#123456",
                "staff_requirements": [{
                    "shift": str(self.shift.id),
                    "positions": [{"position": str(self.position.id), "required_count": 2}],
                }],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        zone = Zone.objects.get(id=response.data["id"])
        requirements = StaffRequirement.objects.filter(zone=zone, shift=self.shift, position=self.position)
        self.assertEqual(requirements.count(), 7)
        self.assertEqual(set(requirements.values_list("required_employees", flat=True)), {2})
        self.assertEqual(response.data["staff_requirements"][0]["positions"][0]["required_count"], 2)

    def test_employee_endpoint_creates_composite_form_payload(self):
        payload = {
            "installation": str(self.installation.id),
            "first_name": "Maria",
            "last_name": "Cook",
            "email": "maria@example.com",
            "phone": "+34 600 000 000",
            "color": "#ffaa00",
            "active": True,
            "all_zones": False,
            "availability_unrestricted": False,
            "contract": {
                "start_date": "2026-10-01",
                "weekly_hours": "35.00",
                "active": True,
            },
            "employee_positions": [
                {"position": str(self.position.id), "primary": True},
            ],
            "employee_zones": [
                {"zone": str(self.zone.id), "preferred": True},
            ],
            "availabilities": [
                {"day_of_week": 0, "available": True, "start_time": "09:00:00", "end_time": "17:00:00"},
            ],
        }

        response = self.client.post(reverse("employee-list", kwargs={"company_id": self.company.id}), payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        employee = Employee.objects.get(email="maria@example.com")
        self.assertFalse(employee.all_zones)
        self.assertFalse(employee.availability_unrestricted)
        self.assertTrue(Contract.objects.filter(employee=employee, weekly_hours="35.00", active=True).exists())
        self.assertTrue(EmployeePosition.objects.filter(employee=employee, position=self.position, primary=True).exists())
        self.assertTrue(EmployeeZone.objects.filter(employee=employee, zone=self.zone, preferred=True).exists())
        self.assertTrue(EmployeeAvailability.objects.filter(employee=employee, day_of_week=0).exists())
        self.assertTrue(employee.allowed_zones.filter(id=self.zone.id).exists())

    def test_employee_composite_rejects_multiple_primary_positions(self):
        second_position = Position.objects.create(installation=self.installation, name="Waiter")
        response = self.client.post(
            reverse("employee-list", kwargs={"company_id": self.company.id}),
            {
                "installation": str(self.installation.id),
                "first_name": "Sam",
                "employee_positions": [
                    {"position": str(self.position.id), "primary": True},
                    {"position": str(second_position.id), "primary": True},
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("employee_positions", response.data)

    def test_all_zones_employee_can_be_assigned_without_allowed_zone_row(self):
        self.employee.all_zones = True
        self.employee.save(update_fields=["all_zones"])
        EmployeePosition.objects.create(employee=self.employee, position=self.position, primary=True)
        StaffRequirement.objects.create(
            installation=self.installation,
            zone=self.zone,
            shift=self.shift,
            position=self.position,
            day_of_week=0,
            required_employees=1,
        )
        serializer = PlanningWeekAssignmentWriteSerializer(
            data={
                "employee": self.employee.id,
                "date": "2026-09-28",
                "shift": self.shift.id,
                "zone": self.zone.id,
                "position": self.position.id,
            },
            context={"company": self.company, "week_start": datetime.date(2026, 9, 28)},
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_planning_week_writes_new_assignments_and_returns_staff_requirements(self):
        EmployeePosition.objects.create(employee=self.employee, position=self.position, primary=True)
        requirement = StaffRequirement.objects.create(
            installation=self.installation,
            zone=self.zone,
            shift=self.shift,
            position=self.position,
            day_of_week=0,
            required_employees=1,
        )
        response = self.client.put(
            reverse("planning-week-detail", kwargs={"company_id": self.company.id, "week_start": "2026-09-28"}),
            {
                "assignments": [{
                    "employee": str(self.employee.id),
                    "date": "2026-09-28",
                    "zone": str(self.zone.id),
                    "shift": str(self.shift.id),
                    "position": str(self.position.id),
                }],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertTrue(Assignment.objects.filter(
            employee=self.employee,
            date="2026-09-28",
            position=self.position,
        ).exists())
        self.assertEqual(response.data["assignments"][0]["position"], str(self.position.id))
        self.assertIn(str(requirement.id), {item["id"] for item in response.data["staff_requirements"]})

    def test_grant_quadrant_access_creates_member_membership_for_employee_user(self):
        user_model = get_user_model()
        employee_user = user_model.objects.create_user(email="employee-access@example.com", password="password")
        response = self.client.post(
            reverse("employee-list", kwargs={"company_id": self.company.id}),
            {
                "installation": str(self.installation.id),
                "user": str(employee_user.id),
                "first_name": "Access",
                "grant_quadrant_access": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertTrue(
            CompanyMembership.objects.filter(
                company=self.company,
                user=employee_user,
                role=CompanyMembership.Role.MEMBER,
            ).exists()
        )
