FROM node:18-slim as build

WORKDIR /usr/src/app

# install packages for build
COPY ./package*.json ./
RUN mkdir ./backend
COPY ./backend/package.json ./backend
RUN npm ci --workspace backend

# build
COPY ./backend/* ./backend
RUN npm run --workspace backend build

FROM node:18-slim as production

WORKDIR /usr/src/app

# install packages for production
COPY ./package*.json ./
RUN mkdir ./backend
COPY ./backend/package.json ./backend
RUN npm ci --workspace backend --only=production

# prepare assets
COPY --from=build /usr/src/app/backend/dist /usr/src/app/backend/dist

WORKDIR /usr/src/app/backend

ENTRYPOINT ["/usr/local/bin/node"]

CMD ["dist/main"]
