from django.urls import path

from .views import CompanyInstallationViewSet, CompanyViewSet, InstallationCreateView


company_list = CompanyViewSet.as_view({"get": "list", "post": "create"})
company_detail = CompanyViewSet.as_view(
    {"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}
)
installation_list = CompanyInstallationViewSet.as_view({"get": "list", "post": "create"})
installation_detail = CompanyInstallationViewSet.as_view(
    {"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}
)


urlpatterns = [
    path("installations/", InstallationCreateView.as_view(), name="installation-list"),
    path("companies/", company_list, name="company-list"),
    path("companies/<uuid:pk>/", company_detail, name="company-detail"),
    path("companies/<uuid:company_id>/installations/", installation_list, name="company-installation-list"),
    path("companies/<uuid:company_id>/installations/<uuid:pk>/", installation_detail, name="company-installation-detail"),
]
