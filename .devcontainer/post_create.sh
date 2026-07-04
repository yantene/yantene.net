#!/bin/bash

export PNPM_HOME="$HOME/.local/share/pnpm"
export PATH="$PNPM_HOME:$PNPM_HOME/bin:$PATH"

pnpm config set store-dir /home/node/.pnpm-store --global
