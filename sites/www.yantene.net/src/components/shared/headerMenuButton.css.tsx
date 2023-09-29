import { style } from "@vanilla-extract/css";
import { vars } from "../../app/theme.css";
import { size } from "../../variables/size";

export const styles = {
  button: style({
    backgroundColor: "transparent",
    border: "none",
    height: "100%",
    width: size.header.height.desktop,
    cursor: "pointer",
    color: vars.color.textOnPrimary,
    ":hover": {
      transition: "0.3s ease",
      color: vars.color.textOnSecondary,
      backgroundColor: vars.color.secondary,
    },
  }),
};
