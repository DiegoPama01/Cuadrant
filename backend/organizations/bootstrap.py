from django.utils.text import slugify

from authorization import fga
from organizations.models import Company, CompanyMembership, Installation


def ensure_user_company_membership(user):
    memberships = list(user.company_memberships.all())
    if memberships:
        if user.authentik_sub:
            for membership in memberships:
                fga.provision_company(
                    company_id=membership.company_id,
                    user_sub=user.authentik_sub,
                    relation="owner" if membership.role == CompanyMembership.Role.OWNER else membership.role,
                )
                for installation in membership.company.installations.all():
                    installation_relation = {
                        CompanyMembership.Role.OWNER: "owner",
                        CompanyMembership.Role.ADMIN: "admin",
                        CompanyMembership.Role.MEMBER: "manager",
                    }[membership.role]
                    fga.provision_installation(
                        installation_id=installation.id,
                        user_sub=user.authentik_sub,
                        company_id=membership.company_id,
                        relation=installation_relation,
                    )
        return

    base_name = (user.first_name or user.email.split("@", 1)[0]).strip() or "Workspace"
    company_name = f"{base_name.title()} Workspace"
    company_slug = _build_unique_slug(base_name, user.id)

    company = Company.objects.create(
        name=company_name,
        slug=company_slug,
    )
    installation = Installation.objects.create(
        company=company,
        name=company_name,
        timezone=company.timezone,
    )
    CompanyMembership.objects.create(
        company=company,
        user=user,
        role=CompanyMembership.Role.OWNER,
    )
    if user.authentik_sub:
        fga.provision_company(
            company_id=company.id,
            user_sub=user.authentik_sub,
        )
        fga.provision_installation(
            installation_id=installation.id,
            user_sub=user.authentik_sub,
            company_id=company.id,
        )


def _build_unique_slug(base_name, user_id):
    slug_base = slugify(base_name) or "workspace"
    slug = f"{slug_base}-{user_id}"
    counter = 1

    while Company.objects.filter(slug=slug).exists():
        counter += 1
        slug = f"{slug_base}-{user_id}-{counter}"

    return slug
