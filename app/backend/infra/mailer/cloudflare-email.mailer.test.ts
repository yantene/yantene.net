import { describe, expect, it } from "vitest";
import { CloudflareEmailMailer } from "./cloudflare-email.mailer";

describe("CloudflareEmailMailer", () => {
  it("from を補い、builder 形式で Send Email バインディングを呼ぶ", async () => {
    const calls: {
      from: string;
      to: string;
      subject: string;
      text?: string;
    }[] = [];
    const binding = {
      send: (builder: {
        from: string;
        to: string;
        subject: string;
        text?: string;
      }) => {
        calls.push(builder);
        return Promise.resolve();
      },
    } as unknown as SendEmail;

    const mailer = new CloudflareEmailMailer(binding, "noreply@app.test");
    await mailer.send({
      to: "user@example.com",
      subject: "Sign in",
      body: "https://app.test/cb?token=abc",
    });

    expect(calls).toEqual([
      {
        from: "noreply@app.test",
        to: "user@example.com",
        subject: "Sign in",
        text: "https://app.test/cb?token=abc",
      },
    ]);
  });
});
