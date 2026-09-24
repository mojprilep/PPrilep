import Link from "@/components/ui/Link";
import { Lightbulb, Vote, Coins, Trophy, Plus } from "lucide-react";
import type { InitiativeTab } from "../../lib/initiatives";

interface Props {
  tab: InitiativeTab;
  isAuthed: boolean;
}

const CONTENT: Record<
  Exclude<InitiativeTab, "all">,
  { Icon: React.ComponentType<{ size?: number; className?: string }>; title: string; cta?: { label: string; href: string } }
> = {
  idea: {
    Icon: Lightbulb,
    title: "Сè уште нема предложени идеи",
    cta: { label: "Предложи иницијатива", href: "/initiatives/new" },
  },
  voting: {
    Icon: Vote,
    title: "Нема активни гласања",
    cta: { label: "Види идеи", href: "/initiatives?stage=idea" },
  },
  funding: {
    Icon: Coins,
    title: "Нема активни кампањи",
    cta: { label: "Види гласања", href: "/initiatives?stage=voting" },
  },
  completed: {
    Icon: Trophy,
    title: "Сè уште нема реализирани иницијативи",
  },
};

export default function InitiativeEmpty({ tab, isAuthed }: Props) {
  if (tab === "all") {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12 px-4 bg-white border border-zinc-200 rounded-xl">
        <Lightbulb size={28} className="text-theme-subtle mb-2" />
        <p className="text-sm text-theme-muted mb-3">Сè уште нема иницијативи.</p>
        <Link
          href={isAuthed ? "/initiatives/new" : "/auth/login?next=/initiatives/new"}
          className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-4 py-2 rounded-xl">
          <Plus size={14} /> Предложи иницијатива
        </Link>
      </div>
    );
  }

  const { Icon, title, cta } = CONTENT[tab];

  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4 bg-white border border-zinc-200 rounded-xl">
      <Icon size={28} className="text-theme-subtle mb-2" />
      <p className="text-sm text-theme-muted mb-3">{title}</p>
      {cta && (
        <Link
          href={cta.href === "/initiatives/new" && !isAuthed ? "/auth/login?next=/initiatives/new" : cta.href}
          className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-4 py-2 rounded-xl">
          {cta.href === "/initiatives/new" && <Plus size={14} />}
          {cta.label}
        </Link>
      )}
    </div>
  );
}
