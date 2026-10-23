import Link from "@/components/ui/Link";

/**
 * Right-panel teaser for КвизЧе — the weekly history quiz — under the ЗборЧе
 * card. Static: the week's theme and question load on /kvizche itself.
 */
export default function KvizcheCard() {
  return (
    <div className="lg:p-3">
      <Link
        href="/kvizche"
        className="block rounded-2xl border border-zinc-200 bg-white p-4 transition-colors hover:border-[#2aa99d]/50"
      >
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏛️</span>
          <span className="text-lg font-extrabold tracking-tight text-slate-800">
            Квиз<span className="text-[#2aa99d]">Че</span>
          </span>
        </div>
        <h3 className="mt-3 text-sm font-semibold tracking-tight text-gray-800">Колку ја знаеш историјата?</h3>
        <p className="mt-1 text-xs leading-5 text-gray-500">
          Едно прашање дневно за Прилеп и Македонија, секоја недела нова тема.
        </p>
        <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#2aa99d]">
          Играј сега →
        </span>
      </Link>
    </div>
  );
}
