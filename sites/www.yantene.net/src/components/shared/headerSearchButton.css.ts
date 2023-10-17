import { style } from "@vanilla-extract/css";
import { vars } from "../../app/theme.css";
import { size } from "../../variables/size";

export const styles = {
  button: style([
    {
      width: size.header.height,
      height: "100%",
      border: "none",
    },
    {
      backgroundColor: "transparent",
    },
    {
      color: vars.color.textOnMain,
    },
    {
      cursor: "pointer",
    },
    {
      ":hover": {
        filter: `brightness(90%)`,
        transition: "0.3s ease",
      },
    },
  ]),
};
