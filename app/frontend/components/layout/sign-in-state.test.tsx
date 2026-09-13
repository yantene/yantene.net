import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SignInState } from "./sign-in-state";
import { withI18n } from "~/frontend/lib/test-render";

const renderWithI18n = withI18n("en");

/** `/api/v1/me` の応答を差し替える。 */
function stubMe(body: unknown, options?: { readonly ok?: boolean }): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        ok: options?.ok ?? true,
        json: () => Promise.resolve(body),
      } as Response),
    ),
  );
}

/**
 * 足元の Sign in / Sign out (#490)。
 *
 * **サーバー側では描かない** (#480)。SSR が出すのは常に Sign in で、ログイン中かどうかは
 * マウント後に `/api/v1/me` を引いて入れ替える。ここで固定するのは「倒れる先」で、
 * 読めない応答や失敗を Sign out 側に倒すと、入っていない人に出ていく口を見せてしまう。
 */
describe("SignInState", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("照会する前は Sign in を出す", () => {
    stubMe({ signedIn: false });
    renderWithI18n(<SignInState />);

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
  });

  it("ログイン中と分かったら Sign out に入れ替える", async () => {
    stubMe({ signedIn: true, email: "contact@yantene.net", admin: true });
    renderWithI18n(<SignInState />);

    const button = await screen.findByRole("button", { name: "Sign out" });
    // 出ていくのは副作用なので POST。
    expect(button.closest("form")).toHaveAttribute("action", "/sign-out");
    expect(button.closest("form")).toHaveAttribute("method", "post");
  });

  it("ログインしていなければ Sign in のまま", async () => {
    stubMe({ signedIn: false });
    renderWithI18n(<SignInState />);

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
  });

  it.each([
    ["応答が読めない", { signedIn: "yes" }, { ok: true }],
    ["応答が JSON ですらない", null, { ok: true }],
    ["照会そのものが失敗した", {}, { ok: false }],
  ])("%s ときは Sign in に倒す", async (_name, body, options) => {
    stubMe(body, options);
    renderWithI18n(<SignInState />);

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
  });

  /** Storybook とテストのための口。渡したときは照会しない。 */
  it("signedIn を渡されたら照会しない", () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    renderWithI18n(<SignInState signedIn />);

    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });
});
