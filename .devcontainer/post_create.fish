#!/bin/fish

asdf plugin add nodejs
asdf install

asdf reshim
npm install -g pnpm
asdf reshim

pnpm config set store-dir ~/.pnpm-store --global
