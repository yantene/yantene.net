import { style } from "@vanilla-extract/css";
import { vars } from "../../app/theme.css";
import { size } from "../../variables/size";

export const styles = {
  header: style([
    {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      position: "fixed",
      top: 0,
    },
    {
      width: "100%",
      height: size.header.height,
      padding: "0 8px",
      "@media": {
        [`screen and (${size.mobileMaxWidth}px < width)`]: {},
      },
    },
    {
      backgroundColor: vars.color.main,
      filter: `drop-shadow(0 0 10px #0007)`,
    },
  ]),
  rightArea: style([
    {
      height: "100%",
      padding: "8px 0",
    },
  ]),
  centerArea: style([
    {
      display: "flex",
      alignItems: "center",
    },
    {
      height: "100%",
      padding: "8px 0",
    },
  ]),
  leftArea: style([
    {
      height: "100%",
      padding: "8px 0",
    },
  ]),
  logoLink: style([
    {
      height: "100%",
    },
    {
      ":hover": {
        filter: `brightness(90%)`,
        transition: "0.3s ease",
      },
    },
  ]),
  logoImage: style([
    {
      objectFit: "contain",
    },
  ]),
};
