import { notesApp } from "~/backend/handlers/api/v1/notes";
import { HeroSection } from "../components/hero/hero-section";
import { Header } from "../components/layout/header";
import { NotesSection } from "../components/notes/notes-section";
import type { Route } from "./+types/home";
import type { NotesListResponse } from "~/lib/types/notes";

const INITIAL_PER_PAGE = 12;

export function meta(_args: Route.MetaArgs): ReturnType<Route.MetaFunction> {
  return [
    { title: "やんてね！" },
    { name: "description", content: "自己表現・技術実験・発信の場" },
  ];
}

export async function loader({ context }: Route.LoaderArgs): Promise<{
  notes: NotesListResponse["notes"];
  totalPages: number;
}> {
  const response = await notesApp.request(
    `/?page=1&per-page=${String(INITIAL_PER_PAGE)}`,
    {},
    context.cloudflare.env,
  );
  const data: NotesListResponse = await response.json();

  return {
    notes: data.notes,
    totalPages: data.pagination.totalPages,
  };
}

export default function Home({
  loaderData,
}: Route.ComponentProps): React.JSX.Element {
  return (
    <div>
      <div className="relative">
        <Header variant="transparent" />
        <HeroSection />
      </div>
      <NotesSection
        initialNotes={loaderData.notes}
        initialTotalPages={loaderData.totalPages}
      />
    </div>
  );
}
