import { style, keyframes } from "@vanilla-extract/css";
import { vars } from "../../app/theme.css";
import { size } from "../../variables/size";

const fadeIn = keyframes({
  from: {
    opacity: 0,
    transform: "translateX(-100%)",
  },
  to: {
    opacity: 1,
    transform: "translateX(0)",
  },
});

const fadeOut = keyframes({
  from: {
    visibility: "visible",
    opacity: 1,
    transform: "translateX(0)",
  },
  to: {
    opacity: 0,
    transform: "translateX(-100%)",
  },
});

export const styles = {
  aside: style([
    {
      position: "fixed",
      top: size.header.height,
    },
    {
      width: 300,
      height: "100%",
      overflowY: "auto",
    },
    {
      backgroundColor: vars.color.base,
      filter: "drop-shadow(0 0 10px #0007)",
    },
  ]),
  fadeIn: style([
    {
      visibility: "visible",
    },
    {
      animation: `${fadeIn} 0.15s`,
    },
  ]),
  fadeOut: style([
    {
      visibility: "hidden",
    },
    {
      animation: `${fadeOut} 0.15s`,
    },
  ]),
  list: style([
    {
      margin: "40px 0",
    },
    {
      listStyleType: "none",
    },
  ]),
  item: style([
    {
      height: 60,
      borderBottom: `1px solid #0003`,
      ":first-of-type": {
        borderTop: `1px solid #0003`,
      },
    },
    {
      color: vars.color.textOnBase,
    },
  ]),
  itemAnchor: style([
    {
      display: "flex",
      alignItems: "center",
    },
    {
      height: "100%",
      padding: "0 10px",
    },
    {
      ":hover": {
        filter: `brightness(90%)`,
        transition: "0.3s ease",
      },
    },
  ]),
  itemIcon: style([
    {
      width: 42,
      height: 42,
      padding: 5,
      marginRight: 8,
    },
  ]),
  itemLabel: style([
    {
      fontSize: 24,
    },
  ]),
};
