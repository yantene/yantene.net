#!/bin/sh

if [ $(pwd) != "/opt/www/stg-www.yantene.net/yantene.net" ]; then
  echo "wrong execution location!"
  exit 1
fi

sudo -u staging git pull
sudo -u staging docker compose build
sudo -u staging docker compose --env-file ./.env.staging up --no-deps -d
