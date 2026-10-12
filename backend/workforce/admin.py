from django.contrib import admin

from .models import (
    Employee,
    EmployeeAvailability,
    EmployeeAvailabilityException,
    EmployeeJobRole,
    EmployeeTimeOff,
    EmployeeZone,
    EmploymentContract,
    JobRole,
    ScheduleEntry,
    ShiftTemplate,
    StaffingRequirement,
    TimeBalanceEntry,
    WorkArea,
)


@admin.register(JobRole, WorkArea)
class InstallationResourceAdmin(admin.ModelAdmin):
    list_display = ("name", "installation", "code", "active")
    list_filter = ("installation__company", "installation", "active")


@admin.register(ShiftTemplate)
class ShiftTemplateAdmin(InstallationResourceAdmin):
    list_display = ("name", "installation", "start_time", "end_time", "active")


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ("first_name", "last_name", "installation", "employee_code", "active")
    list_filter = ("installation__company", "installation", "active")
    search_fields = ("first_name", "last_name", "employee_code", "email")


admin.site.register(EmploymentContract)
admin.site.register(EmployeeJobRole)
admin.site.register(EmployeeZone)
admin.site.register(EmployeeAvailability)
admin.site.register(EmployeeAvailabilityException)
admin.site.register(EmployeeTimeOff)
admin.site.register(TimeBalanceEntry)
admin.site.register(ScheduleEntry)
admin.site.register(StaffingRequirement)
