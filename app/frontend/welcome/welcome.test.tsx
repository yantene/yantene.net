import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Welcome } from "./welcome";

describe("Welcome", () => {
  it("ウェルカムメッセージを表示すること", () => {
    const message = "Hello, World!";
    render(<Welcome message={message} />);
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it("React Router のロゴ画像を表示すること", () => {
    render(<Welcome message="Test" />);
    const images = screen.getAllByAltText("React Router");
    expect(images).toHaveLength(2);
  });

  it("リソースリンクを表示すること", () => {
    render(<Welcome message="Test" />);
    expect(screen.getByText("React Router Docs")).toBeInTheDocument();
    expect(screen.getByText("Join Discord")).toBeInTheDocument();
  });

  it("リソースリンクが正しい属性を持つこと", () => {
    render(<Welcome message="Test" />);
    const docsLink = screen.getByText("React Router Docs").closest("a");
    expect(docsLink).toHaveAttribute("href", "https://reactrouter.com/docs");
    expect(docsLink).toHaveAttribute("target", "_blank");
    expect(docsLink).toHaveAttribute("rel", "noreferrer");
  });
});
