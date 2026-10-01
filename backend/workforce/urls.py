from django.urls import path

from organizations.views import ShiftViewSet, ZoneViewSet

from .views import (
    AssignmentViewSet,
    ContractViewSet,
    EmployeeAvailabilityExceptionViewSet,
    EmployeeAvailabilityViewSet,
    EmployeePositionViewSet,
    EmployeeTimeOffViewSet,
    EmployeeViewSet,
    EmployeeZoneViewSet,
    PlanningViewSet,
    PlanningWeekView,
    PositionViewSet,
    StaffRequirementViewSet,
    TimeBalanceEntryViewSet,
)


position_list = PositionViewSet.as_view(
    {
        "get": "list",
        "post": "create",
    }
)

position_detail = PositionViewSet.as_view(
    {
        "get": "retrieve",
        "put": "update",
        "patch": "partial_update",
        "delete": "destroy",
    }
)


zone_list = ZoneViewSet.as_view(
    {
        "get": "list",
        "post": "create",
    }
)

zone_detail = ZoneViewSet.as_view(
    {
        "get": "retrieve",
        "put": "update",
        "patch": "partial_update",
        "delete": "destroy",
    }
)

shift_list = ShiftViewSet.as_view(
    {
        "get": "list",
        "post": "create",
    }
)

shift_detail = ShiftViewSet.as_view(
    {
        "get": "retrieve",
        "put": "update",
        "patch": "partial_update",
        "delete": "destroy",
    }
)

employee_list = EmployeeViewSet.as_view(
    {
        "get": "list",
        "post": "create",
    }
)

employee_detail = EmployeeViewSet.as_view(
    {
        "get": "retrieve",
        "put": "update",
        "patch": "partial_update",
        "delete": "destroy",
    }
)

contract_list = ContractViewSet.as_view({"get": "list", "post": "create"})
contract_detail = ContractViewSet.as_view({"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"})
employee_position_list = EmployeePositionViewSet.as_view({"get": "list", "post": "create"})
employee_position_detail = EmployeePositionViewSet.as_view({"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"})
employee_zone_list = EmployeeZoneViewSet.as_view({"get": "list", "post": "create"})
employee_zone_detail = EmployeeZoneViewSet.as_view({"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"})
availability_list = EmployeeAvailabilityViewSet.as_view({"get": "list", "post": "create"})
availability_detail = EmployeeAvailabilityViewSet.as_view({"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"})
availability_exception_list = EmployeeAvailabilityExceptionViewSet.as_view({"get": "list", "post": "create"})
availability_exception_detail = EmployeeAvailabilityExceptionViewSet.as_view({"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"})
time_off_list = EmployeeTimeOffViewSet.as_view({"get": "list", "post": "create"})
time_off_detail = EmployeeTimeOffViewSet.as_view({"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"})
assignment_list = AssignmentViewSet.as_view({"get": "list", "post": "create"})
assignment_detail = AssignmentViewSet.as_view({"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"})
time_balance_entry_list = TimeBalanceEntryViewSet.as_view({"get": "list", "post": "create"})
time_balance_entry_detail = TimeBalanceEntryViewSet.as_view({"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"})
staff_requirement_list = StaffRequirementViewSet.as_view({"get": "list", "post": "create"})
staff_requirement_detail = StaffRequirementViewSet.as_view({"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"})
planning_list = PlanningViewSet.as_view({"get": "list", "post": "create"})
planning_detail = PlanningViewSet.as_view({"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"})


urlpatterns = [
    path(
        "companies/<uuid:company_id>/positions/",
        position_list,
        name="position-list",
    ),
    path(
        "companies/<uuid:company_id>/positions/<uuid:pk>/",
        position_detail,
        name="position-detail",
    ),
    path(
        "companies/<uuid:company_id>/zones/",
        zone_list,
        name="zone-list",
    ),
    path(
        "companies/<uuid:company_id>/zones/<uuid:pk>/",
        zone_detail,
        name="zone-detail",
    ),
    path(
        "companies/<uuid:company_id>/shifts/",
        shift_list,
        name="shift-list",
    ),
    path(
        "companies/<uuid:company_id>/shifts/<uuid:pk>/",
        shift_detail,
        name="shift-detail",
    ),
    path(
        "companies/<uuid:company_id>/employees/",
        employee_list,
        name="employee-list",
    ),
    path(
        "companies/<uuid:company_id>/employees/<uuid:pk>/",
        employee_detail,
        name="employee-detail",
    ),
    path(
        "companies/<uuid:company_id>/planning-weeks/<str:week_start>/",
        PlanningWeekView.as_view(),
        name="planning-week-detail",
    ),
    path("companies/<uuid:company_id>/contracts/", contract_list, name="contract-list"),
    path("companies/<uuid:company_id>/contracts/<uuid:pk>/", contract_detail, name="contract-detail"),
    path("companies/<uuid:company_id>/employee-positions/", employee_position_list, name="employee-position-list"),
    path("companies/<uuid:company_id>/employee-positions/<uuid:pk>/", employee_position_detail, name="employee-position-detail"),
    path("companies/<uuid:company_id>/employee-zones/", employee_zone_list, name="employee-zone-list"),
    path("companies/<uuid:company_id>/employee-zones/<uuid:pk>/", employee_zone_detail, name="employee-zone-detail"),
    path("companies/<uuid:company_id>/employee-availabilities/", availability_list, name="employee-availability-list"),
    path("companies/<uuid:company_id>/employee-availabilities/<uuid:pk>/", availability_detail, name="employee-availability-detail"),
    path("companies/<uuid:company_id>/employee-availability-exceptions/", availability_exception_list, name="employee-availability-exception-list"),
    path("companies/<uuid:company_id>/employee-availability-exceptions/<uuid:pk>/", availability_exception_detail, name="employee-availability-exception-detail"),
    path("companies/<uuid:company_id>/employee-time-off/", time_off_list, name="employee-time-off-list"),
    path("companies/<uuid:company_id>/employee-time-off/<uuid:pk>/", time_off_detail, name="employee-time-off-detail"),
    path("companies/<uuid:company_id>/assignments/", assignment_list, name="assignment-list"),
    path("companies/<uuid:company_id>/assignments/<uuid:pk>/", assignment_detail, name="assignment-detail"),
    path("companies/<uuid:company_id>/time-balance-entries/", time_balance_entry_list, name="time-balance-entry-list"),
    path("companies/<uuid:company_id>/time-balance-entries/<uuid:pk>/", time_balance_entry_detail, name="time-balance-entry-detail"),
    path("companies/<uuid:company_id>/staff-requirements/", staff_requirement_list, name="staff-requirement-list"),
    path("companies/<uuid:company_id>/staff-requirements/<uuid:pk>/", staff_requirement_detail, name="staff-requirement-detail"),
    path("companies/<uuid:company_id>/plannings/", planning_list, name="planning-list"),
    path("companies/<uuid:company_id>/plannings/<uuid:pk>/", planning_detail, name="planning-detail"),
]
