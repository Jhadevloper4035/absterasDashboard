.PHONY: dev dev-build dev-down dev-logs prod prod-build prod-down prod-logs backend-install frontend-install

dev-up:
	docker compose up -d 

dev-build:
	docker compose up --build

dev-down:
	docker compose down

dev-logs:
	docker compose logs -f

prod:
	docker compose -f docker-compose.prod.yml up -d

prod-build:
	docker compose -f docker-compose.prod.yml up -d --build

prod-down:
	docker compose -f docker-compose.prod.yml down

prod-logs:
	docker compose -f docker-compose.prod.yml logs -f

backend-install:
	cd backend && npm install

frontend-install:
	cd frontend && npm install
