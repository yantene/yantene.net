import { createContext } from "react";

export const MenuContext = createContext({
  menuOpen: false,
  toggle: undefined as (() => void) | undefined,
});
