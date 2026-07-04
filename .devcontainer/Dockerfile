FROM mcr.microsoft.com/devcontainers/javascript-node:24-bookworm

RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    | tee /etc/apt/sources.list.d/github-cli.list > /dev/null

RUN apt-get update && \
    export DEBIAN_FRONTEND=noninteractive && \
    apt-get -y install --no-install-recommends \
    file \
    fish \
    gh \
    chromium \
    fonts-noto-cjk-extra \
    fonts-noto-color-emoji && \
    rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm

# Install Claude Code CLI
USER node
SHELL ["/bin/bash", "-c"]
RUN set -e -o pipefail && \
    curl -fsSL 'https://claude.ai/install.sh' -o /tmp/claude-install.sh && \
    bash /tmp/claude-install.sh && \
    rm /tmp/claude-install.sh

# Install herdr (terminal multiplexer for coding agents) into ~/.local/bin
RUN set -e -o pipefail && \
    curl -fsSL 'https://herdr.dev/install.sh' -o /tmp/herdr-install.sh && \
    sh /tmp/herdr-install.sh && \
    rm /tmp/herdr-install.sh

# Fish shell configuration
COPY --chown=node:node .devcontainer/fish/ /home/node/.config/fish/
