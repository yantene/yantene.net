#!/bin/bash

export PNPM_HOME="$HOME/.local/share/pnpm"
export PATH="$PNPM_HOME:$PNPM_HOME/bin:$PATH"

pnpm config set store-dir /home/node/.pnpm-store --global

# Persist Claude Code state across pod recreations.
#
# The devpod Kubernetes provider applies devcontainer.json `mounts` only while rebuilding
# the workspace with `--recreate`. A plain `devpod up` rebuilds the pod from the options
# stored on the PVC, and those never gain the mount, so a volume on ~/.claude disappears
# as soon as the pod is replaced, which is exactly what a node reboot causes. The
# workspace volume is the only one guaranteed to come back, so the state lives there and
# is linked into $HOME. It sits in .git/ because that can never be committed and it
# survives `git clean -fdx`. Under Docker Compose ~/.claude is already a named volume,
# so the mount check skips all of this.
if ! grep -q " $HOME/.claude " /proc/mounts 2>/dev/null; then
  claude_store="$PWD/.git/claude-home"
  mkdir -p "$claude_store"

  if [ -L "$HOME/.claude" ]; then
    ln -sfn "$claude_store" "$HOME/.claude"
  elif [ -d "$HOME/.claude" ]; then
    cp -a "$HOME/.claude/." "$claude_store/"
    rm -rf "$HOME/.claude"
    ln -s "$claude_store" "$HOME/.claude"
  else
    ln -sfn "$claude_store" "$HOME/.claude"
  fi
fi
