import uuid

from django.conf import settings
from django.db import models

from organizations.models import Company, Installation


class Position(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    installation = models.ForeignKey(
        Installation,
        on_delete=models.CASCADE,
        related_name="positions",
    )
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=50, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    color = models.CharField(
        max_length=7,
        blank=True,
        null=True,
    )
    sort_order = models.PositiveIntegerField(default=0)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["installation", "name"],
                name="unique_position_name_per_installation",
            ),
        ]

    @property
    def company(self):
        return self.installation.company

    @property
    def company_id(self):
        return self.installation.company_id

    @property
    def staffing_rules(self):
        return self.staffing_requirements.filter(active=True)

    def __str__(self):
        return self.name


class Zone(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    installation = models.ForeignKey(
        Installation,
        on_delete=models.CASCADE,
        related_name="zones",
    )
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=50, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    color = models.CharField(
        max_length=7,
        blank=True,
        null=True,
    )
    sort_order = models.PositiveIntegerField(default=0)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        ordering = ["sort_order", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["installation", "name"],
                name="unique_zone_name_per_installation",
            ),
        ]

    @property
    def company(self):
        return self.installation.company

    @property
    def company_id(self):
        return self.installation.company_id

    def __str__(self):
        return self.name


class Shift(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    installation = models.ForeignKey(
        Installation,
        on_delete=models.CASCADE,
        related_name="shifts",
    )
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=50, blank=True, null=True)
    start_time = models.TimeField()
    end_time = models.TimeField()
    break_minutes = models.PositiveIntegerField(default=0)
    color = models.CharField(
        max_length=7,
        blank=True,
        null=True,
    )
    sort_order = models.PositiveIntegerField(default=0)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "start_time", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["installation", "name"],
                name="unique_shift_name_per_installation",
            ),
        ]

    @property
    def company(self):
        return self.installation.company

    @property
    def company_id(self):
        return self.installation.company_id

    def __str__(self):
        return self.name


class Contract(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey("Employee", on_delete=models.CASCADE, related_name="contracts")
    start_date = models.DateField()
    end_date = models.DateField(blank=True, null=True)
    weekly_hours = models.DecimalField(max_digits=5, decimal_places=2)
    work_percentage = models.PositiveSmallIntegerField(blank=True, null=True)
    calculation_period = models.CharField(max_length=50, blank=True, null=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["employee__first_name", "employee__last_name", "-start_date"]
        constraints = [
            models.CheckConstraint(condition=models.Q(end_date__isnull=True) | models.Q(end_date__gte=models.F("start_date")), name="contract_end_date_after_start_date"),
            models.CheckConstraint(condition=models.Q(weekly_hours__gte=0), name="contract_weekly_hours_non_negative"),
            models.CheckConstraint(condition=models.Q(work_percentage__isnull=True) | models.Q(work_percentage__lte=100), name="contract_work_percentage_max_100"),
        ]

    @property
    def installation_id(self):
        return self.employee.installation_id

    @property
    def company_id(self):
        return self.employee.company_id

    def __str__(self):
        return f"{self.employee} contract from {self.start_date}"


class EmployeePosition(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey("Employee", on_delete=models.CASCADE, related_name="employee_positions")
    position = models.ForeignKey(Position, on_delete=models.PROTECT, related_name="employee_positions")
    primary = models.BooleanField(default=False)
    proficiency = models.CharField(max_length=50, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["employee__first_name", "employee__last_name", "position__name"]
        constraints = [
            models.UniqueConstraint(fields=["employee", "position"], name="unique_employee_position"),
            models.UniqueConstraint(fields=["employee"], condition=models.Q(primary=True), name="unique_primary_position_per_employee"),
        ]

    def __str__(self):
        return f"{self.employee} - {self.position}"


class EmployeeZone(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey("Employee", on_delete=models.CASCADE, related_name="employee_zones")
    zone = models.ForeignKey(Zone, on_delete=models.PROTECT, related_name="employee_zones")
    preferred = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["employee__first_name", "employee__last_name", "zone__name"]
        constraints = [models.UniqueConstraint(fields=["employee", "zone"], name="unique_employee_zone")]

    def __str__(self):
        return f"{self.employee} - {self.zone}"


class EmployeeAvailability(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey("Employee", on_delete=models.CASCADE, related_name="availabilities")
    day_of_week = models.PositiveSmallIntegerField()
    available = models.BooleanField(default=True)
    start_time = models.TimeField(blank=True, null=True)
    end_time = models.TimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["employee__first_name", "employee__last_name", "day_of_week", "start_time"]
        constraints = [
            models.UniqueConstraint(fields=["employee", "day_of_week", "start_time", "end_time"], name="unique_employee_availability_window"),
            models.CheckConstraint(condition=models.Q(day_of_week__gte=0, day_of_week__lte=6), name="valid_availability_day_of_week"),
            models.CheckConstraint(condition=models.Q(start_time__isnull=True, end_time__isnull=True) | models.Q(start_time__isnull=False, end_time__isnull=False), name="availability_times_both_null_or_set"),
        ]

    def __str__(self):
        return f"{self.employee} availability {self.day_of_week}"


class EmployeeAvailabilityException(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey("Employee", on_delete=models.CASCADE, related_name="availability_exceptions")
    date = models.DateField()
    available = models.BooleanField(default=True)
    start_time = models.TimeField(blank=True, null=True)
    end_time = models.TimeField(blank=True, null=True)
    reason = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["employee__first_name", "employee__last_name", "date", "start_time"]
        constraints = [
            models.UniqueConstraint(fields=["employee", "date", "start_time", "end_time"], name="unique_employee_availability_exception_window"),
            models.CheckConstraint(condition=models.Q(start_time__isnull=True, end_time__isnull=True) | models.Q(start_time__isnull=False, end_time__isnull=False), name="availability_exception_times_both_null_or_set"),
        ]

    def __str__(self):
        return f"{self.employee} availability exception {self.date}"


class EmployeeTimeOff(models.Model):
    class Type(models.TextChoices):
        VACATION = "vacation", "Vacation"
        SICK = "sick", "Sick leave"
        PERSONAL = "personal", "Personal"
        OTHER = "other", "Other"

    class Status(models.TextChoices):
        REQUESTED = "requested", "Requested"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        CANCELLED = "cancelled", "Cancelled"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey("Employee", on_delete=models.CASCADE, related_name="time_off_entries")
    type = models.CharField(max_length=30, choices=Type.choices)
    start_date = models.DateField()
    end_date = models.DateField()
    start_time = models.TimeField(blank=True, null=True)
    end_time = models.TimeField(blank=True, null=True)
    minutes = models.PositiveIntegerField(blank=True, null=True)
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.REQUESTED)
    notes = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, related_name="created_time_off_entries", blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["employee__first_name", "employee__last_name", "-start_date"]
        constraints = [
            models.CheckConstraint(condition=models.Q(end_date__gte=models.F("start_date")), name="time_off_end_date_after_start_date"),
            models.CheckConstraint(condition=models.Q(start_time__isnull=True, end_time__isnull=True) | models.Q(start_time__isnull=False, end_time__isnull=False), name="time_off_times_both_null_or_set"),
        ]

    @property
    def company_id(self):
        return self.employee.company_id

    def __str__(self):
        return f"{self.employee} {self.type} {self.start_date} - {self.end_date}"


class Assignment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey("Employee", on_delete=models.CASCADE, related_name="assignments")
    date = models.DateField()
    shift = models.ForeignKey(Shift, on_delete=models.PROTECT, related_name="assignments")
    zone = models.ForeignKey(Zone, on_delete=models.PROTECT, related_name="assignments")
    position = models.ForeignKey(Position, on_delete=models.PROTECT, related_name="assignments")
    start_time_override = models.TimeField(blank=True, null=True)
    end_time_override = models.TimeField(blank=True, null=True)
    break_minutes_override = models.PositiveIntegerField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, related_name="created_assignments", blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["date", "employee__first_name", "employee__last_name"]
        constraints = [
            models.UniqueConstraint(fields=["employee", "date"], name="unique_assignment_per_employee_date"),
            models.CheckConstraint(condition=models.Q(start_time_override__isnull=True, end_time_override__isnull=True) | models.Q(start_time_override__isnull=False, end_time_override__isnull=False), name="assignment_override_times_both_null_or_set"),
        ]

    @property
    def company_id(self):
        return self.employee.company_id

    def __str__(self):
        return f"{self.employee} - {self.date}"


class TimeBalanceEntry(models.Model):
    class Type(models.TextChoices):
        ACCRUED = "accrued", "Accrued"
        USED = "used", "Used"
        ADJUSTMENT = "adjustment", "Adjustment"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey("Employee", on_delete=models.CASCADE, related_name="time_balance_entries")
    date = models.DateField()
    type = models.CharField(max_length=30, choices=Type.choices)
    minutes = models.IntegerField()
    assignment = models.ForeignKey(Assignment, on_delete=models.SET_NULL, related_name="time_balance_entries", blank=True, null=True)
    time_off = models.ForeignKey(EmployeeTimeOff, on_delete=models.SET_NULL, related_name="time_balance_entries", blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, related_name="created_time_balance_entries", blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["employee__first_name", "employee__last_name", "-date", "-created_at"]

    @property
    def company_id(self):
        return self.employee.company_id

    def __str__(self):
        return f"{self.employee} {self.type} {self.minutes}m on {self.date}"


class StaffRequirement(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    installation = models.ForeignKey(Installation, on_delete=models.CASCADE, related_name="staff_requirements")
    zone = models.ForeignKey(Zone, on_delete=models.PROTECT, related_name="staff_requirements")
    shift = models.ForeignKey(Shift, on_delete=models.PROTECT, related_name="staff_requirements")
    position = models.ForeignKey(Position, on_delete=models.PROTECT, related_name="staff_requirements")
    day_of_week = models.PositiveSmallIntegerField(blank=True, null=True)
    date = models.DateField(blank=True, null=True)
    required_employees = models.PositiveIntegerField()
    minimum_employees = models.PositiveIntegerField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["installation__name", "date", "day_of_week", "zone__name", "shift__start_time", "position__name"]
        constraints = [
            models.CheckConstraint(condition=models.Q(day_of_week__isnull=True) | models.Q(day_of_week__gte=0, day_of_week__lte=6), name="valid_staff_requirement_day_of_week"),
            models.CheckConstraint(condition=(models.Q(day_of_week__isnull=False, date__isnull=True) | models.Q(day_of_week__isnull=True, date__isnull=False)), name="staff_requirement_has_day_or_date"),
            models.CheckConstraint(condition=models.Q(required_employees__gte=1), name="staff_requirement_required_employees_positive"),
            models.CheckConstraint(condition=models.Q(minimum_employees__isnull=True) | models.Q(minimum_employees__lte=models.F("required_employees")), name="staff_requirement_minimum_not_above_required"),
            models.UniqueConstraint(fields=["installation", "zone", "shift", "position", "day_of_week"], condition=models.Q(day_of_week__isnull=False), name="unique_staff_requirement_day_pattern"),
            models.UniqueConstraint(fields=["installation", "zone", "shift", "position", "date"], condition=models.Q(date__isnull=False), name="unique_staff_requirement_date_pattern"),
        ]

    @property
    def company_id(self):
        return self.installation.company_id

    def __str__(self):
        return f"{self.position} - {self.zone} - {self.shift}"


class Planning(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"
        ARCHIVED = "archived", "Archived"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    installation = models.ForeignKey(Installation, on_delete=models.CASCADE, related_name="plannings")
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.DRAFT)
    version = models.PositiveIntegerField(blank=True, null=True)
    published_at = models.DateTimeField(blank=True, null=True)
    published_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, related_name="published_plannings", blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["installation__name", "-start_date", "-version"]
        constraints = [
            models.CheckConstraint(condition=models.Q(end_date__gte=models.F("start_date")), name="planning_end_date_after_start_date"),
            models.UniqueConstraint(fields=["installation", "start_date", "end_date", "version"], name="unique_planning_period_version"),
        ]

    @property
    def company_id(self):
        return self.installation.company_id

    def __str__(self):
        return f"{self.installation} {self.start_date} - {self.end_date}"


class Employee(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    installation = models.ForeignKey(
        Installation,
        on_delete=models.CASCADE,
        related_name="employees",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="employees",
        blank=True,
        null=True,
    )
    employee_code = models.CharField(max_length=50, blank=True, null=True)
    position = models.ForeignKey(
        Position,
        on_delete=models.PROTECT,
        related_name="employees",
        blank=True,
        null=True,
    )
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(
        max_length=150,
        blank=True,
    )
    email = models.EmailField(blank=True, null=True)
    phone = models.CharField(max_length=50, blank=True, null=True)
    hire_date = models.DateField(blank=True, null=True)
    termination_date = models.DateField(blank=True, null=True)
    color = models.CharField(max_length=7, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    active = models.BooleanField(default=True)
    all_zones = models.BooleanField(
        default=True,
        help_text="When true, the employee can work in every zone of the installation.",
    )
    availability_unrestricted = models.BooleanField(
        default=True,
        help_text="When true, the employee has no recurring availability restrictions.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    allowed_zones = models.ManyToManyField(
        Zone,
        related_name="employees",
        blank=True,
    )
    class Meta:
        ordering = ["first_name", "last_name"]

    @property
    def company(self):
        return self.installation.company

    @property
    def company_id(self):
        return self.installation.company_id

    def __str__(self):
        return f"{self.first_name} {self.last_name}".strip()


