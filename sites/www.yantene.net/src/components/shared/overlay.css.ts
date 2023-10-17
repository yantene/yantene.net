import { style } from "@vanilla-extract/css";

export const styles = {
  overlay: style([
    {
      position: "fixed",
      inset: 0,
    },
    {
      cursor: "pointer",
    },
  ]),
  show: style([
    { display: "block" },
    {
      backgroundColor: "#000a",
      transition: "background-color 0.3s ease",
    },
  ]),
};
