import withPWAInit from "@ducanh2912/next-pwa";

import { createVanillaExtractPlugin } from "@vanilla-extract/next-plugin";

const withVanillaExtract = createVanillaExtractPlugin();

const withPWA = withPWAInit({
  dest: "public",
});

export default withVanillaExtract(withPWA());
