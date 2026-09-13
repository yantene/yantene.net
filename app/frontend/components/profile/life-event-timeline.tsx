import type { PublicLifeEvent } from "~/backend/handlers/profile/profile-view";
import { formatLifeEventDate } from "./life-event-date";

interface LifeEventTimelineProps {
  readonly events: readonly PublicLifeEvent[];
}

/**
 * これまでにあった出来事を、古いほうから並べる。
 *
 * 記事のタイムライン (article-timeline) と同じ縦線とドットの見た目にしてある。同じ
 * サイトで時間を辿るものが 2 通りの姿をしていると、別の仕組みに見える。
 *
 * `<time dateTime>` には書かれたままの値を入れる。HTML は `2012-04` も `2012` も
 * 日付として許すので、埋めた桁を出す必要が無い。
 */
export function LifeEventTimeline({ events }: LifeEventTimelineProps): React.JSX.Element {
  return (
    <ol className="life-event-timeline">
      {events.map((event) => (
        <li key={`${event.date}:${event.title}`} className="life-event-item">
          <div className="life-event-body">
            <span className="life-event-dot" aria-hidden="true" />
            <div className="life-event-content">
              <time className="life-event-date" dateTime={event.date}>
                {formatLifeEventDate(event.date, event.precision)}
              </time>
              <h3 className="life-event-title">{event.title}</h3>
              {event.description !== null && (
                <p className="life-event-description">{event.description}</p>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
