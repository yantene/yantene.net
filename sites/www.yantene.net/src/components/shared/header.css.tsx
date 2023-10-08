import { style } from "@vanilla-extract/css";
import { vars } from "../../app/theme.css";
import { size } from "../../variables/size";

export const styles = {
  header: style({
    backgroundColor: vars.color.primary,
    filter: `drop-shadow(0 0 10px #0007)`,
    height: size.header.height.mobile,
    position: "fixed",
    top: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    "@media": {
      [`screen and (${size.mobileMaxWidth}px < width)`]: {
        height: size.header.height.desktop,
      },
    },
  }),
  logo: style({}),
  rightArea: style({
    height: "100%",
  }),
  centerArea: style({
    height: "100%",
    display: "flex",
    alignItems: "center",
  }),
  leftArea: style({
    height: "100%",
  }),
};
