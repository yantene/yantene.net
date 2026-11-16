import { toString as mdastToString } from "mdast-util-to-string";
import type { LinkCardMap } from "~/backend/handlers/link-cards/link-card-view";
import type {
  ContentPage,
  SlideBlock,
  SlideDeck,
  SlidePage as SlidePageModel,
} from "~/lib/slides/deck";
import type { Nodes, Root, RootContent } from "mdast";
import { mapTree } from "~/backend/services/mdast-tree";
import { MdastRenderer } from "~/frontend/components/mdast/mdast-renderer";
import { footnoteNumbers } from "~/lib/slides/deck";

/** 表紙に出す、発表の場。 */
export interface SlideEventView {
  readonly name: string;
  /** `YYYY-MM-DD`。書いていなければ null。 */
  readonly date: string | null;
  readonly url: string | null;
}

/** デッキ全体で共通の、ページを描くための材料。 */
export interface SlideContext {
  readonly deck: SlideDeck;
  /** デッキの題 (フロントマターの `title`)。表紙に出る。 */
  readonly title: string;
  readonly author: string;
  readonly event: SlideEventView | null;
  readonly linkCards: LinkCardMap;
  readonly siteOrigin?: string;
}

export interface SlidePageProps {
  readonly page: SlidePageModel;
  /** 何ページ目か (1 始まり)。 */
  readonly number: number;
  /** いまの段。この段より先の塊は、再生中だけ隠れる。 */
  readonly step: number;
  readonly context: SlideContext;
}

/** 一度に出せる番号付きリストの項目の上限。CSS の段階 (slide.css) と揃える。 */
const MAX_REVEALED_ITEMS = 12;

/**
 * スライドの 1 ページ (ADR 0052)。
 *
 * **置き方は `page.layout` が決めていて、ここは描くだけ。** 書き手が選ぶ見た目は無いので、
 * 可変なのは静的なクラスの段階だけになる (`style` 属性は書かない)。
 *
 * 段 (`step`) より先の塊には `is-pending` を付ける。隠すかどうかは CSS が決め、
 * **再生していない間 (JavaScript が動かない・印刷) は全部見える**。
 */
export function SlidePage({ page, number, step, context }: SlidePageProps): React.JSX.Element {
  const total = context.deck.pages.length;
  return (
    <section
      className={`slide-page slide-page-${page.kind} ${layoutClass(page)}`}
      aria-roledescription="slide"
      aria-label={`${String(number)} / ${String(total)}`}
    >
      <PageBody page={page} step={step} context={context} />
      <p className="slide-folio" aria-hidden="true">
        {number} / {total}
      </p>
    </section>
  );
}

/** 並びに 1 始まりの番号を添える。並べ替わらない並びの、要素の身元になる。 */
export function numbered<T>(items: readonly T[]): readonly { item: T; number: number }[] {
  return items.map((item, index) => ({ item, number: index + 1 }));
}

function layoutClass(page: SlidePageModel): string {
  return page.kind === "content" ? `slide-layout-${page.layout}` : "";
}

function PageBody({
  page,
  step,
  context,
}: Pick<SlidePageProps, "page" | "step" | "context">): React.JSX.Element {
  switch (page.kind) {
    case "cover": {
      return <Cover context={context} />;
    }
    case "chapter": {
      return (
        <>
          <p className="slide-chapter-position">
            {String(page.chapter).padStart(2, "0")} /{" "}
            {String(context.deck.chapters).padStart(2, "0")}
          </p>
          <h2 className="slide-title">{textOf(page.title)}</h2>
        </>
      );
    }
    case "references": {
      return (
        <>
          <h2 className="slide-title">References</h2>
          <ol className="slide-references">
            {page.footnotes.map((footnote) => (
              <li key={footnote.identifier}>
                <Blocks nodes={footnote.children} context={context} />
              </li>
            ))}
          </ol>
        </>
      );
    }
    case "content": {
      return <Content page={page} step={step} context={context} />;
    }
  }
}

function Cover({ context }: { readonly context: SlideContext }): React.JSX.Element {
  const { event } = context;
  return (
    <>
      <h2 className="slide-title">{context.title}</h2>
      <p className="slide-cover-author">{context.author}</p>
      {event !== null && (
        <p className="slide-cover-event">
          {event.name}
          {event.date !== null && <time dateTime={event.date}>{event.date}</time>}
        </p>
      )}
    </>
  );
}

function Content({
  page,
  step,
  context,
}: {
  readonly page: ContentPage;
  readonly step: number;
  readonly context: SlideContext;
}): React.JSX.Element {
  return (
    <>
      {page.title.length > 0 && <h2 className="slide-title">{textOf(page.title)}</h2>}
      <div className="slide-body">
        {page.figure !== null && (
          <div className={`slide-figure ${pendingClass(page.figure, step)}`}>
            <Blocks nodes={[page.figure.node]} context={context} />
          </div>
        )}
        {page.blocks.length > 0 && (
          <div className="slide-blocks">
            {numbered(page.blocks).map(({ item: block, number }) => (
              // 塊は並べ替わらないので、ページの中の順番がそのまま身元になる。
              <Block key={number} block={block} step={step} context={context} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function Block({
  block,
  step,
  context,
}: {
  readonly block: SlideBlock;
  readonly step: number;
  readonly context: SlideContext;
}): React.JSX.Element {
  return (
    <div
      className={`slide-block slide-block-${block.node.type} ${pendingClass(block, step)}`}
      // 番号付きリストは 1 項目ずつ出す。いくつ目まで出すかを段階で渡し、隠すのは CSS。
      data-revealed={revealedItems(block, step)}
    >
      <Blocks nodes={[block.node]} context={context} />
    </div>
  );
}

function pendingClass(block: SlideBlock, step: number): string {
  return block.step > step ? "is-pending" : "";
}

/** いまの段までに出ている項目の数。番号付きリストでなければ付けない。 */
function revealedItems(block: SlideBlock, step: number): number | undefined {
  if (block.itemSteps === undefined) return undefined;
  const revealed = block.itemSteps.filter((itemStep) => itemStep <= step).length;
  return Math.min(revealed, MAX_REVEALED_ITEMS);
}

/**
 * MDAST の塊を、記事と同じ経路で描く。数式・コード・Mermaid・リンクカード・Alert・
 * アセットの扱いが記事と同じになる (経路を 2 本にしない)。
 *
 * リンクの参照定義はページをまたいで効くので、どの塊にも添える。
 */
function Blocks({
  nodes,
  context,
}: {
  readonly nodes: readonly RootContent[];
  readonly context: SlideContext;
}): React.JSX.Element {
  const numbers = footnoteNumbers(context.deck);
  const root: Root = {
    type: "root",
    children: [
      ...nodes.map((node) => withPlainFootnotes(node, numbers)),
      ...context.deck.definitions,
    ],
  };
  return (
    <MdastRenderer
      node={root}
      linkCards={context.linkCards}
      {...(context.siteOrigin === undefined ? {} : { siteOrigin: context.siteOrigin })}
    />
  );
}

/**
 * 脚注の参照を、番号だけの上付きの字に替える。
 *
 * **リンクにしない。** 同じ原文を下の読み物も描いていて、そちらが脚注の id を持つ。
 * スライドの側も同じ id を出すと 1 つのページに id が 2 つ並び、読み物の「参照へ戻る」が
 * 隠れているスライドに当たる。行き先は最後の References のページが持つ。
 */
function withPlainFootnotes<T extends Nodes>(node: T, numbers: ReadonlyMap<string, number>): T {
  return mapTree(node, (child) => {
    if (child.type !== "footnoteReference") return child;
    const number = numbers.get(child.identifier);
    return {
      type: "emphasis",
      data: { hName: "sup" },
      children: [{ type: "text", value: number === undefined ? "*" : String(number) }],
    };
  });
}

function textOf(title: ContentPage["title"]): string {
  return mdastToString({ type: "paragraph", children: [...title] });
}
