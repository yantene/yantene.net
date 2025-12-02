FROM mcr.microsoft.com/devcontainers/base:1-bookworm

RUN apt-get update && \
    export DEBIAN_FRONTEND=noninteractive && \
    apt-get -y install --no-install-recommends \
    fish \
    chromium \
    fonts-noto-cjk-extra \
    fonts-noto-color-emoji

# Install asdf
SHELL ["/bin/bash", "-c"]
RUN set -e -o pipefail && \
    curl -L 'https://github.com/asdf-vm/asdf/releases/download/v0.18.0/asdf-v0.18.0-linux-amd64.tar.gz' -o /tmp/asdf.tar.gz && \
    tar -xz -C /usr/local/bin -f /tmp/asdf.tar.gz && \
    rm /tmp/asdf.tar.gz && \
    mkdir -p /home/vscode/.config/fish/conf.d && \
    curl -L 'https://raw.githubusercontent.com/asdf-vm/asdf/refs/tags/v0.18.0/asdf.fish' > /home/vscode/.config/fish/conf.d/asdf.fish && \
    curl -L 'https://raw.githubusercontent.com/asdf-vm/asdf/refs/tags/v0.18.0/asdf.sh' > /etc/profile.d/asdf.sh && \
    chown -R vscode:vscode /home/vscode/.config
