import { describe, expect, it } from "vitest";
import { buildReactionMail } from "./reaction-mail";
import { EmailAddress } from "~/backend/domain/auth";

const TO = EmailAddress.create("admin@example.com");
const ARTICLE_URL = "https://yantene.net/articles/alpha";

describe("buildReactionMail", () => {
  it("新しく付いたときは、題と絵文字といまの数とリンクを載せる", () => {
    const mail = buildReactionMail({
      to: TO,
      subjectPrefix: "",
      articleTitle: "Alpha",
      articleUrl: ARTICLE_URL,
      emoji: "❤️",
      previous: undefined,
      reactions: [
        { emoji: "❤️", count: 3 },
        { emoji: "🎉", count: 1 },
      ],
    });

    expect(mail.to.toString()).toBe("admin@example.com");
    expect(mail.subject).toBe("「Alpha」に ❤️ が付きました");
    expect(mail.text).toContain("「Alpha」に ❤️ が付きました。");
    expect(mail.text).toContain("いまのリアクション: ❤️ 3、🎉 1");
    expect(mail.text).toContain(ARTICLE_URL);
    expect(mail.html).toContain(`href="${ARTICLE_URL}"`);
  });

  it("付け替えたときは、前の絵文字も載せる", () => {
    const mail = buildReactionMail({
      to: TO,
      subjectPrefix: "",
      articleTitle: "Alpha",
      articleUrl: ARTICLE_URL,
      emoji: "🎉",
      previous: "❤️",
      reactions: [{ emoji: "🎉", count: 1 }],
    });

    expect(mail.subject).toBe("「Alpha」に 🎉 が付きました");
    expect(mail.text).toContain("❤️ から 🎉 に付け替えられました。");
  });

  it("件名に環境の印を前置できる", () => {
    const mail = buildReactionMail({
      to: TO,
      subjectPrefix: "[staging] ",
      articleTitle: "Alpha",
      articleUrl: ARTICLE_URL,
      emoji: "❤️",
      previous: undefined,
      reactions: [{ emoji: "❤️", count: 1 }],
    });

    expect(mail.subject).toBe("[staging] 「Alpha」に ❤️ が付きました");
  });

  it("数が 0 の絵文字は載せない", () => {
    const mail = buildReactionMail({
      to: TO,
      subjectPrefix: "",
      articleTitle: "Alpha",
      articleUrl: ARTICLE_URL,
      emoji: "🎉",
      previous: "❤️",
      reactions: [
        { emoji: "❤️", count: 0 },
        { emoji: "🎉", count: 1 },
      ],
    });

    expect(mail.text).toContain("いまのリアクション: 🎉 1");
  });

  it("HTML に入れる題はエスケープする", () => {
    const mail = buildReactionMail({
      to: TO,
      subjectPrefix: "",
      articleTitle: `<script>alert("x")</script> & co`,
      articleUrl: ARTICLE_URL,
      emoji: "❤️",
      previous: undefined,
      reactions: [{ emoji: "❤️", count: 1 }],
    });

    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; co");
  });
});
