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
  button: style({
    backgroundColor: "transparent",
    border: "none",
    // 高さを親要素いっぱいにする
    height: "100%",
    width: size.header.height.mobile,
  }),
  buttonIcon: style({
    width: "30px",
  }),
};
