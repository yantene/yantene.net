#!/bin/fish

asdf plugin add nodejs
asdf install

asdf reshim
npm install -g pnpm
asdf reshim

curl -LsSf https://astral.sh/uv/install.sh | sh
