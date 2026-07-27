# Sales CRM Backend

Small Express + Mongoose API foundation for the Sales CRM. The repo is ready to add CRM and ERP modules without splitting into services before there is a real boundary.

## Run Locally

```sh
npm install
npm run dev
```

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
