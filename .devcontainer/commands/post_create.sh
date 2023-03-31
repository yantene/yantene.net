#!/bin/sh

set -eux

# Setup development environment
npm ci

# Setup api.www.yantene.net
cd ./sites/api.www.yantene.net
npm ci
cd ../..

# Setup www.yantene.net
cd ./sites/www.yantene.net
npm ci
cd ../..
