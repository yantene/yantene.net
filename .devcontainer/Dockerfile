FROM mcr.microsoft.com/devcontainers/base:1-bookworm

RUN apt-get update && \
    export DEBIAN_FRONTEND=noninteractive && \
    apt-get -y install --no-install-recommends \
    fish \
    chromium \
    fonts-noto-cjk-extra \
    fonts-noto-color-emoji

# Install Claude Code CLI
USER vscode
SHELL ["/bin/bash", "-c"]
RUN set -e -o pipefail && \
    download_and_verify() { \
        local url="$1" output="$2" expected_sha256="$3"; \
        curl -fsSL "$url" | tee "$output" | sha256sum -c <(echo "$expected_sha256  -"); \
    } && \
    download_and_verify \
        'https://claude.ai/install.sh' \
        '/tmp/claude-install.sh' \
        '363382bed8849f78692bd2f15167a1020e1f23e7da1476ab8808903b6bebae05' && \
    bash /tmp/claude-install.sh && \
    rm /tmp/claude-install.sh

# Prepare fish config directories with correct ownership
RUN mkdir -p /home/vscode/.config/fish/conf.d /home/vscode/.config/fish/functions && \
    touch /home/vscode/.config/fish/fish_variables

USER root
