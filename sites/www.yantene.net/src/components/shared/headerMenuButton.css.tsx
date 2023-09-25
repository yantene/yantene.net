import { style } from "@vanilla-extract/css";
import { variables } from "../../variables";

export const styles = {
  button: style({
    backgroundColor: "transparent",
    border: "none",
    height: "100%",
    width: variables.header.height,
  }),
};
