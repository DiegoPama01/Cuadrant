from django.contrib import admin
from django.urls import include, path


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("workforce.urls")),
    path("api/", include("organizations.urls")),
    path(
        "api/auth/",
        include("accounts.urls"),
    ),
]
