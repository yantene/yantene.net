FROM debian:bullseye-20230208-slim

# Prepare
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
RUN \
  apt-get update -y && \
  apt-get -t stable install --no-install-recommends -y \
  gosu=1.12-1+b6 && \
  apt-get clean && \
  rm -rf /var/lib/apt/lists/*

# Locale
RUN \
  apt-get update -y && \
  apt-get -t stable install --no-install-recommends -y \
  locales=2.31-13+deb11u5 && \
  apt-get clean && \
  rm -rf /var/lib/apt/lists/* && \
  localedef -f UTF-8 -i en_US en_US.UTF-8
ENV LANG en_US.UTF-8
ENV LANGUAGE en_US:en
ENV LC_ALL en_US.UTF-8

# Add dev user
ARG UID=1000
ARG GID=1000
ARG USERNAME=devuser
ARG GROUPNAME=devusers
RUN \
  apt-get update -y && \
  apt-get -t stable install --no-install-recommends -y \
  sudo=1.9.5p2-3 && \
  apt-get clean && \
  rm -rf /var/lib/apt/lists/* && \
  groupadd --gid ${GID} -o ${GROUPNAME} && \
  useradd --uid ${UID} --gid ${GID} --shell /usr/bin/fish -m -o ${USERNAME} && \
  echo "${USERNAME} ALL=(ALL) NOPASSWD: ALL" > /etc/sudoers.d/${USERNAME}

# Enable bullseye-backports repository
RUN \
  apt-get update -y && \
  apt-get -t stable install --no-install-recommends -y \
  software-properties-common=0.96.20.2-2.1 && \
  add-apt-repository "deb http://deb.debian.org/debian bullseye-backports main" && \
  apt-get clean && \
  rm -rf /var/lib/apt/lists/*

# Install basic tools and libraries
RUN \
  apt-get update -y && \
  apt-get -t stable install --no-install-recommends -y \
  build-essential=12.9 \
  ca-certificates=20210119 \
  curl=7.74.0-1.3+deb11u3 \
  g++=4:10.2.1-1 \
  gcc-multilib=4:10.2.1-1 \
  gcc=4:10.2.1-1 \
  less=551-2 \
  libbz2-dev=1.0.8-4 \
  libffi-dev=3.3-6 \
  libgdbm-dev=1.19-2 \
  libncurses5-dev=6.2+20201114-2 \
  libnss3-dev=2:3.61-1+deb11u2 \
  libreadline-dev=8.1-1 \
  libsqlite3-dev=3.34.1-3 \
  libssl-dev=1.1.1n-0+deb11u4 \
  make=4.3-4.1 \
  pkg-config=0.29.2-1 \
  procps=2:3.3.17-5 \
  unzip=6.0-26+deb11u1 \
  wget=1.21-1+deb11u1 \
  zlib1g-dev=1:1.2.11.dfsg-2+deb11u2 && \
  apt-get -t bullseye-backports install --no-install-recommends -y \
  git=1:2.39.1-0.1~bpo11+1 && \
  apt-get clean && \
  rm -rf /var/lib/apt/lists/*

# Setup shell
RUN \
  apt-get update -y && \
  apt-get -t bullseye-backports install --no-install-recommends -y \
  fish=3.5.1+ds-1~bpo11+1 && \
  apt-get clean && \
  rm -rf /var/lib/apt/lists/* && \
  gosu ${USERNAME} fish -c ' \
  curl -sL https://git.io/fisher | source && \
  fisher install jorgebucaran/fisher && \
  fisher install pure-fish/pure \
  '

# Install asdf
ARG ASDF_VERSION=0.10.2
RUN \
  gosu ${USERNAME} fish -c " \
  git clone https://github.com/asdf-vm/asdf.git /home/${USERNAME}/.asdf --branch v${ASDF_VERSION} && \
  mkdir -p /home/${USERNAME}/.config/fish/completions && \
  ln -s /home/${USERNAME}/.asdf/completions/asdf.fish /home/${USERNAME}/.config/fish/completions && \
  mkdir -p /home/${USERNAME}/.config/fish/conf.d && \
  echo 'source ~/.asdf/asdf.fish' > /home/${USERNAME}/.config/fish/conf.d/asdf.fish \
  "

# Install nodejs
# cf. https://github.com/nodejs/node/blob/main/BUILDING.md#building-nodejs-on-supported-platforms
ARG NODE_VERSION=18.10.0
RUN \
  gosu ${USERNAME} fish -c " \
  asdf plugin add nodejs && \
  asdf install nodejs ${NODE_VERSION} && \
  asdf global nodejs ${NODE_VERSION} \
  "

# Install python
ARG PYTHON_VERSION=3.10.7
RUN \
  gosu ${USERNAME} fish -c " \
  asdf plugin add python && \
  asdf install python ${PYTHON_VERSION} && \
  asdf global python ${PYTHON_VERSION} && \
  python -m pip install --upgrade pip && \
  python -m pip install pipenv && \
  asdf reshim python \
  "

# Install useful tools
RUN \
  apt-get update -y && \
  apt-get -t stable install --no-install-recommends -y \
  tmux=3.1c-1+deb11u1 \
  unzip=6.0-26+deb11u1 \
  openssh-client=1:8.4p1-5+deb11u1 \
  neovim=0.4.4-1 \
  ripgrep=12.1.1-1+b1 \
  bat=0.12.1-6+b2 \
  exa=0.9.0-5+b1 \
  fd-find=8.2.1-1+b1 \
  postgresql=13+225 && \
  apt-get clean && \
  rm -rf /var/lib/apt/lists/* && \
  ln -s /usr/bin/batcat /usr/local/bin/bat && \
  curl -L 'https://github.com/dandavison/delta/releases/download/0.13.0/delta-0.13.0-x86_64-unknown-linux-musl.tar.gz' | tar xz -C /tmp && \
  mv /tmp/delta-0.13.0-x86_64-unknown-linux-musl/delta /usr/local/bin && \
  rm -rf /tmp/delta-0.13.0-x86_64-unknown-linux-musl && \
  curl -L 'https://github.com/lotabout/skim/releases/download/v0.9.4/skim-v0.9.4-x86_64-unknown-linux-musl.tar.gz' | tar xz -C /tmp && \
  mv /tmp/sk /usr/local/bin && \
  curl -L 'https://github.com/hadolint/hadolint/releases/download/v2.10.0/hadolint-Linux-x86_64' -o /usr/local/bin/hadolint && \
  chmod 755 /usr/local/bin/hadolint && \
  gosu ${USERNAME} fish -c " \
  python -m pip install \
  ansible==7.2.0 \
  ansible-lint==6.8.0 && \
  asdf reshim python \
  "

# Copy .config/
COPY ./.devcontainer/docker/config/ /home/${USERNAME}/.config
RUN \
  chown devuser:devusers -R /home/${USERNAME}/.config

WORKDIR /workspace

EXPOSE 3000

CMD ["/usr/bin/tail", "-f", "/dev/null"]
