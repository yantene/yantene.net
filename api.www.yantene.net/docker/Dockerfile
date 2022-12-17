FROM node:18-slim as build

WORKDIR /usr/src/app

# install packages for build
COPY ./package*.json ./
RUN mkdir ./api.www.yantene.net
COPY ./api.www.yantene.net/package.json ./api.www.yantene.net
RUN npm ci --workspace api.www.yantene.net

# build
COPY ./api.www.yantene.net/ ./api.www.yantene.net/
RUN npm run --workspace api.www.yantene.net build

FROM node:18-slim as production

WORKDIR /usr/src/app

# install packages for production
COPY ./package*.json ./
RUN mkdir ./api.www.yantene.net
COPY ./api.www.yantene.net/package.json ./api.www.yantene.net
RUN npm ci --workspace api.www.yantene.net --omit=dev

# prepare assets
COPY --from=build /usr/src/app/api.www.yantene.net/dist /usr/src/app/api.www.yantene.net/dist

WORKDIR /usr/src/app/api.www.yantene.net

EXPOSE 3100

ENTRYPOINT ["/usr/local/bin/node"]

CMD ["dist/main"]
