FROM node:18-slim as build

WORKDIR /usr/src/app

# install packages for build
COPY ./package*.json ./
RUN mkdir ./www.yantene.net
COPY ./www.yantene.net/package.json ./www.yantene.net
RUN npm ci --workspace www.yantene.net

# build
COPY ./www.yantene.net/ ./www.yantene.net/
RUN npm run --workspace www.yantene.net build

FROM node:18-slim as production

WORKDIR /usr/src/app

# install packages for production
COPY ./package*.json ./
RUN mkdir ./www.yantene.net
COPY ./www.yantene.net/package.json ./www.yantene.net
RUN npm ci --workspace www.yantene.net --omit=dev

# prepare assets
COPY --from=build /usr/src/app/www.yantene.net/.next /usr/src/app/www.yantene.net/.next
COPY ./www.yantene.net/public /usr/src/app/www.yantene.net/public

WORKDIR /usr/src/app/www.yantene.net

EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/npm"]

CMD ["run", "start"]
