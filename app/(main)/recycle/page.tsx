import type { Metadata } from "next";
import Link from "@/components/ui/Link";
import RecycleMap from "../../../components/recycle/RecycleMap";
import CollapsibleList from "../../../components/recycle/CollapsibleList";
import {
  GLASS_CONTAINERS,
  GLASS_CONTAINER_COUNT,
} from "../../../lib/data/glassContainers";

export const metadata: Metadata = {
  title: "Рециклирање — стакло, хартија и пластика | Мој Прилеп",
  description:
    "Каде да ја одложиш стаклената амбалажа, хартијата и пластиката во Прилеп — мапа со сите контејнери за рециклирање. Собирај, селектирај, рециклирај.",
  alternates: { canonical: "/recycle" },
  openGraph: {
    title: "Рециклирање во Прилеп",
    description:
      "Мапа со сите контејнери за стакло, хартија и пластика во Прилеп. Амбалажата не смее да завршува на депонија — селектирај ја.",
    url: "/recycle",
    type: "article",
  },
};

export default function RecyclePage() {
  return (
    <div className="space-y-6">
      {/* Hero */}
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-theme-heading">
          ♻️ Рециклирање на стакло
        </h1>
        <p className="text-sm text-theme-muted">
          Стаклената амбалажа повеќе не смее да се одлага со останатиот отпад. Еве
          каде и зошто да ја селектираш.
        </p>
      </header>

      {/* Green venues */}
      <Link
        href="/recycle/eko-ugostiteli"
        className="flex items-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 transition hover:border-emerald-400">
        <span className="text-3xl">🌿</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-emerald-900">Еко угостители</span>
          <span className="block text-xs text-emerald-900/80">
            Кафулиња и ресторани што го селектираат стаклото и лименките со Пакомак — поддржи ги.
          </span>
        </span>
        <span className="text-emerald-700">→</span>
      </Link>

      {/* Why separate glass */}
      <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-zinc-800">
          Зошто одвоено стакло?
        </h2>
        <div className="space-y-3 text-sm leading-relaxed text-zinc-600">
          <p>
            <strong>Пакомак</strong> и ЈКП <strong>„Комуналец“</strong>{" "}
            поставија контејнери за селектирање стаклена амбалажа низ целиот град.
            Сега во Прилеп има <strong>{GLASS_CONTAINER_COUNT} локации</strong> —
            скоро на секоја фреквентна улица може да се одложи овој неразградлив
            отпад.
          </p>
          <p>
            Стаклената амбалажа не смее повеќе да завршува на депонија или
            исфрлена во природа, каде што се распаѓа и по милион години. Наместо
            отпад, стаклото може да стане следен корисен производ.
          </p>
        </div>
      </section>

      {/* Map */}
      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-zinc-800">
            📍 Мапа на контејнери за рециклирање
          </h2>
          <p className="text-xs text-zinc-500">
            Стакло, хартија и пластика — филтрирај по вид, кликни на контејнер и најди го најблискиот
            контејнер до тебе.
          </p>
        </div>
        <RecycleMap />
      </section>

      {/* Location list — collapsible */}
      <div className="space-y-3">
        <CollapsibleList
          title="Сите локации за стакло"
          subtitle="Контејнери за стаклена амбалажа низ градот"
          items={GLASS_CONTAINERS}
          accent="blue"
          defaultOpen
        />
      </div>
    </div>
  );
}
