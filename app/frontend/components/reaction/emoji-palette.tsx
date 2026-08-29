import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiMagnifyingGlass } from "react-icons/hi2";
import { filterPalette, loadPalette } from "./emoji-palette-data";
import type { PaletteGroup } from "./emoji-palette-data";

type EmojiPaletteProps = {
  /** 選んだ絵文字を返す。閉じるのは呼び出し側の役目。 */
  readonly onPick: (emoji: string) => void;
};

/**
 * 絵文字を選ぶパレット。
 *
 * 分類ごとに並べ、語で絞り込める。肌の色・髪の色の派生は最初から入っていない
 * (生成の時点で落としてある) ので、ここで除く処理は要らない。
 *
 * データは開いたときに初めて読む。記事を開いただけの人に数百 KB を配らないため、
 * 読み終わるまでは「読み込み中」を出す。
 */
export function EmojiPalette({ onPick }: EmojiPaletteProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const [groups, setGroups] = useState<readonly PaletteGroup[] | undefined>(undefined);
  const [hasFailed, setFailed] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    /*
     * 読み終わる前に外れたら書き込まない。ロケールを切り替えた直後などに、
     * 前の言語の結果で上書きしてしまうため。
     */
    const controller = new AbortController();

    void (async () => {
      try {
        const loaded = await loadPalette(i18n.language);
        if (!controller.signal.aborted) setGroups(loaded);
      } catch {
        // 黙って空のパレットを出すと、壊れているのか絵文字が無いのか区別がつかない。
        if (!controller.signal.aborted) setFailed(true);
      }
    })();

    return () => {
      controller.abort();
    };
  }, [i18n.language]);

  if (hasFailed) {
    return <p className="emoji-palette-status">{t("reaction.paletteFailed")}</p>;
  }
  if (groups === undefined) {
    return <p className="emoji-palette-status">{t("reaction.loading")}</p>;
  }

  const shown = filterPalette(groups, query);

  return (
    <div className="emoji-palette">
      <label className="emoji-palette-search">
        <HiMagnifyingGlass aria-hidden />
        <input
          type="search"
          value={query}
          placeholder={t("reaction.searchPlaceholder")}
          aria-label={t("reaction.searchPlaceholder")}
          autoComplete="off"
          onChange={(event) => {
            setQuery(event.target.value);
          }}
        />
      </label>

      {shown.length === 0 ? (
        <p className="emoji-palette-status">{t("reaction.noMatch")}</p>
      ) : (
        <div className="emoji-palette-scroll">
          {shown.map((group) => (
            <section key={group.name} className="emoji-palette-group">
              <h3 className="emoji-palette-heading">{group.name}</h3>
              <div className="emoji-palette-grid">
                {group.emojis.map((emoji) => (
                  <button
                    key={emoji.u}
                    type="button"
                    // 名前を読み上げに出す。絵文字だけだと環境によって読みが揺れる。
                    aria-label={emoji.l}
                    title={emoji.l}
                    className="emoji-palette-item press-control"
                    onClick={() => {
                      onPick(emoji.u);
                    }}
                  >
                    {emoji.u}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
