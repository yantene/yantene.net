FROM node:18-slim as build

WORKDIR /usr/src/app

# install packages for build
COPY ./sites/api.www.yantene.net/package.json ./
RUN npm ci

# build
COPY ./sites/api.www.yantene.net/ ./
RUN npm run build

FROM node:18-slim as production

WORKDIR /usr/src/app

# install packages for production
COPY ./sites/api.www.yantene.net/ ./
RUN npm ci --omit=dev

# prepare assets
COPY --from=build /usr/src/app/dist /usr/src/app/dist

EXPOSE 3100

ENTRYPOINT ["/usr/local/bin/node"]

CMD ["dist/main"]
