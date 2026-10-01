from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from authorization import fga
from authorization.permissions import can_create_installation, can_manage_company, can_manage_installation
from organizations.bootstrap import _build_unique_slug
from organizations.models import Company, Installation
from organizations.serializers import CompanySerializer, InstallationSerializer, ShiftSerializer, ZoneSerializer
from organizations.models import CompanyMembership
from workforce.models import Shift, Zone


class InstallationCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = InstallationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            company = Company.objects.create(
                name=serializer.validated_data["name"],
                slug=_build_unique_slug(serializer.validated_data["name"], request.user.id),
                timezone=serializer.validated_data.get("timezone") or "UTC",
            )
            installation = Installation.objects.create(
                company=company,
                name=serializer.validated_data["name"],
                code=serializer.validated_data.get("code"),
                address=serializer.validated_data.get("address"),
                timezone=serializer.validated_data.get("timezone"),
                active=serializer.validated_data.get("active", True),
            )
            CompanyMembership.objects.create(
                company=company,
                user=request.user,
                role=CompanyMembership.Role.OWNER,
            )
        fga.provision_company(
            company_id=company.id,
            user_sub=getattr(request.user, "authentik_sub", None) or request.user.id,
        )
        fga.provision_installation(
            installation_id=installation.id,
            user_sub=getattr(request.user, "authentik_sub", None) or request.user.id,
            company_id=company.id,
        )
        return Response(
            InstallationSerializer(installation).data,
            status=status.HTTP_201_CREATED,
        )


class CompanyViewSet(viewsets.ModelViewSet):
    serializer_class = CompanySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Company.objects.filter(memberships__user=self.request.user).distinct().order_by("name")

    def perform_create(self, serializer):
        initial_installation = serializer.validated_data.pop("initial_installation", None) or {}
        with transaction.atomic():
            company = serializer.save(
                slug=_build_unique_slug(serializer.validated_data["name"], self.request.user.id),
            )
            CompanyMembership.objects.create(
                company=company,
                user=self.request.user,
                role=CompanyMembership.Role.OWNER,
            )
            installation = Installation.objects.create(
                company=company,
                name=initial_installation.get("name") or company.name,
                code=initial_installation.get("code"),
                address=initial_installation.get("address"),
                timezone=initial_installation.get("timezone") or company.timezone,
                active=initial_installation.get("active", True),
            )
        user_sub = getattr(self.request.user, "authentik_sub", None) or self.request.user.id
        fga.provision_company(company_id=company.id, user_sub=user_sub)
        fga.provision_installation(installation_id=installation.id, user_sub=user_sub, company_id=company.id)

    def perform_update(self, serializer):
        if not can_manage_company(self.request.user, self.get_object()):
            raise PermissionDenied("You do not have permission to manage this company.")
        serializer.validated_data.pop("initial_installation", None)
        serializer.save()

    def perform_destroy(self, instance):
        if not can_manage_company(self.request.user, instance):
            raise PermissionDenied("You do not have permission to manage this company.")
        instance.delete()


class CompanyInstallationViewSet(viewsets.ModelViewSet):
    serializer_class = InstallationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_company(self):
        return get_object_or_404(Company, id=self.kwargs["company_id"], memberships__user=self.request.user)

    def get_queryset(self):
        return Installation.objects.filter(company=self.get_company()).order_by("name")

    def perform_create(self, serializer):
        company = self.get_company()
        if not can_create_installation(self.request.user, company):
            raise PermissionDenied("You do not have permission to create installations for this company.")
        installation = serializer.save(company=company)
        fga.provision_installation(
            installation_id=installation.id,
            user_sub=getattr(self.request.user, "authentik_sub", None) or self.request.user.id,
            company_id=company.id,
        )
        for membership in company.memberships.filter(role__in=[CompanyMembership.Role.OWNER, CompanyMembership.Role.ADMIN]).select_related("user"):
            user_sub = getattr(membership.user, "authentik_sub", None)
            if not user_sub or membership.user_id == self.request.user.id:
                continue
            fga.provision_installation(
                installation_id=installation.id,
                user_sub=user_sub,
                company_id=company.id,
                relation="admin",
            )

    def perform_update(self, serializer):
        if not can_manage_installation(self.request.user, self.get_object()):
            raise PermissionDenied("You do not have permission to manage this installation.")
        serializer.save()

    def perform_destroy(self, instance):
        if not can_manage_installation(self.request.user, instance):
            raise PermissionDenied("You do not have permission to manage this installation.")
        instance.delete()


def get_default_installation(company):
    return company.installations.order_by("created_at").first() or Installation.objects.create(
        company=company,
        name=company.name,
        timezone=company.timezone,
        active=company.active,
    )


class ZoneViewSet(viewsets.ModelViewSet):
    serializer_class = ZoneSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_company(self):
        return get_object_or_404(
            Company,
            id=self.kwargs["company_id"],
            memberships__user=self.request.user,
        )

    def get_queryset(self):
        return Zone.objects.filter(
            installation__company=self.get_company(),
        ).select_related("installation", "installation__company").order_by("sort_order", "name")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["company"] = self.get_company()
        return context

    def perform_create(self, serializer):
        company = self.get_company()
        zone = serializer.save(
            installation=serializer.validated_data.get("installation") or get_default_installation(company),
        )
        fga.provision_installation_resource(
            resource_type="zone",
            resource_id=zone.id,
            installation_id=zone.installation_id,
        )


class ShiftViewSet(viewsets.ModelViewSet):
    serializer_class = ShiftSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_company(self):
        return get_object_or_404(
            Company,
            id=self.kwargs["company_id"],
            memberships__user=self.request.user,
        )

    def get_queryset(self):
        return Shift.objects.filter(
            installation__company=self.get_company(),
        ).select_related("installation", "installation__company").order_by("sort_order", "start_time", "name")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["company"] = self.get_company()
        return context

    def perform_create(self, serializer):
        company = self.get_company()
        shift = serializer.save(
            installation=serializer.validated_data.get("installation") or get_default_installation(company),
        )
        fga.provision_installation_resource(
            resource_type="shift",
            resource_id=shift.id,
            installation_id=shift.installation_id,
        )
