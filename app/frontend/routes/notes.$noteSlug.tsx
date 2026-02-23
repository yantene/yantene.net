import { notesApp } from "~/backend/handlers/api/v1/notes";
import "~/frontend/components/article/article.css";
import { extractTocEntries } from "../components/article/heading-utils";
import { MdastRenderer } from "../components/article/mdast-renderer";
import { TableOfContents } from "../components/article/table-of-contents";
import { Header } from "../components/layout/header";
import type { Route } from "./+types/notes.$noteSlug";
import type { NoteDetailResponse } from "~/lib/types/notes";

export function meta({
  loaderData,
}: Route.MetaArgs): ReturnType<Route.MetaFunction> {
  return [
    { title: `${loaderData.title} | やんてね！` },
    { name: "description", content: loaderData.title },
    { property: "og:title", content: loaderData.title },
    { property: "og:image", content: loaderData.imageUrl },
  ];
}

export async function loader({
  params,
  context,
}: Route.LoaderArgs): Promise<NoteDetailResponse> {
  const response = await notesApp.request(
    `/${params.noteSlug}`,
    {},
    context.cloudflare.env,
  );

  if (!response.ok) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Router convention
    throw new Response(null, { status: response.status });
  }

  const json: NoteDetailResponse = await response.json();
  return json;
}

const formatDate = (dateString: string): string => dateString;

export default function NoteDetail({
  loaderData,
}: Route.ComponentProps): React.JSX.Element {
  const note = loaderData;
  const tocEntries = extractTocEntries(note.content);

  return (
    <div>
      <Header variant="solid" />

      {/* Hero image */}
      {note.imageUrl.length > 0 && (
        <div className="relative h-64 w-full overflow-hidden bg-muted sm:h-80 md:h-96">
          <img
            src={note.imageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      )}

      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* Article header */}
        <header className="mb-10">
          <h1 className="mb-4 text-3xl font-bold leading-tight sm:text-4xl">
            {note.title}
          </h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <time dateTime={note.publishedOn}>
              {formatDate(note.publishedOn)}
            </time>
            {note.publishedOn !== note.lastModifiedOn && (
              <span>（更新: {formatDate(note.lastModifiedOn)}）</span>
            )}
          </div>
        </header>

        {/* Two-column layout: content + ToC */}
        <div className="relative lg:grid lg:grid-cols-[1fr_220px] lg:gap-12">
          <article>
            <MdastRenderer content={note.content} />
          </article>

          {tocEntries.length > 0 && (
            <aside className="hidden lg:block">
              <div className="sticky top-20">
                <TableOfContents entries={tocEntries} />
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
