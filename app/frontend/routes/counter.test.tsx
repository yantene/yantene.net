import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Counter from "./counter";

describe("Counter Route", () => {
  it("should render counter with loading state", () => {
    render(<Counter />);

    expect(screen.getByText("Click Counter")).toBeInTheDocument();
    expect(screen.getByText("...")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /increment/i }),
    ).toBeInTheDocument();
  });

  it("should have increment button enabled initially", () => {
    render(<Counter />);

    const button = screen.getByRole("button", { name: /increment/i });
    expect(button).not.toBeDisabled();
  });
});
