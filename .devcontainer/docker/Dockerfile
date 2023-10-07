FROM debian:bookworm-20230904-slim

# Prepare
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
RUN \
  apt-get update -y && \
  apt-get -t stable install --no-install-recommends -y \
  gosu=1.14-1+b6 && \
  apt-get clean && \
  rm -rf /var/lib/apt/lists/*

# Locale
RUN \
  apt-get update -y && \
  apt-get -t stable install --no-install-recommends -y \
  locales=2.36-9+deb12u1 && \
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
  sudo=1.9.13p3-1+deb12u1 && \
  apt-get clean && \
  rm -rf /var/lib/apt/lists/* && \
  groupadd --gid ${GID} -o ${GROUPNAME} && \
  useradd --uid ${UID} --gid ${GID} --shell /usr/bin/fish -m -o ${USERNAME} && \
  echo "${USERNAME} ALL=(ALL) NOPASSWD: ALL" > /etc/sudoers.d/${USERNAME}

# Install basic tools and libraries
# hadolint ignore=DL3008
RUN \
  apt-get update -y && \
  apt-get -t stable install --no-install-recommends -y \
  build-essential=12.9 \
  ca-certificates=20230311 \
  g++=4:12.2.0-3 \
  gcc-multilib=4:12.2.0-3 \
  gcc=4:12.2.0-3 \
  git=1:2.39.2-1.1 \
  less=590-2 \
  libbz2-dev=1.0.8-5+b1 \
  libffi-dev=3.4.4-1 \
  libgdbm-dev=1.23-3 \
  libncurses5-dev=6.4-4 \
  libnss3-dev=2:3.87.1-1 \
  libreadline-dev=8.2-1.3 \
  libsqlite3-dev=3.40.1-2 \
  libssl-dev=3.0.9-1 \
  make=4.3-4.1 \
  pkg-config=1.8.1-1 \
  procps=2:4.0.2-3 \
  unzip=6.0-28 \
  wget=1.21.3-1+b2 \
  zlib1g-dev=1:1.2.13.dfsg-1 && \
  apt-get -t stable-security install --no-install-recommends -y \
  curl=7.88.1-10+deb12u1 && \
  apt-get clean && \
  rm -rf /var/lib/apt/lists/*

# Setup shell
# hadolint ignore=DL3008
RUN \
  apt-get update -y && \
  apt-get -t stable install --no-install-recommends -y \
  fish && \
  apt-get clean && \
  rm -rf /var/lib/apt/lists/* && \
  gosu ${USERNAME} fish -c ' \
  curl -sL https://git.io/fisher | source && \
  fisher install jorgebucaran/fisher && \
  fisher install pure-fish/pure \
  '

# Install asdf
ARG ASDF_VERSION=0.13.1
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
ARG NODE_VERSIONS="20.0.0 20.8.0"
RUN \
  gosu ${USERNAME} fish -c " \
  asdf plugin add nodejs && \
  echo ${NODE_VERSIONS} | xargs -d' ' -n1 asdf install nodejs \
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
  bat=0.22.1-4 \
  exa=0.10.1-4+b1 \
  fd-find=8.6.0-3 \
  neovim=0.7.2-7 \
  openssh-client=1:9.2p1-2 \
  postgresql=15+248 \
  ripgrep=13.0.0-4+b2 \
  tmux=3.3a-3 \
  unzip=6.0-28 && \
  apt-get clean && \
  rm -rf /var/lib/apt/lists/* && \
  ln -s /usr/bin/batcat /usr/local/bin/bat && \
  curl -L 'https://github.com/dandavison/delta/releases/download/0.16.5/delta-0.16.5-x86_64-unknown-linux-gnu.tar.gz' | tar xz -C /tmp && \
  mv /tmp/delta-0.16.5-x86_64-unknown-linux-gnu/delta /usr/local/bin && \
  rm -rf /tmp/delta-0.16.5-x86_64-unknown-linux-gnu && \
  curl -L 'https://github.com/lotabout/skim/releases/download/v0.9.4/skim-v0.9.4-x86_64-unknown-linux-musl.tar.gz' | tar xz -C /tmp && \
  mv /tmp/sk /usr/local/bin && \
  curl -L 'https://github.com/hadolint/hadolint/releases/download/v2.12.0/hadolint-Linux-x86_64' -o /usr/local/bin/hadolint && \
  chmod 755 /usr/local/bin/hadolint && \
  gosu ${USERNAME} fish -c " \
  python -m pip install \
  ansible==8.4.0 \
  ansible-lint==6.19.0 && \
  asdf reshim python \
  " && \
  gosu ${USERNAME} fish -c " \
  mkdir /tmp/awscliv2 && \
  cd /tmp/awscliv2 && \
  curl 'https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip' -o 'awscliv2.zip' && \
  unzip awscliv2.zip && \
  sudo ./aws/install \
  "

# Copy .config/
COPY ./.devcontainer/docker/config/ /home/${USERNAME}/.config
RUN \
  chown devuser:devusers -R /home/${USERNAME}/.config

WORKDIR /workspace

EXPOSE 3000

CMD ["/usr/bin/tail", "-f", "/dev/null"]
