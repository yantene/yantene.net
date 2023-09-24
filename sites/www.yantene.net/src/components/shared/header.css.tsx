import { style } from "@vanilla-extract/css";
import { variables } from "../../variables";

export const styles = {
  header: style({
    backgroundColor: variables.colors.primary,
    height: variables.header.height,
    position: "fixed",
    top: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  }),
  logo: style({}),
};
