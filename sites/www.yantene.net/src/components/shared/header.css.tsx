import { style } from "@vanilla-extract/css";
import { variables } from "../../variables";

export const styles = {
  header: style({
    backgroundColor: variables.colors.primary,
    filter: "drop-shadow(0 0 10px #0007)",
    height: variables.header.height,
    position: "fixed",
    top: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  }),
  logo: style({}),
  button: style({
    backgroundColor: "transparent",
    border: "none",
    // 高さを親要素いっぱいにする
    height: "100%",
    width: variables.header.height,
  }),
  buttonIcon: style({
    width: "30px",
  }),
};