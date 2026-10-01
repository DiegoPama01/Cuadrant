from django.contrib import admin

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
    Shift,
    TimeBalanceEntry,
    Zone,
)


@admin.register(Position)
class PositionAdmin(admin.ModelAdmin):
    list_display = ("name", "installation", "code", "sort_order", "active")
    list_filter = ("installation__company", "installation", "active")


@admin.register(Zone)
class ZoneAdmin(admin.ModelAdmin):
    list_display = ("name", "installation", "code", "sort_order", "active")
    list_filter = ("installation__company", "installation", "active")


@admin.register(Shift)
class ShiftAdmin(admin.ModelAdmin):
    list_display = ("name", "installation", "code", "start_time", "end_time", "break_minutes", "active")
    list_filter = ("installation__company", "installation", "active")


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = (
        "first_name",
        "last_name",
        "installation",
        "employee_code",
        "position",
        "active",
    )
    list_filter = ("installation__company", "installation", "position", "active")
    search_fields = ("first_name", "last_name", "employee_code", "email")
    filter_horizontal = ("allowed_zones",)


admin.site.register(Contract)
admin.site.register(EmployeePosition)
admin.site.register(EmployeeZone)
admin.site.register(EmployeeAvailability)
admin.site.register(EmployeeAvailabilityException)
admin.site.register(EmployeeTimeOff)
admin.site.register(TimeBalanceEntry)
admin.site.register(Assignment)
admin.site.register(StaffRequirement)
admin.site.register(Planning)
