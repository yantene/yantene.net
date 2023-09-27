import { style } from "@vanilla-extract/css";
import { variables } from "../../variables";

export const styles = {
  button: style({
    backgroundColor: "transparent",
    border: "none",
    height: "100%",
    width: variables.size.header.height.desktop,
    cursor: "pointer",
    ":hover": {
      transition: "0.3s ease",
      color: variables.colors.textOnSecondary,
      backgroundColor: variables.colors.secondary,
    },
  }),
};
