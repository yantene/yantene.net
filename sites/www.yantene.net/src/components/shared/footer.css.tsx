import { style } from "@vanilla-extract/css";
import { variables } from "../../variables";

export const styles = {
  footer: style({
    backgroundColor: variables.colors.primary,
    filter: "drop-shadow(0 0 10px #0007)",
    height: variables.footer.height,
    position: "fixed",
    bottom: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  }),
};
