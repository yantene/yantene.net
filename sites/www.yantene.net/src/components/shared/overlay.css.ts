import { style } from "@vanilla-extract/css";

export const styles = {
  overlay: style([
    {
      display: "none",
      position: "fixed",
      inset: 0,
    },
    {
      backgroundColor: "#0000",
      transition: "background-color 0.1s",
    },
    {
      cursor: "pointer",
    },
  ]),
  smoken: style([
    {
      backgroundColor: "#000a",
    },
  ]),
  show: style([
    {
      display: "block",
    },
  ]),
};
