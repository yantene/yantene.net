import { style, keyframes } from "@vanilla-extract/css";
import { variables } from "../../variables";

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
    display: "unset",
    opacity: 1,
    transform: "translateX(0)",
  },
  to: {
    opacity: 0,
    transform: "translateX(-100%)",
  },
});

export const styles = {
  aside: style({
    backgroundColor: variables.colors.secondary,
    position: "fixed",
    overflowY: "auto",
    width: 200,
    height: `calc(100vh - ${variables.size.header.height.mobile}px)`,
    top: variables.size.header.height.mobile,
    filter: `drop-shadow(0 0 10px #0007)`,
    "@media": {
      [`screen and (${variables.size.mobileMaxWidth}px < width)`]: {
        height: `calc(100vh - ${variables.size.header.height.desktop}px)`,
        top: variables.size.header.height.desktop,
      },
    },
  }),
  fadeIn: style({
    display: "unset",
    animation: `${fadeIn} 1s`,
  }),
  fadeOut: style({
    display: "none",
    animation: `${fadeOut} 1s`,
  }),
  list: style({
    margin: "40px 0",
    listStyleType: "none",
  }),
  item: style({
    borderBottom: `1px solid ${variables.colors.borderOnSecondary}`,
    ":first-of-type": {
      borderTop: `1px solid ${variables.colors.borderOnSecondary}`,
    },
    color: variables.colors.textOnSecondary,
    height: 60,
  }),
  itemAnchor: style({
    padding: "0 10px",
    display: "flex",
    height: "100%",
    alignItems: "center",
    ":hover": {
      transition: "0.3s ease",
      color: variables.colors.textOnPrimary,
      backgroundColor: variables.colors.primary,
    },
  }),
  itemIcon: style({
    width: 42,
    height: 42,
    padding: 5,
    marginRight: 8,
  }),
  itemLabel: style({
    fontSize: 24,
  }),
};
