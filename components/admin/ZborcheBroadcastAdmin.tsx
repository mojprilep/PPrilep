"use client";

import { useState } from "react";

type SendState = "idle" | "sending" | "sent" | "error";

/**
 * Admin control: one button that pushes "a new ЗборЧе word is live" to EVERY
 * enabled device (calls /api/push/zborche-broadcast). Repeatable — the admin
 * fires it when the fresh daily word should be announced.
 */
export default function ZborcheBroadcastAdmin() {
  const [state, setState] = useState<SendState>("idle");
  const [result, setResult] = useState<string>("");

  async function send() {
    if (state === "sending") return;
    if (!confirm("Испрати известување до сите дека има нов ЗборЧе збор?")) return;
    setState("sending");
    try {
      const res = await fetch("/api/push/zborche-broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const json = (await res.json()) as { sent?: number; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Грешка");
      setState("sent");
      setResult(`Испратено до ${json.sent ?? 0} уреди`);
    } catch (e) {
      setState("error");
      setResult(e instanceof Error ? e.message : "Грешка");
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">🟩 Нов ЗборЧе збор</p>
        <p className="truncate text-xs text-zinc-500">
          Известување до сите дека денешната загатка е активна.
        </p>
        {result && (
          <p className={`text-xs mt-0.5 ${state === "error" ? "text-red-500" : "text-emerald-600"}`}>
            {result}
          </p>
        )}
      </div>
      <button
        onClick={send}
        disabled={state === "sending"}
        className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
        {state === "sending" ? "Се испраќа…" : state === "sent" ? "Испрати повторно" : "Потсети ги сите"}
      </button>
    </div>
  );
}
