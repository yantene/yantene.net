import { describe, expect, it } from "vitest";
import { counterApp } from "./index";

describe("Counter API Handler", () => {
  it("should be a Hono app instance", () => {
    expect(counterApp).toBeDefined();
    expect(typeof counterApp.request).toBe("function");
  });

  it("should handle GET / route", () => {
    const routes = counterApp.routes;
    const getRoute = routes.find((r) => r.method === "GET" && r.path === "/");
    expect(getRoute).toBeDefined();
  });

  it("should handle POST /increment route", () => {
    const routes = counterApp.routes;
    const postRoute = routes.find(
      (r) => r.method === "POST" && r.path === "/increment",
    );
    expect(postRoute).toBeDefined();
  });
});
