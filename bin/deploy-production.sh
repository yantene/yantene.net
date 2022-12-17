#!/bin/sh

if [ $(pwd) != "/opt/www/www.yantene.net/yantene.net" ]; then
  echo "wrong execution location!"
  exit 1
fi

sudo -u production git pull
sudo -u production docker compose build
sudo -u production docker compose --env-file ./.env.production up --no-deps -d
