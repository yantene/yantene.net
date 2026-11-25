import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArticlePreviewCard } from "./article-preview-card";
import { articlePreviews } from "./article-preview-client";
import { FootnoteDrawer } from "./footnote-drawer";
import { CLOSE_DELAY_MS, HoverIntent, OPEN_DELAY_MS } from "./hover-intent";
import { PreviewChip } from "./preview-chip";
import { PreviewContext } from "./preview-context";
import type { PreviewController, PreviewTarget } from "./preview-context";
import type { ArticlePreview } from "~/backend/handlers/articles/preview.handler";

/** 記事のプレビューを取りに行く口。見えない記事と取れなかったときは null。 */
export type ArticlePreviewLoader = (slug: string) => Promise<ArticlePreview | null>;

export interface PreviewLayerProps {
  /**
   * 脚注の中身。参照の行き先の id (`user-content-fn-1`) をキーに引く。
   *
   * 本文と同じ描き方で組み終えたものを受け取る (MdastRenderer が組む)。
   */
  readonly footnotes: ReadonlyMap<string, React.ReactNode>;
  /** 記事のプレビューの取り方。省略時はプレビュー API を引く (ページの中で覚える)。 */
  readonly loadArticlePreview?: ArticlePreviewLoader;
  /**
   * 本文の言語。脚注の中身に `lang` として付ける。
   *
   * チップとドロワーは `document.body` の下に出るので、本文の器 (`<article lang>`) から
   * 言語を継げない。付けないと `<html lang>` (UI の言語) で読まれる。
   */
  readonly lang: string;
  /** 本文。この中の FootnoteReference / ArticleLink が引き金になる。 */
  readonly children: React.ReactNode;
}

/** いま出ているチップ。 */
interface OpenChip {
  readonly anchor: Element;
  readonly content: React.ReactNode;
}

const loadFromApi: ArticlePreviewLoader = (slug) => articlePreviews.load(slug);

/** Popover API が使えるか。使えなければチップは出さず、リンクは素のまま振る舞う。 */
function supportsPopover(): boolean {
  return typeof HTMLElement.prototype.showPopover === "function";
}

/** `<dialog>` をモーダルで開けるか。開けなければ、脚注の参照は今までどおり飛ぶ。 */
function supportsModalDialog(): boolean {
  return (
    typeof HTMLDialogElement === "function" &&
    typeof HTMLDialogElement.prototype.showModal === "function"
  );
}

/** 脚注の中身を、本文と同じ組版 (prose) と言語の中に置く。チップとドロワーで共有する。 */
function FootnoteBody({
  lang,
  children,
}: {
  readonly lang: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div lang={lang} className="preview-footnote mdast-prose prose max-w-none">
      {children}
    </div>
  );
}

/**
 * 本文の内部リンクと脚注の参照に、プレビューを出す (ADR 0049)。
 *
 * | 環境                                 | 内部リンク                  | 脚注の参照                  |
 * | ------------------------------------ | --------------------------- | --------------------------- |
 * | `(hover: hover) and (pointer: fine)` | ホバー / フォーカスでチップ | ホバー / フォーカスでチップ |
 * | それ以外 (タッチ)                    | 素のリンク                  | 押すとドロワー              |
 * | JavaScript が動かない・印刷          | 素のリンク                  | `#fn-1` へ飛ぶ              |
 *
 * **サーバーは何も足さない。** チップもドロワーも、読み手が実際に触ってから
 * `document.body` の下に出す。本文 (`e-content`) の中に脚注の写しを置くと、
 * microformats のパーサが読む記事の中身に同じ文が 2 回入り、Popover API の無い
 * ブラウザでは本文の途中にそのまま出てしまう。
 *
 * チップは 1 つだけ持ち、指す相手を付け替える。位置合わせの錨も 1 つの名前で済む
 * (リンクごとに名前を振るには `style` 属性が要る)。
 */
export function PreviewLayer({
  footnotes,
  loadArticlePreview = loadFromApi,
  lang,
  children,
}: PreviewLayerProps): React.JSX.Element {
  const [chip, setChip] = useState<OpenChip | null>(null);
  const chipId = useId();
  const [drawerId, setDrawerId] = useState<string | null>(null);

  const hover = useMemo(() => {
    const targets = new WeakMap<Element, PreviewTarget>();

    const contentOf = async (target: PreviewTarget): Promise<React.ReactNode> => {
      if (target.kind === "footnote") {
        const body = footnotes.get(target.id);
        return body === undefined ? null : <FootnoteBody lang={lang}>{body}</FootnoteBody>;
      }
      const preview = await loadArticlePreview(target.slug);
      return preview === null ? null : <ArticlePreviewCard preview={preview} />;
    };

    const open = async (anchor: Element): Promise<void> => {
      const target = targets.get(anchor);
      if (target === undefined) return;
      const content = await contentOf(target);
      /*
       * 出すものが無ければ出さない (見えない記事・取れなかったとき)。素のリンクのまま。
       * 取りに行っている間に離れた相手にも、遅れて出さない。
       */
      if (content === null || !intent.wants(anchor)) return;
      setChip({ anchor, content });
    };

    const intent: HoverIntent<Element> = new HoverIntent<Element>({
      openDelayMs: OPEN_DELAY_MS,
      closeDelayMs: CLOSE_DELAY_MS,
      onOpen: (anchor) => {
        void open(anchor);
      },
      onClose: () => {
        setChip(null);
      },
    });

    return { intent, targets };
  }, [footnotes, loadArticlePreview, lang]);

  /*
   * 本文が差し替わったら、前の本文を指したままのチップとドロワーを残さない。脚注の id は
   * 記事をまたいで同じ (`user-content-fn-1`) なので、残すと別の記事の脚注が出る。
   */
  useEffect(
    () => () => {
      hover.intent.dispose();
      setChip(null);
      setDrawerId(null);
    },
    [hover],
  );

  // Esc で閉じる。`popover="manual"` はブラウザが閉じてくれないので、ここが持つ。
  const isChipOpen = chip !== null;
  useEffect(() => {
    if (!isChipOpen) return;

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") hover.intent.dismiss();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isChipOpen, hover]);

  const anchor = chip?.anchor ?? null;
  const controller = useMemo<PreviewController>(
    () => ({
      anchor,
      chipId,
      intend: (target, element) => {
        if (!supportsPopover()) return;
        hover.targets.set(element, target);
        hover.intent.enter(element);
      },
      relent: () => {
        hover.intent.leave();
      },
      dismiss: () => {
        hover.intent.dismiss();
      },
      openDrawer: (id) => {
        if (!footnotes.has(id) || !supportsModalDialog()) return false;
        setDrawerId(id);
        return true;
      },
    }),
    [anchor, chipId, hover, footnotes],
  );

  const holdChip = useCallback(() => {
    hover.intent.hold();
  }, [hover]);
  const releaseChip = useCallback(() => {
    hover.intent.release();
  }, [hover]);
  const closeDrawer = useCallback(() => {
    setDrawerId(null);
  }, []);

  return (
    <>
      <PreviewContext value={controller}>{children}</PreviewContext>
      {/*
        チップとドロワーの中身からは持ち主を外す。中のリンクから更にチップを出すと、
        どこまでも入れ子になる。
      */}
      <PreviewContext value={null}>
        {chip !== null &&
          createPortal(
            <PreviewChip id={chipId} onPointerEnter={holdChip} onPointerLeave={releaseChip}>
              {chip.content}
            </PreviewChip>,
            document.body,
          )}
        {drawerId !== null &&
          createPortal(
            <FootnoteDrawer onClose={closeDrawer}>
              <FootnoteBody lang={lang}>{footnotes.get(drawerId)}</FootnoteBody>
            </FootnoteDrawer>,
            document.body,
          )}
      </PreviewContext>
    </>
  );
}
