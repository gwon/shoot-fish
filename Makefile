init:
	docker network create ezgaming-net

up:
	docker-compose -f docker-compose.yml up --build

down:
	docker-compose -f docker-compose.yml down

clean:
	docker-compose -f docker-compose.yml down
	@echo "=============cleaning up============="
	docker system prune -f
	docker volume prune -f
	docker images prune -a
	docker network create ezgaming-net

build:
	yarn build

dev:
	yarn install && \
	PORT=2000 yarn start:dev