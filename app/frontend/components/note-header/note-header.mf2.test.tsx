import { render } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router";
import { beforeAll, describe, expect, it } from "vitest";
import { NoteHeader } from "./note-header";
import type { i18n } from "i18next";
import { WebmentionUrl } from "~/backend/domain/webmention";
import { readMention } from "~/backend/services/webmention-source-reader";
import { createI18nInstance } from "~/lib/i18n/init";

/*
 * 記事が「誰の・何という記事か」を名乗るための印。壊れても画面には何も出ないので、
 * ここで形を固定する (hero-section.mf2.test.tsx と同じ理由)。
 *
 * この印を読むのは、こちらの記事から誰かの記事へリンクしたときに、相手側の受け口で
 * 走るパーサである。名乗りが崩れると、相手のページにこちらの言及が名無しで並ぶ。
 */
const ORIGIN = "https://yantene.net";
const SLUG = "hello-world";
const TITLE = "はじめてのノート";
const PUBLISHED_ON = "2026-05-08";

/** i18n を持ち回すための入れ物。トップレベル変数を関数から書き換えない。 */
const i18nRef: { current: i18n | undefined } = { current: undefined };

beforeAll(async () => {
  i18nRef.current = await createI18nInstance("ja");
});

/** 本文からリンクしている先。送り先のパーサはこれを手掛かりに entry を選ぶ。 */
const TARGET = "https://example.com/article";

/**
 * 記事ページと同じ入れ子で描く。
 *
 * `h-entry` は記事全体を包む `<main>` に、`e-content` は本文の描画に付くので
 * (`routes/notes.$slug.tsx`)、NoteHeader だけを裸で描くと h-entry の外に居ることに
 * なってしまう。ここで同じ包みを与える。
 *
 * **この包みは手で組んだものなので、ここで固定できるのは NoteHeader が出す印だけである。**
 * 実際のページで `<main>` に `h-entry` が付いていることは routes/notes.$slug.mf2.test.tsx
 * が見張る。
 *
 * 本文にリンクを 1 つ置いてあるのは、送り先のパーサに実際の道を通らせるため。理由は
 * 下の「送り先のパーサから～」に書いた。
 */
function renderHeader(): HTMLElement {
  const instance = i18nRef.current;
  if (instance === undefined) throw new Error("i18n is not ready");

  const { container } = render(
    <MemoryRouter>
      <I18nextProvider i18n={instance}>
        <main className="h-entry">
          <NoteHeader
            slug={SLUG}
            title={TITLE}
            imageUrl={null}
            tags={["エッセイ"]}
            publishedOn={PUBLISHED_ON}
            origin={ORIGIN}
          />
          <article className="e-content">
            <p>
              本文から <a href={TARGET}>よそ</a> へリンクしている。
            </p>
          </article>
        </main>
      </I18nextProvider>
    </MemoryRouter>,
  );
  return container;
}

/**
 * その印を持つ要素を並べる。
 *
 * **数まで見るために、単数で引かない。** 印が 2 つあるのは無いのと同じくらい困る。
 * 受け手は `propertyUrls(...).at(0)` のように先頭を採るので、余分な `u-url` が
 * 1 つ紛れ込むと、文書順しだいで別の URL がこの記事の名乗りとして通ってしまう。
 */
function marked(container: HTMLElement, className: string): readonly Element[] {
  return [...container.querySelectorAll(`:scope .${className}`)];
}

describe("NoteHeader の microformats2", () => {
  it("記事を指す u-url を 1 つだけ、絶対 URL で持つ", () => {
    // 相手のサイトで解決されるので、ルート相対だと相手のドメインを指してしまう。
    const urls = marked(renderHeader(), "u-url");

    expect(urls).toHaveLength(1);
    expect(urls[0].getAttribute("href")).toBe(`${ORIGIN}/notes/${SLUG}`);
  });

  it("題を p-name として 1 つだけ持つ", () => {
    const names = marked(renderHeader(), "p-name");

    expect(names).toHaveLength(1);
    expect(names[0].textContent).toBe(TITLE);
  });

  it("公開日を dt-published として 1 つだけ持つ", () => {
    // 画面には "2026.05.08" と出すが、機械が読むのは datetime の側。
    const dates = marked(renderHeader(), "dt-published");

    expect(dates).toHaveLength(1);
    expect(dates[0].getAttribute("datetime")).toBe(PUBLISHED_ON);
  });

  it("書き手を p-author h-card として 1 つだけ持つ", () => {
    const authors = marked(renderHeader(), "p-author");

    expect(authors).toHaveLength(1);
    expect(authors[0].classList.contains("h-card")).toBe(true);
    expect(authors[0].getAttribute("href")).toBe(`${ORIGIN}/`);
    expect(authors[0].textContent).toBe("yantene");
  });

  /*
   * 印の一つ一つではなく、これを読む側から見て何が取れるかを確かめる。自前の
   * webmention-source-reader は受け取った Webmention の送り元を読む道具で、
   * こちらから送るときに相手側で走るのと同じ判定をする。
   *
   * **本文に target へのリンクを置いてあるのが肝。** 置かないと pickEntry は
   * 「h-entry が 1 つしか無いから」という最後の逃げ道でこの entry を選ぶことになり、
   * 実際の送信で通る道 (本文が target にリンクしているから選ぶ) を通らない。逃げ道は
   * 記事ページに h-entry が 2 つ以上できた途端に効かなくなるので、そこを当てにした
   * テストは緑のまま実態だけが壊れる。
   */
  it("送り先のパーサが、本文のリンクからこの記事を選んで読める", () => {
    const html = renderHeader().innerHTML;
    const source = WebmentionUrl.create(`${ORIGIN}/notes/${SLUG}`);
    const target = WebmentionUrl.create(TARGET);

    const mention = readMention(html, source, target);

    expect(mention.author.name).toBe("yantene");
    expect(mention.author.url?.toString()).toBe(`${ORIGIN}/`);
    expect(mention.publishedAt?.toString()).toBe("2026-05-08T00:00:00Z");
  });
});
