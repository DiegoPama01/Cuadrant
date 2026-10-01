from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from organizations.models import Company, CompanyMembership, Installation


OPENFGA_DISABLED = {
    "ENABLED": False,
    "API_URL": "http://localhost:8080",
    "STORE_ID": "",
    "AUTHORIZATION_MODEL_ID": "",
    "API_TOKEN": "",
    "TIMEOUT_SECONDS": 5,
    "PROJECT_OBJECT": "project:cuadrant",
}


@override_settings(OPENFGA=OPENFGA_DISABLED)
class OrganizationApiTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email="owner@example.com", authentik_sub="owner-sub")
        self.member = User.objects.create_user(email="member@example.com", authentik_sub="member-sub")
        self.other = User.objects.create_user(email="other@example.com", authentik_sub="other-sub")
        self.company = Company.objects.create(name="Hotel One", slug="hotel-one")
        self.installation = Installation.objects.create(company=self.company, name="Main Hotel")
        CompanyMembership.objects.create(
            company=self.company,
            user=self.owner,
            role=CompanyMembership.Role.OWNER,
        )
        CompanyMembership.objects.create(
            company=self.company,
            user=self.member,
            role=CompanyMembership.Role.MEMBER,
        )

    def test_company_list_is_scoped_to_user_memberships(self):
        other_company = Company.objects.create(name="Other Hotel", slug="other-hotel")
        CompanyMembership.objects.create(
            company=other_company,
            user=self.other,
            role=CompanyMembership.Role.OWNER,
        )

        self.client.force_authenticate(self.owner)
        response = self.client.get("/api/companies/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["id"] for item in response.data], [str(self.company.id)])

    def test_company_create_assigns_owner_and_initial_installation(self):
        self.client.force_authenticate(self.owner)
        response = self.client.post(
            "/api/companies/",
            {
                "name": "New Group",
                "timezone": "Europe/Madrid",
                "initial_installation": {"name": "Downtown", "code": "DT"},
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        company = Company.objects.get(id=response.data["id"])
        self.assertTrue(
            CompanyMembership.objects.filter(
                company=company,
                user=self.owner,
                role=CompanyMembership.Role.OWNER,
            ).exists()
        )
        self.assertTrue(company.installations.filter(name="Downtown", code="DT").exists())

    def test_member_cannot_update_company(self):
        self.client.force_authenticate(self.member)
        response = self.client.patch(
            f"/api/companies/{self.company.id}/",
            {"name": "Changed"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_can_create_installation_inside_company(self):
        self.client.force_authenticate(self.owner)
        response = self.client.post(
            f"/api/companies/{self.company.id}/installations/",
            {"name": "Beach Hotel", "timezone": "Europe/Madrid"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(self.company.installations.filter(name="Beach Hotel").exists())

    def test_member_cannot_create_installation_inside_company(self):
        self.client.force_authenticate(self.member)
        response = self.client.post(
            f"/api/companies/{self.company.id}/installations/",
            {"name": "Beach Hotel"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_installations_are_not_available_cross_company(self):
        self.client.force_authenticate(self.other)
        response = self.client.get(f"/api/companies/{self.company.id}/installations/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
