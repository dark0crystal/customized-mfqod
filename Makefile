.PHONY: help build up down logs restart clean dev map-tiles save-images load-images

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build: ## Build Docker images
	docker-compose build

up: ## Start services in detached mode
	docker-compose up -d

down: ## Stop and remove containers
	docker-compose down

logs: ## View logs from all services
	docker-compose logs -f

logs-backend: ## View backend logs
	docker-compose logs -f backend

logs-frontend: ## View frontend logs
	docker-compose logs -f frontend

restart: ## Restart all services
	docker-compose restart

restart-backend: ## Restart backend service
	docker-compose restart backend

restart-frontend: ## Restart frontend service
	docker-compose restart frontend

dev: ## Start in development mode with hot reload
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build

clean: ## Remove containers, networks, and volumes
	docker-compose down -v
	docker system prune -f

ps: ## Show running containers
	docker-compose ps

health: ## Check service health
	docker-compose ps
	@echo ""
	@echo "Backend health:"
	@curl -s http://localhost:8000/api/health || echo "Backend not responding"
	@echo ""
	@echo "Frontend health:"
	@curl -s http://localhost:3000/healthz || echo "Frontend not responding"

shell-backend: ## Open shell in backend container
	docker-compose exec backend /bin/bash

shell-frontend: ## Open shell in frontend container
	docker-compose exec frontend /bin/sh


map-tiles: ## Download offline map tiles to storage/map/oman.pmtiles (needs internet)
	bash scripts/download-map-tiles.sh "$(BUILD_DATE)" "$(BBOX)" "$(MAXZOOM)"

IMAGES_ARCHIVE ?= mfqod-images.tar.gz
PLATFORM ?= linux/amd64

save-images: ## Build images for $(PLATFORM) and save them to $(IMAGES_ARCHIVE) (air-gapped install)
	docker buildx build --platform $(PLATFORM) -f backend/Dockerfile --target production -t mfqod-backend:latest --load .
	docker buildx build --platform $(PLATFORM) -f frontend/Dockerfile --target runner -t mfqod-frontend:latest --load .
	docker save mfqod-backend:latest mfqod-frontend:latest | gzip > $(IMAGES_ARCHIVE)
	@echo "Saved $(IMAGES_ARCHIVE). Copy it with docker-compose.yml, backend/.env and storage/map/oman.pmtiles."

load-images: ## Load images from $(IMAGES_ARCHIVE) and start without building (offline server)
	docker load < $(IMAGES_ARCHIVE)
	docker-compose up -d --no-build
