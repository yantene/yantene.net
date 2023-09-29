import { createGlobalTheme } from "@vanilla-extract/css";

export const vars = createGlobalTheme(":root", {
  color: {
    primary: "#78A2D2", // yantene's eye color
    secondary: "#f9f9f9", // yantene's foodie color
    tertiary: "#d47d7d", // yantene's mouth color
    text: "#242424",
    textOnPrimary: "#fff",
    textOnSecondary: "#606060",
    borderOnSecondary: "#d0d0d0",
  },
});
