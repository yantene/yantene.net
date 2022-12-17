#!/bin/sh

docker compose build
docker compose --env-file ./.env.production up --no-deps -d
