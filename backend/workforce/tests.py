import datetime

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from organizations.models import Company, CompanyMembership, Installation
from .models import Employee, EmployeeJobRole, JobRole, ScheduleEntry, ShiftTemplate, StaffingRequirement, WorkArea
from .serializers import ScheduleEntrySerializer, StaffingRequirementSerializer


OPENFGA_DISABLED = {
    "ENABLED": False,
    "API_URL": "http://localhost:8080",
    "STORE_ID": "test-store",
    "AUTHORIZATION_MODEL_ID": "test-model",
    "API_TOKEN": "",
    "TIMEOUT_SECONDS": 5,
    "PROJECT_OBJECT": "project:cuadrant",
}


@override_settings(OPENFGA=OPENFGA_DISABLED)
class ScheduleDomainTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(email="planner@example.com", password="password")
        self.company = Company.objects.create(name="Hotel One", slug="hotel-one", timezone="UTC")
        CompanyMembership.objects.create(company=self.company, user=self.user, role=CompanyMembership.Role.OWNER)
        self.installation = Installation.objects.create(company=self.company, name="Main", timezone="UTC")
        self.other_installation = Installation.objects.create(company=self.company, name="Annex", timezone="UTC")
        self.job_role = JobRole.objects.create(installation=self.installation, name="Chef")
        self.other_job_role = JobRole.objects.create(installation=self.other_installation, name="Chef")
        self.work_area = WorkArea.objects.create(installation=self.installation, name="Kitchen")
        self.template = ShiftTemplate.objects.create(
            installation=self.installation,
            name="Night",
            start_time=datetime.time(22),
            end_time=datetime.time(6),
        )
        self.employee = Employee.objects.create(installation=self.installation, first_name="Alex")
        EmployeeJobRole.objects.create(employee=self.employee, job_role=self.job_role, primary=True)
        self.client.force_authenticate(self.user)

    def serializer(self, data, instance=None):
        return ScheduleEntrySerializer(
            instance=instance,
            data=data,
            context={"company": self.company, "installation": self.installation},
        )

    def schedule_payload(self, **overrides):
        payload = {
            "employee": str(self.employee.id),
            "job_role": str(self.job_role.id),
            "date": "2026-10-12",
            "starts_at": "2026-10-12T22:00:00Z",
            "ends_at": "2026-10-13T06:00:00Z",
        }
        payload.update(overrides)
        return payload

    def test_catalog_resources_do_not_expose_code(self):
        resources = (
            (
                "job-roles",
                {"installation": str(self.installation.id), "name": "Server", "color": "#2563eb", "active": True},
            ),
            (
                "work-areas",
                {"installation": str(self.installation.id), "name": "Patio", "color": "#16a34a", "active": True},
            ),
            (
                "shift-templates",
                {
                    "name": "Day",
                    "installation": str(self.installation.id),
                    "color": "#f97316",
                    "start_time": "08:00",
                    "end_time": "16:00",
                    "active": True,
                },
            ),
        )

        for resource, payload in resources:
            with self.subTest(resource=resource):
                response = self.client.post(
                    f"/api/companies/{self.company.id}/installations/{self.installation.id}/{resource}/",
                    payload,
                    format="json",
                )

                self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
                self.assertNotIn("code", response.data)

    def test_schedule_entry_accepts_night_shift_without_template_or_work_area(self):
        serializer = self.serializer(self.schedule_payload())

        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_schedule_entry_rejects_job_role_not_held_by_employee(self):
        unassigned_role = JobRole.objects.create(installation=self.installation, name="Waiter")
        serializer = self.serializer(self.schedule_payload(job_role=str(unassigned_role.id)))

        self.assertFalse(serializer.is_valid())
        self.assertIn("job_role", serializer.errors)

    def test_schedule_entry_rejects_cross_installation_references(self):
        serializer = self.serializer(self.schedule_payload(job_role=str(self.other_job_role.id)))

        self.assertFalse(serializer.is_valid())
        self.assertIn("job_role", serializer.errors)

    def test_schedule_entry_allows_contiguous_entries_and_rejects_overlap(self):
        ScheduleEntry.objects.create(
            employee=self.employee,
            job_role=self.job_role,
            date=datetime.date(2026, 10, 12),
            starts_at=datetime.datetime(2026, 10, 12, 8, tzinfo=datetime.UTC),
            ends_at=datetime.datetime(2026, 10, 12, 12, tzinfo=datetime.UTC),
        )
        contiguous = self.serializer(self.schedule_payload(
            date="2026-10-12",
            starts_at="2026-10-12T12:00:00Z",
            ends_at="2026-10-12T16:00:00Z",
        ))
        overlap = self.serializer(self.schedule_payload(
            date="2026-10-12",
            starts_at="2026-10-12T11:00:00Z",
            ends_at="2026-10-12T13:00:00Z",
        ))

        self.assertTrue(contiguous.is_valid(), contiguous.errors)
        self.assertFalse(overlap.is_valid())
        self.assertIn("non_field_errors", overlap.errors)

    def test_schedule_entry_date_must_match_local_start_date(self):
        serializer = self.serializer(self.schedule_payload(date="2026-10-13"))

        self.assertFalse(serializer.is_valid())
        self.assertIn("date", serializer.errors)

    def test_employee_can_be_created_with_job_roles_and_without_contract(self):
        response = self.client.post(
            reverse("employee-list", kwargs={"company_id": self.company.id, "installation_id": self.installation.id}),
            {"first_name": "Maria", "job_roles": [{"job_role": str(self.job_role.id), "primary": True}]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        employee = Employee.objects.get(first_name="Maria")
        self.assertTrue(EmployeeJobRole.objects.filter(employee=employee, job_role=self.job_role).exists())
        self.assertFalse(employee.contracts.exists())

    def test_schedule_entry_api_creates_assignment_without_optional_resources(self):
        response = self.client.post(
            reverse("schedule-entry-list", kwargs={"company_id": self.company.id, "installation_id": self.installation.id}),
            self.schedule_payload(),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        entry = ScheduleEntry.objects.get(id=response.data["id"])
        self.assertIsNone(entry.work_area)
        self.assertIsNone(entry.shift_template)

    def test_staffing_requirement_belongs_to_optional_template_configuration(self):
        serializer = StaffingRequirementSerializer(
            data={
                "shift_template": str(self.template.id),
                "job_role": str(self.job_role.id),
                "required_employees": 2,
            },
            context={"company": self.company, "installation": self.installation},
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        requirement = serializer.save()
        self.assertEqual(requirement.shift_template, self.template)
        self.assertIsNone(requirement.work_area)
