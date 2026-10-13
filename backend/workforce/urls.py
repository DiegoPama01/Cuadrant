from django.urls import path

from .views import (
    EmployeeViewSet,
    EmploymentContractViewSet,
    JobRoleViewSet,
    ScheduleEntryViewSet,
    ShiftTemplateViewSet,
    StaffingRequirementViewSet,
    WorkAreaViewSet,
)


def resource_views(viewset):
    return (
        viewset.as_view({"get": "list", "post": "create"}),
        viewset.as_view({"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}),
    )


job_role_list, job_role_detail = resource_views(JobRoleViewSet)
work_area_list, work_area_detail = resource_views(WorkAreaViewSet)
shift_template_list, shift_template_detail = resource_views(ShiftTemplateViewSet)
employee_list, employee_detail = resource_views(EmployeeViewSet)
employment_contract_list, employment_contract_detail = resource_views(EmploymentContractViewSet)
schedule_entry_list, schedule_entry_detail = resource_views(ScheduleEntryViewSet)
staffing_requirement_list, staffing_requirement_detail = resource_views(StaffingRequirementViewSet)

PREFIX = "companies/<uuid:company_id>/installations/<uuid:installation_id>/"

urlpatterns = [
    path(PREFIX + "job-roles/", job_role_list, name="job-role-list"),
    path(PREFIX + "job-roles/<uuid:pk>/", job_role_detail, name="job-role-detail"),
    path(PREFIX + "work-areas/", work_area_list, name="work-area-list"),
    path(PREFIX + "work-areas/<uuid:pk>/", work_area_detail, name="work-area-detail"),
    path(PREFIX + "shift-templates/", shift_template_list, name="shift-template-list"),
    path(PREFIX + "shift-templates/<uuid:pk>/", shift_template_detail, name="shift-template-detail"),
    path(PREFIX + "employees/", employee_list, name="employee-list"),
    path(PREFIX + "employees/<uuid:pk>/", employee_detail, name="employee-detail"),
    path(PREFIX + "employment-contracts/", employment_contract_list, name="employment-contract-list"),
    path(PREFIX + "employment-contracts/<uuid:pk>/", employment_contract_detail, name="employment-contract-detail"),
    path(PREFIX + "schedule-entries/", schedule_entry_list, name="schedule-entry-list"),
    path(PREFIX + "schedule-entries/<uuid:pk>/", schedule_entry_detail, name="schedule-entry-detail"),
    path(PREFIX + "staffing-requirements/", staffing_requirement_list, name="staffing-requirement-list"),
    path(PREFIX + "staffing-requirements/<uuid:pk>/", staffing_requirement_detail, name="staffing-requirement-detail"),
]
