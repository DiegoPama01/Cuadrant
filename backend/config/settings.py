from pathlib import Path

from config.env import get_bool, get_database_config, get_env, get_list, load_env_file


load_env_file()

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/6.1/howto/deployment/checklist/

SECRET_KEY = get_env("DJANGO_SECRET_KEY", required=True)

DEBUG = get_bool("DJANGO_DEBUG", default=True)

ALLOWED_HOSTS = get_list("DJANGO_ALLOWED_HOSTS", ["localhost", "127.0.0.1"])


# Application definition

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "accounts",
    "organizations",
    "workforce",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"


# Database
# https://docs.djangoproject.com/en/6.1/ref/settings/#databases

DATABASES = {"default": get_database_config()}


# Password validation
# https://docs.djangoproject.com/en/6.1/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]


AUTH_USER_MODEL = "accounts.User"

# Internationalization
# https://docs.djangoproject.com/en/6.1/topics/i18n/

LANGUAGE_CODE = "en-us"

TIME_ZONE = get_env("DJANGO_TIME_ZONE", "UTC")

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/6.1/howto/static-files/

STATIC_URL = "static/"


# Email
# https://docs.djangoproject.com/en/6.1/topics/email/#topic-email-configuration

MAILERS = {
    "default": {
        "BACKEND": "django.core.mail.backends.console.EmailBackend",
    },
}


REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "accounts.authentication.AuthentikUserInfoAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
}

CORS_ALLOWED_ORIGINS = get_list(
    "DJANGO_CORS_ALLOWED_ORIGINS",
    ["http://localhost:4200", "http://127.0.0.1:4200"],
)

CSRF_TRUSTED_ORIGINS = get_list(
    "DJANGO_CSRF_TRUSTED_ORIGINS",
    ["http://localhost:4200", "http://127.0.0.1:4200"],
)

AUTHENTIK = {
    "ENABLED": get_bool("AUTHENTIK_ENABLED", default=False),
    "ISSUER_URL": get_env("AUTHENTIK_ISSUER_URL", ""),
    "INTERNAL_URL": get_env("AUTHENTIK_INTERNAL_URL", ""),
    "DISCOVERY_URL": get_env("AUTHENTIK_DISCOVERY_URL", ""),
    "JWKS_URL": get_env("AUTHENTIK_JWKS_URL", ""),
    "CLIENT_ID": get_env("AUTHENTIK_CLIENT_ID", ""),
    "CLIENT_SECRET": get_env("AUTHENTIK_CLIENT_SECRET", ""),
    "AUDIENCE": get_env("AUTHENTIK_AUDIENCE", ""),
    "SCOPES": get_env("AUTHENTIK_SCOPES", "openid profile email offline_access"),
    "SUB_CLAIM": get_env("AUTHENTIK_SUB_CLAIM", "sub"),
    "EMAIL_CLAIM": get_env("AUTHENTIK_EMAIL_CLAIM", "email"),
    "USERNAME_CLAIM": get_env("AUTHENTIK_USERNAME_CLAIM", "preferred_username"),
    "VERIFY_SSL": get_bool("AUTHENTIK_VERIFY_SSL", default=True),
    "SERVICE_TOKEN": get_env("AUTHENTIK_SERVICE_TOKEN", ""),
    "DEFAULT_GROUPS": get_list("AUTHENTIK_DEFAULT_GROUPS", []),
    "DEFAULT_GROUP_IDS": get_list("AUTHENTIK_DEFAULT_GROUP_IDS", []),
}

OPENFGA = {
    "ENABLED": get_bool("OPENFGA_ENABLED", default=False),
    "API_URL": get_env("OPENFGA_API_URL", "http://localhost:8080"),
    "STORE_ID": get_env("OPENFGA_STORE_ID", ""),
    "AUTHORIZATION_MODEL_ID": get_env("OPENFGA_AUTHORIZATION_MODEL_ID", ""),
    "API_TOKEN": get_env("OPENFGA_API_TOKEN", ""),
    "TIMEOUT_SECONDS": float(get_env("OPENFGA_TIMEOUT_SECONDS", "5")),
    "PROJECT_OBJECT": get_env("OPENFGA_PROJECT_OBJECT", "project:cuadrant"),
}

if AUTHENTIK["ENABLED"]:
    missing_authentik_vars = [
        name
        for name in ("AUTHENTIK_ISSUER_URL", "AUTHENTIK_CLIENT_ID")
        if not get_env(name, "")
    ]
    if missing_authentik_vars:
        missing_vars = ", ".join(missing_authentik_vars)
        raise RuntimeError(f"Missing required Authentik settings: {missing_vars}")

if OPENFGA["ENABLED"]:
    missing_openfga_vars = [
        name
        for name, value in (
            ("OPENFGA_API_URL", OPENFGA["API_URL"]),
            ("OPENFGA_STORE_ID", OPENFGA["STORE_ID"]),
            ("OPENFGA_AUTHORIZATION_MODEL_ID", OPENFGA["AUTHORIZATION_MODEL_ID"]),
        )
        if not value
    ]
    if missing_openfga_vars:
        missing_vars = ", ".join(missing_openfga_vars)
        raise RuntimeError(f"Missing required OpenFGA settings: {missing_vars}")

LOG_LEVEL = get_env("DJANGO_LOG_LEVEL", "INFO")
