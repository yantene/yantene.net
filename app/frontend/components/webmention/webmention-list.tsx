import { useTranslation } from "react-i18next";
import { HiOutlineArrowTopRightOnSquare } from "react-icons/hi2";
import type {
  WebmentionGroups,
  WebmentionView,
} from "~/backend/handlers/webmentions/webmention-view";

export interface WebmentionListProps {
  readonly webmentions: WebmentionGroups;
}

/** 名乗らずに送ってくる相手も居る。名前が無ければ出どころのホスト名で代える。 */
function displayName(mention: WebmentionView): string {
  if (mention.authorName !== null) return mention.authorName;
  try {
    return new URL(mention.source).hostname;
  } catch {
    return mention.source;
  }
}

/**
 * 名前の頭 1 文字。
 *
 * コードポイント単位で取る。コードユニットで切ると絵文字や拡張漢字の片割れだけを
 * 拾ってしまう (`u` 付きの `.` は 1 コードポイントに合う)。
 */
function initialOf(name: string): string {
  return /^./u.exec(name)?.[0] ?? "?";
}

/**
 * 顔ひとつ。アイコンが写せていなければ、名前の頭文字を出す。
 *
 * 画像が無いときに空白を置くと、誰が居るのか分からないまま席だけが並ぶ。
 */
function Face({
  mention,
}: {
  readonly mention: WebmentionView;
}): React.JSX.Element {
  const name = displayName(mention);
  return (
    <a
      className="webmention-face press-control h-card"
      href={mention.authorUrl ?? mention.source}
      target="_blank"
      rel="noopener noreferrer nofollow"
      title={name}
    >
      {mention.authorAvatarUrl === null ? (
        <span className="webmention-face-initial" aria-hidden>
          {initialOf(name)}
        </span>
      ) : (
        <img
          className="webmention-face-photo u-photo"
          src={mention.authorAvatarUrl}
          alt=""
          width={32}
          height={32}
          loading="lazy"
          decoding="async"
        />
      )}
      <span className="sr-only p-name">{name}</span>
    </a>
  );
}

/** 返信・言及ひとつ。誰が・何を・どこで言ったかを出す。 */
function Reply({
  mention,
}: {
  readonly mention: WebmentionView;
}): React.JSX.Element {
  const { t } = useTranslation();
  const name = displayName(mention);

  return (
    <li className="webmention-reply h-cite">
      <a
        className="webmention-reply-author press-control h-card p-author"
        href={mention.authorUrl ?? mention.source}
        target="_blank"
        rel="noopener noreferrer nofollow"
      >
        {mention.authorAvatarUrl !== null && (
          <img
            className="webmention-reply-photo u-photo"
            src={mention.authorAvatarUrl}
            alt=""
            width={28}
            height={28}
            loading="lazy"
            decoding="async"
          />
        )}
        <span className="p-name">{name}</span>
      </a>

      {mention.content !== null && (
        <p className="webmention-reply-content p-content">{mention.content}</p>
      )}

      <a
        className="webmention-reply-source press-control u-url"
        href={mention.source}
        target="_blank"
        rel="noopener noreferrer nofollow"
      >
        <time className="dt-published" dateTime={mention.publishedAt}>
          {mention.publishedAt.slice(0, 10)}
        </time>
        <HiOutlineArrowTopRightOnSquare aria-hidden />
        <span className="sr-only">{t("webmention.openSource")}</span>
      </a>
    </li>
  );
}

/**
 * 記事に届いた Webmention。
 *
 * いいね・リポストは顔だけを並べ、返信・言及は本文の抜粋と出どころを出す。数の多い
 * 前者に本文と同じ面積を割くと、読むべき後者が埋もれるため分けている。
 *
 * microformats2 (h-cite / h-card) を付けているのは、このページを読みに来るパーサ
 * (Bridgy 等) が「誰の何への言及か」を辿れるようにするため。
 *
 * 1 件も無ければ何も描かない。「まだありません」を置くと、反応が無いことを記事の
 * 末尾で毎回宣言することになる。
 */
export function WebmentionList({
  webmentions,
}: WebmentionListProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const { faces, replies } = webmentions;
  if (faces.length === 0 && replies.length === 0) return null;

  return (
    <section className="webmentions" aria-label={t("webmention.heading")}>
      <h2 className="webmentions-heading">{t("webmention.heading")}</h2>

      {faces.length > 0 && (
        <div className="webmention-faces">
          {faces.map((mention) => (
            <Face key={mention.id} mention={mention} />
          ))}
        </div>
      )}

      {replies.length > 0 && (
        <ul className="webmention-replies">
          {replies.map((mention) => (
            <Reply key={mention.id} mention={mention} />
          ))}
        </ul>
      )}
    </section>
  );
}
