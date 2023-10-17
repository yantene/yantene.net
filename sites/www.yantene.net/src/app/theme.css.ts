import { createGlobalTheme } from "@vanilla-extract/css";

export const vars = createGlobalTheme(":root", {
  color: {
    base: "hsl(35, 76%, 95%)",
    main: "hsl(212, 50%, 65%)",
    accent: "hsl(44, 100%, 50%)",
    textOnBase: "hsl(0, 0%, 25%)",
    textOnMain: "hsl(0, 0%, 95%)",
  },
});
