from django.contrib import admin

from .models import Company, CompanyMembership, Installation


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "timezone", "active", "created_at", "updated_at")
    list_filter = ("active",)
    search_fields = ("name", "slug", "legal_name", "tax_id")


@admin.register(Installation)
class InstallationAdmin(admin.ModelAdmin):
    list_display = ("name", "company", "code", "timezone", "active", "created_at", "updated_at")
    list_filter = ("company", "active")
    search_fields = ("name", "code", "address", "company__name")


@admin.register(CompanyMembership)
class CompanyMembershipAdmin(admin.ModelAdmin):
    list_display = ("user", "company", "role", "created_at")
    list_filter = ("role", "company")
    search_fields = ("user__username", "user__email", "company__name")
