#!/bin/sh

set -eux

# Setup development environment
npm ci

# Setup api.yantene.net
cd ./sites/api.yantene.net
npm ci
cd ../..

# Setup api.www.yantene.net
cd ./sites/api.www.yantene.net
npm ci
npm run db:push
cd ../..
