#!/bin/sh

docker compose build
docker compose --env-file ./.env.staging up --no-deps -d
