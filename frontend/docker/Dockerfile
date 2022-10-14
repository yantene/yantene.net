FROM node:18-slim as build

WORKDIR /usr/src/app

# install packages for build
COPY ./package*.json ./
RUN mkdir ./frontend
COPY ./frontend/package.json ./frontend
RUN npm ci --workspace frontend

# build
COPY ./frontend/ ./frontend/
RUN npm run --workspace frontend build

FROM node:18-slim as production

WORKDIR /usr/src/app

# install packages for production
COPY ./package*.json ./
RUN mkdir ./frontend
COPY ./frontend/package.json ./frontend
RUN npm ci --workspace frontend --omit=dev

# prepare assets
COPY --from=build /usr/src/app/frontend/.next /usr/src/app/frontend/.next

WORKDIR /usr/src/app/frontend

EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/npm"]

CMD ["run", "start"]
