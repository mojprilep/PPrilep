/**
 * Teaser for the current Кино анкета, shown on the events page.
 *
 * A server component that renders nothing when no poll is live — the events
 * page should not carry a dead slot between polls. Voting happens on /kino, so
 * this stays a link and does not pull in the poll's client state.
 */

import Link from "@/components/ui/Link";
import { ChevronRight, Film } from "lucide-react";

import { formatScreening, isLive, loadPoll } from "../../lib/sanity/moviePoll";

export default async function MoviePollCard() {
  const poll = await loadPoll(null);
  if (!poll || !isLive(poll)) return null;

  return (
    <Link
      href="/kino"
      className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white transition-colors hover:border-slate-300">
      {poll.poster_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={poll.poster_url}
          alt=""
          className="aspect-[1200/420] w-full object-cover"
        />
      )}
      <div className="flex items-center gap-3 p-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#2aa99d]/10 text-primary">
          <Film size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-theme-muted">
            Кино анкета
          </span>
          <span className="block truncate text-sm font-semibold text-theme-heading">
            {poll.title}
          </span>
          {poll.screening_at && (
            <span className="block truncate text-xs text-theme-muted">
              Проекција: {formatScreening(poll.screening_at)}
            </span>
          )}
        </span>
        <ChevronRight
          size={18}
          className="shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5"
        />
      </div>
    </Link>
  );
}
