import { Link } from "react-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import type { NoteListItem } from "~/lib/types/notes";

type NoteCardProps = {
  readonly note: NoteListItem;
};

const formatDate = (dateString: string): string => {
  const [year, month, day] = dateString.split("-");
  return `${year}/${month}/${day}`;
};

export function NoteCard({ note }: NoteCardProps): React.JSX.Element {
  return (
    <Link to={`/notes/${note.slug}`} className="group block">
      <Card className="h-full overflow-hidden border-border/50 transition-all duration-300 group-hover:neon-glow-cyan group-hover:border-primary/30">
        <div className="aspect-video w-full overflow-hidden bg-muted">
          {note.imageUrl.length > 0 ? (
            <img
              src={note.imageUrl}
              alt={note.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <span className="text-4xl">📝</span>
            </div>
          )}
        </div>
        <CardHeader className="gap-1">
          <CardTitle className="line-clamp-2 text-base transition-colors group-hover:text-primary">
            {note.title}
          </CardTitle>
          <CardDescription>
            <time dateTime={note.publishedOn}>
              {formatDate(note.publishedOn)}
            </time>
          </CardDescription>
        </CardHeader>
        {note.summary.length > 0 && (
          <CardContent className="pt-0">
            <p className="line-clamp-3 text-sm text-muted-foreground">
              {note.summary}
            </p>
          </CardContent>
        )}
      </Card>
    </Link>
  );
}
