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
    download_and_verify() { \
        local url="$1" output="$2" expected_sha256="$3"; \
        curl -L "$url" | tee "$output" | sha256sum -c <(echo "$expected_sha256  -"); \
    } && \
    download_and_verify \
        'https://github.com/asdf-vm/asdf/releases/download/v0.18.0/asdf-v0.18.0-linux-amd64.tar.gz' \
        '/tmp/asdf.tar.gz' \
        '4d3007070166cb0a652af26c3f0462b021e04cb26c4ab13894d13689da89f5b8' && \
    tar -xz -C /usr/local/bin -f /tmp/asdf.tar.gz && \
    rm /tmp/asdf.tar.gz && \
    mkdir -p /home/vscode/.config/fish/conf.d && \
    download_and_verify \
        'https://raw.githubusercontent.com/asdf-vm/asdf/refs/tags/v0.18.0/asdf.sh' \
        '/etc/profile.d/asdf.sh' \
        'f3d785f3a0e2c0bb55a1f0eabe6ed8eb79ff0133bc062723368b971041b82fb3' && \
    download_and_verify \
        'https://raw.githubusercontent.com/asdf-vm/asdf/refs/tags/v0.18.0/asdf.fish' \
        '/home/vscode/.config/fish/conf.d/asdf.fish' \
        'c5e06629af2235a25971e2abb6d51fdf83b80ae766a493b2a6e3b1a70722dc9f' && \
    chown -R vscode:vscode /home/vscode/.config
