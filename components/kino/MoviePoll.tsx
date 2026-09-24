"use client";

/**
 * Movie poll — the shared UI for /kino on the web.
 *
 * All state lives behind /api/movie-poll (see that route for the identity
 * rules). This component never touches Supabase directly: votes are written
 * with the service role because anonymous visitors have no RLS identity to
 * write with.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Check, Film, CalendarDays, Pencil, Trash2, X } from "lucide-react";
import Button from "../ui/Button";
import { useAuth } from "../../lib/hooks/useAuth";
import { formatScreening } from "../../lib/sanity/moviePoll";

type Option = { id: number; title: string; votes: number; own: boolean };
type Poll = {
  id: string;
  title: string;
  description: string | null;
  poster_url: string | null;
  screening_at: string | null;
  allow_suggestions: boolean;
  live: boolean;
};

/**
 * A stable per-browser id so a signed-out visitor's vote survives a reload.
 * Shared with the events poll on purpose — it identifies the browser, not the
 * poll, and reusing it means a returning visitor keeps one identity.
 */
const VISITOR_KEY = "pp_visitor_id";

function visitorId(): string {
  if (typeof window === "undefined") return "";
  try {
    let v = localStorage.getItem(VISITOR_KEY);
    if (!v) {
      v = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, v);
    }
    return v;
  } catch {
    // Private mode with storage blocked: the vote still lands, it just will not
    // be recognised as theirs on the next visit.
    return "";
  }
}

/**
 * Polls this browser has voted or suggested in. A signed-out visitor who has
 * never taken part has nothing personal to show, so they get the shared,
 * CDN-cached view; everyone else gets the personal one.
 */
const JOINED_KEY = "pp_moviepoll_joined";

/** Null = never recorded (browsers from before this list existed). */
function joinedPolls(): string[] | null {
  try {
    const stored = localStorage.getItem(JOINED_KEY);
    if (stored === null) return null;
    const raw = JSON.parse(stored);
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function markJoined(id: string | null) {
  try {
    const ids = joinedPolls() ?? [];
    if (id === null || !ids.includes(id)) {
      const next = id === null ? ids : [...ids, id].slice(-20);
      localStorage.setItem(JOINED_KEY, JSON.stringify(next));
    }
  } catch {
    // Storage blocked: they just get the shared view on the next visit.
  }
}

export default function MoviePoll({ pollId }: { pollId?: string }) {
  const { user, loading: authLoading } = useAuth();
  const [poll, setPoll] = useState<Poll | null>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [total, setTotal] = useState(0);
  const [mine, setMine] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);
  // The option currently being renamed, and its draft title. Null = nobody.
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const signedIn = !!user;

  const load = useCallback(async () => {
    const get = async (personal: boolean) => {
      const params = new URLSearchParams();
      if (pollId) params.set("pollId", pollId);
      if (personal) {
        const v = visitorId();
        if (v) params.set("visitorId", v);
      } else {
        params.set("shared", "1");
      }
      const res = await fetch(`/api/movie-poll?${params}`, { cache: "no-store" });
      return res.json();
    };
    try {
      const joined = joinedPolls();
      let data;
      if (!signedIn && joined === null) {
        // First load since this list was introduced: ask once personally, so
        // someone who already voted keeps seeing their vote, and start the list.
        data = await get(true);
        markJoined(data.poll && data.mine != null ? data.poll.id : null);
      } else {
        data = await get(signedIn);
        // Took part in this poll before: their vote needs the personal view.
        if (!signedIn && data.poll && joined?.includes(data.poll.id)) {
          data = await get(true);
        }
      }
      setPoll(data.poll);
      setOptions(data.options ?? []);
      setTotal(data.total ?? 0);
      setMine(data.mine ?? null);
    } catch {
      setPoll(null);
    } finally {
      setLoading(false);
    }
  }, [pollId, signedIn]);

  useEffect(() => {
    // Wait for the session check, so a signed-in user is not first served the
    // shared view and then reloaded.
    if (!authLoading) load();
  }, [load, authLoading]);

  async function send(payload: Record<string, unknown>) {
    if (!poll || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/movie-poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollId: poll.id, visitorId: visitorId(), ...payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Нешто тргна наопаку.");
        return;
      }
      markJoined(poll.id);
      setOptions(data.options ?? []);
      setTotal(data.total ?? 0);
      setMine(data.mine ?? null);
    } catch {
      setError("Нема врска со серверот.");
    } finally {
      setBusy(false);
    }
  }

  function vote(optionId: number) {
    // Tapping your own choice again retracts it, so a vote is never a one-way
    // door — the same behaviour the event poll has.
    if (mine === optionId) send({ action: "remove" });
    else send({ action: "vote", optionId });
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    const name = editTitle.trim();
    if (!name || editingId === null) return;
    await send({ action: "edit", optionId: editingId, title: name });
    setEditingId(null);
  }

  async function removeOption(o: Option) {
    if (!confirm(`Да го тргнеме „${o.title}“ од листата?`)) return;
    await send({ action: "delete", optionId: o.id });
  }

  async function suggest(e: React.FormEvent) {
    e.preventDefault();
    const name = title.trim();
    if (!name) return;
    await send({ action: "suggest", title: name });
    setTitle("");
    setAdding(false);
  }

  if (loading) {
    return <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />;
  }

  if (!poll) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
        <Film size={22} className="mx-auto mb-2 text-slate-300" />
        <p className="text-sm text-theme-muted">Моментално нема активна анкета.</p>
      </div>
    );
  }

  // The leader is only highlighted once there is something to lead — with no
  // votes at all, every bar at 0% with one of them marked would be misleading.
  const top = options.length && options[0].votes > 0 ? options[0].votes : 0;

  return (
    <div className="space-y-4">
      {poll.poster_url && (
        /* Plain <img>: the URL comes from Sanity's CDN already cropped to the
           size we ask for, so next/image would only add a second resize hop. */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={poll.poster_url}
          alt=""
          className="aspect-[1200/630] w-full rounded-2xl object-cover"
        />
      )}
      <div>
        <h1 className="text-base font-semibold text-theme-heading">{poll.title}</h1>
        {poll.screening_at && (
          <p className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-[#2aa99d]/10 px-2 py-1 text-xs font-semibold text-primary">
            <CalendarDays size={13} />
            Проекција: {formatScreening(poll.screening_at)}
          </p>
        )}
        {poll.description && (
          <p className="mt-0.5 text-xs text-theme-muted">{poll.description}</p>
        )}
        <p className="mt-1 text-xs text-theme-muted">
          {total} {total === 1 ? "глас" : "гласови"}
          {!poll.live && " · анкетата е затворена"}
        </p>
      </div>

      <ul className="space-y-2">
        {options.map((o) => {
          const pct = total > 0 ? Math.round((o.votes / total) * 100) : 0;
          const chosen = mine === o.id;
          return (
            <li key={o.id}>
              {editingId === o.id ? (
                <form onSubmit={saveEdit} className="flex gap-2">
                  <input
                    autoFocus
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    maxLength={90}
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-primary"
                  />
                  <Button type="submit" disabled={!editTitle.trim() || busy}>
                    Зачувај
                  </Button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    aria-label="Откажи"
                    className="rounded-xl px-2 text-slate-400 hover:text-slate-600">
                    <X size={16} />
                  </button>
                </form>
              ) : (
              <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={!poll.live || busy}
                onClick={() => vote(o.id)}
                aria-pressed={chosen}
                className={`relative min-w-0 flex-1 overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed ${
                  chosen
                    ? "border-primary bg-[#2aa99d]/5"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}>
                {/* The bar is behind the text rather than beside it, so a long
                    film title never has to compete with a gauge for width. */}
                <span
                  aria-hidden
                  className={`absolute inset-y-0 left-0 transition-[width] duration-300 ${
                    o.votes === top && top > 0 ? "bg-[#2aa99d]/15" : "bg-slate-100"
                  }`}
                  style={{ width: `${pct}%` }}
                />
                <span className="relative flex items-center gap-2">
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                      chosen ? "border-primary bg-primary text-white" : "border-slate-300"
                    }`}>
                    {chosen && <Check size={11} strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-theme-heading">
                    {o.title}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-theme-muted">
                    {o.votes} · {pct}%
                  </span>
                </span>
              </button>
              {/* Only the author sees these, and only while the poll is live —
                  the server enforces both, plus that nobody else has voted for
                  the film yet. */}
              {o.own && poll.live && (
                <>
                  <button
                    type="button"
                    aria-label="Измени"
                    disabled={busy}
                    onClick={() => {
                      setEditingId(o.id);
                      setEditTitle(o.title);
                    }}
                    className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label="Избриши"
                    disabled={busy}
                    onClick={() => removeOption(o)}
                    className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                    <Trash2 size={14} />
                  </button>
                </>
              )}
              </div>
              )}
            </li>
          );
        })}
      </ul>

      {options.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-theme-muted">
          Сè уште нема предложени филмови. Биди прв!
        </p>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      {poll.live && poll.allow_suggestions && (
        <div>
          {!user ? (
            <p className="text-xs text-theme-muted">
              Гласањето е отворено за сите. Најавете се за да предложите филм.
            </p>
          ) : adding ? (
            <form onSubmit={suggest} className="flex gap-2">
              <input
                ref={inputRef}
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={90}
                placeholder="Име на филм"
                className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <Button size="sm" variant="teal" type="submit" disabled={busy || !title.trim()}>
                Додај
              </Button>
              <Button size="sm" variant="ghost" type="button" onClick={() => setAdding(false)}>
                Откажи
              </Button>
            </form>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
              <Plus size={13} /> Предложи филм
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
