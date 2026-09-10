import Link from "next/link";
import ZborcheLogo from "./ZborcheLogo";

/**
 * Right-panel teaser for ЗборЧе — the daily word game. Sits where the promise
 * tracker used to, on every route that shows the standard info panel, and links
 * to the game. Static: the board and the day's word load on /zborche itself.
 */
export default function ZborcheCard() {
  return (
    <div className="lg:p-3">
      <Link
        href="/zborche"
        className="block rounded-2xl border border-zinc-200 bg-white p-4 transition-colors hover:border-[#2aa99d]/50"
      >
        <div className="flex items-center gap-3">
          <ZborcheLogo height={30} />
        </div>
        <h3 className="mt-3 text-sm font-semibold tracking-tight text-gray-800">
          Играј ЗборЧе
        </h3>
        <p className="mt-1 text-xs leading-5 text-gray-500">
          Погоди го македонскиот збор на денот. Нова загатка секој ден.
        </p>
        <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#2aa99d]">
          Играј сега →
        </span>
      </Link>
    </div>
  );
}
