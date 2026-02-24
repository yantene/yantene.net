import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerServiceWorker } from "./register-sw";

describe("registerServiceWorker", () => {
  const mockRegister = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("navigator", {
      serviceWorker: {
        register: mockRegister,
      },
    });
    mockRegister.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("serviceWorker がサポートされている場合に登録すること", async () => {
    mockRegister.mockResolvedValue({
      scope: "/",
    });

    await registerServiceWorker();

    expect(mockRegister).toHaveBeenCalledWith("/sw.js", { scope: "/" });
  });

  it("serviceWorker がサポートされていない場合に何もしないこと", async () => {
    vi.stubGlobal("navigator", {});

    await registerServiceWorker();

    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("登録エラーをキャッチしてコンソールに出力すること", async () => {
    const error = new Error("Registration failed");
    mockRegister.mockRejectedValue(error);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await registerServiceWorker();

    expect(consoleSpy).toHaveBeenCalledWith(
      "Service Worker registration failed:",
      error,
    );
    consoleSpy.mockRestore();
  });
});
