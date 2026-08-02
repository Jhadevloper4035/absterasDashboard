# Absteras Facade Company CRM Backend

Small Express + Mongoose API foundation for the Absteras Facade Company CRM. The repo is ready to add facade sales modules without splitting into services before there is a real boundary.

## Run Locally

```sh
npm install
npm run db:seed
npm run dev
```

The seed creates demo users, 10 unassigned demo leads, demo architects and demo tasks.

| Role | Email | Password |
| --- | --- | --- |
| `superadmin` | `codex.superadmin@example.com` | `CodexAdmin123!` |
| `admin` | `codex.admin@example.com` | `CodexAdmin123!` |

Create sales users from the Users page, then assign demo leads from `/leads`.

With Docker:

```sh
cd ..
docker compose up --build
```

Production-shaped compose uses the production env file and a separate Mongo volume/database:

```sh
cd ..
docker compose -f docker-compose.prod.yml up --build
```

## Health

```sh
curl http://localhost:4000/health
```

The health route returns `200` when MongoDB is connected and `503` when the API is alive but the database is unavailable.

## User API

All routes are under `/api/users`.

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/` | `superadmin`, `admin` | List users. Admins see sales users only. |
| `POST` | `/` | first superadmin setup or user manager | Create a user. Admins can create sales users only. |
| `GET` | `/:id` | `superadmin`, `admin` | Read one user. Admins can read sales users only. |
| `PATCH` | `/:id` | `superadmin`, `admin` | Update a user. Admins can update sales users only. |

Editable fields for `PATCH /api/users/:id`:

```json
{
  "name": "Sales User",
  "email": "sales@example.com",
  "phone": "+971500000000",
  "whatsappNumber": "+971500000000",
  "role": "sales",
  "status": "active",
  "timezone": "Asia/Dubai",
  "territories": ["Dubai", "Abu Dhabi"],
  "notificationPreferences": {
    "inApp": true,
    "whatsapp": true,
    "morningSummary": { "enabled": true, "time": "08:30" }
  },
  "password": "NewPassword123!"
}
```

Fields outside this allowlist are ignored. `superadmin` and `admin` remain single-user roles.
