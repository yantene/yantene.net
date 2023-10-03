import withPWAInit from "@ducanh2912/next-pwa";

import { createVanillaExtractPlugin } from "@vanilla-extract/next-plugin";

const nextConfig = {
  output: "standalone",
};

export default [
  createVanillaExtractPlugin(),
  withPWAInit({
    dest: "public",
  }),
].reduce((config, plugin) => plugin(config), nextConfig);
