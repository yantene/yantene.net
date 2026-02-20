FROM mcr.microsoft.com/devcontainers/base:1-bookworm

RUN apt-get update && \
    export DEBIAN_FRONTEND=noninteractive && \
    apt-get -y install --no-install-recommends \
    file \
    fish \
    chromium \
    fonts-noto-cjk-extra \
    fonts-noto-color-emoji

# Install Claude Code CLI
USER vscode
SHELL ["/bin/bash", "-c"]
RUN set -e -o pipefail && \
    curl -fsSL 'https://claude.ai/install.sh' -o /tmp/claude-install.sh && \
    bash /tmp/claude-install.sh && \
    rm /tmp/claude-install.sh

# Prepare fish config directories with correct ownership
RUN mkdir -p /home/vscode/.config/fish/conf.d /home/vscode/.config/fish/functions && \
    touch /home/vscode/.config/fish/fish_variables

USER root
