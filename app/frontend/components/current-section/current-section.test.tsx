import { act } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CurrentSection } from "./current-section";
import type { TocHeading } from "~/backend/handlers/articles/toc-headings";
import { withI18n } from "~/frontend/lib/test-render";

const renderWithI18n = withI18n();

const headings: TocHeading[] = [
  { id: "intro", text: "はじめに", level: 2 },
  { id: "why", text: "なぜ自作するか", level: 2 },
  { id: "why-detail", text: "既存サービスとの比較", level: 3 },
];

/*
 * IntersectionObserver は happy-dom では動かない (作れても交差を起こさない)。ここで見たい
 * のは「どの交差の組み合わせで何が出るか」なので、交差をこちらから起こせる代役に置き換える。
 *
 * 見張り手は 2 つあり、rootMargin で見分ける。現在地 (use-active-heading) は上部 20% の帯、
 * 本文に入ったか (use-entered-body) はヘッダーの下端。
 */
interface FakeObserver {
  readonly rootMargin: string;
  readonly callback: IntersectionObserverCallback;
  readonly targets: Element[];
}

let observers: FakeObserver[] = [];

function observerFor(rootMargin: string): FakeObserver {
  const found = observers.find((observer) => observer.rootMargin === rootMargin);
  if (found === undefined) throw new Error(`observer not found: ${rootMargin}`);
  return found;
}

/**
 * 現在地の見張り手に「いま帯に入っているのはこの見出しだけ」と伝える。
 *
 * 入る側だけを送っては駄目で、前の見出しが出たことも一緒に送る。実際のスクロールでは
 * 次の見出しが帯に入る前に前の見出しが帯から出るし、見張り手は「帯に入っている中で
 * 最初のもの」を現在地にするので、出る側を送らないと古い見出しが勝ち続ける。
 */
function setBand(activeIds: readonly string[]): void {
  const observer = observerFor("0px 0px -80% 0px");
  const entries = [...document.querySelectorAll(".mdast-prose h2, .mdast-prose h3")].map(
    (target) =>
      ({
        target,
        isIntersecting: activeIds.includes(target.id),
      }) as unknown as IntersectionObserverEntry,
  );
  act(() => {
    observer.callback(entries, {} as IntersectionObserver);
  });
}

/** 本文に入ったかの見張り手に「最初の節を通り過ぎた / まだ手前」と伝える。 */
function setPassedFirstSection(passed: boolean): void {
  const observer = observerFor("-64px 0px 0px 0px");
  act(() => {
    observer.callback(
      [
        {
          boundingClientRect: { top: passed ? -100 : 100 },
          rootBounds: { top: 0 },
        } as unknown as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver,
    );
  });
}

beforeEach(() => {
  observers = [];
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      readonly targets: Element[] = [];
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        /*
         * 代役でもブラウザと同じところで転ぶようにしておく。rootMargin が受けるのは px と
         * % だけで、rem などを渡すと構築の時点で投げる。素通しにすると、本物では
         * hydration ごと落ちる書き方をテストが通してしまう。
         */
        const margin = options?.rootMargin ?? "";
        if (margin !== "" && !/^(-?\d+(px|%)\s*){1,4}$/.test(margin.trim() + " ")) {
          throw new SyntaxError(`rootMargin must be specified in pixels or percent: ${margin}`);
        }
        observers.push({
          rootMargin: options?.rootMargin ?? "",
          callback,
          targets: this.targets,
        });
      }
      observe(element: Element): void {
        this.targets.push(element);
      }
      disconnect(): void {}
      unobserve(): void {}
    },
  );

  // 現在地の見張り手は本文の見出しを document から拾う。無いと何も見張らずに降りる。
  document.body.innerHTML = `
    <article class="mdast-prose">
      <h2 id="intro">はじめに</h2>
      <h2 id="why">なぜ自作するか</h2>
      <h3 id="why-detail">既存サービスとの比較</h3>
    </article>`;
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

function renderBar(list: readonly TocHeading[] = headings): HTMLElement {
  const Stub = createRoutesStub([
    { path: "/articles/:slug", Component: () => <CurrentSection headings={list} /> },
  ]);
  return renderWithI18n(<Stub initialEntries={["/articles/foo"]} />, { router: false }).container;
}

/** 帯に出ている節の名前。出ていなければ null。 */
function shownSection(container: HTMLElement): string | null {
  return container.querySelector(".current-section-name")?.textContent ?? null;
}

describe("CurrentSection", () => {
  it("最初の節を通り過ぎるまで出ない", () => {
    const container = renderBar();
    setBand(["intro"]);
    expect(shownSection(container)).toBeNull();

    setPassedFirstSection(true);
    expect(shownSection(container)).toBe("はじめに");
  });

  it("上に戻ると消える (表題が見えている画面に節名を出さない)", () => {
    const container = renderBar();
    setBand(["intro"]);
    setPassedFirstSection(true);
    expect(shownSection(container)).toBe("はじめに");

    setPassedFirstSection(false);
    expect(shownSection(container)).toBeNull();
  });

  it("節をまたぐと名前が入れ替わる", () => {
    const container = renderBar();
    setPassedFirstSection(true);
    setBand(["intro"]);
    expect(shownSection(container)).toBe("はじめに");

    setBand(["why"]);
    expect(shownSection(container)).toBe("なぜ自作するか");
  });

  /*
   * 出したいのは章の名前であって、章の中の小見出しではない。
   */
  it("h3 を読んでいるときは、抱えている h2 の名前が出る", () => {
    const container = renderBar();
    setPassedFirstSection(true);
    setBand(["why-detail"]);
    expect(shownSection(container)).toBe("なぜ自作するか");
  });

  it("節が 1 つしかなければ出ない (名前を出しても行き先が無い)", () => {
    const container = renderBar([{ id: "intro", text: "はじめに", level: 2 }]);
    setPassedFirstSection(true);
    setBand(["intro"]);
    expect(shownSection(container)).toBeNull();
  });

  it("見出しが無ければ出ない", () => {
    expect(shownSection(renderBar([]))).toBeNull();
  });
});
