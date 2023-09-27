import { style, keyframes } from "@vanilla-extract/css";
import { variables } from "../variables";

const yanteneHeight = `calc((100vh - ${
  variables.size.header.height.desktop
}px) * 0.7)`;

const yura2 = keyframes({
  "0%": {
    transform: "translateX(10px) rotate(-3deg)",
  },
  "25%": {
    transform: "translateY(10px) rotate(0deg)",
  },
  "50%": {
    transform: "translateX(-10px) rotate(3deg)",
  },
  "75%": {
    transform: "translateY(-10px) rotate(0deg)",
  },
  "100%": {
    transform: "translateX(10px) rotate(-3deg)",
  },
});

export const styles = {
  main: style({
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh",
    paddingTop: variables.size.header.height.desktop,
    backgroundImage: "url(/images/background.svg)",
    backgroundSize: "cover",
    backgroundPosition: "center",
  }),
  yantene: style({
    backgroundImage: "url(/images/yantene.svg)",
    backgroundSize: `auto ${yanteneHeight}`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "center",
    filter: "drop-shadow(0 0 100px #0006)",
    height: yanteneHeight,
    width: yanteneHeight,
    flexShrink: 0,
    animation: `${yura2} 10s infinite`,
    animationTimingFunction: "linear",
  }),
};
