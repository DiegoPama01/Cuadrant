# Planning App

## Entorno

1. Copia `.env.example` a `.env`.
2. Rellena `.env` con la URL real de PostgreSQL y la configuracion real de Authentik del VPS.
3. Levanta el entorno local con `docker compose -f compose.yaml -f compose.local.yaml up --build -d`.
4. Ejecuta migraciones con `docker compose -f compose.yaml -f compose.local.yaml exec backend python manage.py migrate`.
5. Si necesitas un usuario admin: `python manage.py createsuperuser`.

Datos conocidos del despliegue actual:

- VPS: `198.244.150.237`
- Usuario SSH: `ubuntu`
- Authentik publico: `https://auth.diebyte.dev/`

## Arquitectura esperada

- El Compose local levanta PostgreSQL; Authentik y OpenFGA se mantienen como servicios externos.
- `backend` usa el servicio `db` en local y `DATABASE_URL` o `POSTGRES_*` en produccion.
- `frontend` debe apuntar al backend real mediante `FRONTEND_PUBLIC_API_BASE_URL`.
- Si activas OIDC, tanto backend como frontend deben usar las URLs publicas reales de Authentik.
- `frontend/public/app-config.json` se genera desde `.env` en cada arranque o build del frontend.
- Si la base de datos solo acepta acceso por SSH, primero debes abrir un tunel al VPS por el puerto `22`.

### Desarrollo con Docker

Desde la raiz del proyecto:

```powershell
docker compose -f compose.yaml -f compose.local.yaml up --build -d
docker compose -f compose.yaml -f compose.local.yaml logs -f backend
```

El frontend queda disponible en `http://localhost:4200`, el backend en `http://localhost:8000`
y PostgreSQL permanece en la red interna del Compose.

## Backend

- El backend ya no usa SQLite como fallback.
- Debe recibir PostgreSQL mediante `DATABASE_URL` o las variables `POSTGRES_*`.
- El archivo `.env` se carga al iniciar `manage.py`, `wsgi.py` y `asgi.py`.
- Para checks manuales puedes usar `pip install -r backend/requirements.txt` y luego `python manage.py check` desde `backend`.
- Ejemplo de tunel SSH para PostgreSQL: `ssh -N -L 5432:127.0.0.1:5432 ubuntu@198.244.150.237`

## Frontend

- La configuracion publica se genera en `frontend/public/app-config.json` a partir de `.env`.
- `npm run start` y `npm run build` regeneran ese archivo automaticamente.
- Las variables publicas usan el prefijo `FRONTEND_PUBLIC_`.
- En local, el dev server suele quedar en `http://localhost:4200`.
- `ng serve` usa `frontend/proxy.conf.json` para reenviar `/api` y `/admin` a `http://127.0.0.1:8000` durante desarrollo.
- El login OIDC vuelve a `FRONTEND_PUBLIC_AUTH_REDIRECT_URI`, por ejemplo `http://localhost:4200/auth/callback`.

## Authentik

- Se deja preparada la estructura de variables para OIDC con Authentik.
- El login del frontend usa Authentik con `authorization_code` + PKCE y completa el intercambio de tokens en el backend.
- Usa siempre las URLs publicas reales del servicio desplegado, no `localhost`, salvo en desarrollo local.
- Para este entorno, el issuer esperado es `https://auth.diebyte.dev/application/o/cuadrant/`.
- Si el alta de usuarios la gestiona Django contra la API de Authentik, configura `AUTHENTIK_SERVICE_TOKEN` en el backend.
- Si el acceso a la app `cuadrant` depende de grupos/entitlements, configura `AUTHENTIK_DEFAULT_GROUPS` para meter a cada usuario nuevo en los grupos autorizados.
- Si el token de servicio no puede listar grupos, usa `AUTHENTIK_DEFAULT_GROUP_IDS` con el UUID del grupo en vez del nombre.

## Produccion con Docker

El despliegue productivo usa Gunicorn para el backend y Nginx para servir el frontend y
reenviar `/api/` y `/admin/` al backend. El callback `/auth/callback` lo gestiona Angular.
El proxy inverso del VPS debe estar conectado a
la red Docker externa `infra`.

Desde la raiz del proyecto, con el `.env` de produccion configurado:

```bash
docker network inspect infra >/dev/null 2>&1 || docker network create infra
docker compose -f compose.yaml -f compose.prod.yaml build
docker compose -f compose.yaml -f compose.prod.yaml run --rm backend python manage.py migrate
docker compose -f compose.yaml -f compose.prod.yaml up -d
```

Para aplicar cambios posteriores de codigo o variables de entorno:

```bash
docker compose -f compose.yaml -f compose.prod.yaml up -d --build --force-recreate
```

No uses `docker compose down -v` en produccion. La base de datos es externa al compose,
pero debe hacerse un backup antes de ejecutar migraciones.
