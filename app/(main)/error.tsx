"use client";

import { useEffect } from "react";
import Link from "@/components/ui/Link";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function MainError({ error, reset }: Props) {
  useEffect(() => {
    // Log to your error reporting service here if needed
    console.error("[MainError]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="text-5xl">⚠️</div>
      <div>
        <h2 className="text-lg font-semibold text-slate-800">
          Нешто не е во ред
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Настана грешка при вчитување на оваа страница.
        </p>
        {error.digest && (
          <p className="mt-1 font-mono text-[10px] text-slate-400">
            {error.digest}
          </p>
        )}
      </div>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100">
          Обиди се повторно
        </button>
        <Link
          href="/"
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90">
          Почетна
        </Link>
      </div>
    </div>
  );
}
