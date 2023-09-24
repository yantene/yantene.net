import { style } from "@vanilla-extract/css";
import { variables } from "../../variables";

export const styles = {
  footer: style({
    backgroundColor: variables.colors.primary,
    height: variables.footer.height,
    position: "fixed",
    bottom: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  }),
};
