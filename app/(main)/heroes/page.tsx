import AvatarInitials from "../../../components/ui/AvatarInitials";
import { createPublicClient } from "../../../lib/supabase/public";
import { fetchTopHeroes } from "../../../lib/data/issues";

// Public data only (cookie-free client), so the page can be cached.
export const revalidate = 60;

interface Hero {
  name: string;
  username: string | null;
  points: number;
}

function HeroList({ heroes }: { heroes: Hero[] }) {
  if (heroes.length === 0) {
    return (
      <p className="text-xs text-theme-subtle">
        Сè уште нема херои. Бидете први да помогнете!
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {heroes.map((hero, index) => (
        <div
          key={`${hero.name}-${index}`}
          className="bg-theme-surface border border-theme rounded-lg p-4 flex items-center gap-3">
          <span className="text-sm font-bold text-theme-subtle w-6 text-right shrink-0">
            {index + 1}
          </span>
          <AvatarInitials name={hero.name} size="md" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-theme-heading">
              {hero.name}
            </p>
            {hero.username && (
              <p className="text-xs text-theme-subtle">@{hero.username}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-theme-heading">{hero.points}</p>
            <p className="text-[10px] text-theme-subtle">аплаузи</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function HeroesPage() {
  const supabase = createPublicClient();
  // Full leaderboard: everyone credited on a resolved issue, ranked by the real
  // applause (issue_resolution_upvotes) their solved issues received.
  const rows = await fetchTopHeroes(supabase, 50);
  const heroes: Hero[] = rows.map((h) => ({
    name: h.name,
    username: h.username,
    points: h.points,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-base font-semibold text-theme-heading">
          Херои на заедницата!
        </h1>
        <p className="text-xs text-theme-muted">
          Граѓани и компании кои помогнале во решавање на проблеми
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-base">🏆</span>
          <h2 className="text-sm font-semibold text-theme-heading">
            Ранг-листа
          </h2>
        </div>
        <HeroList heroes={heroes} />
      </section>

      <section className="rounded-xl border border-theme bg-theme-surface p-4 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-base">👏</span>
          <h2 className="text-sm font-semibold text-theme-heading">
            Како функционира системот на „Аплаузи“?
          </h2>
        </div>
        <p className="text-sm leading-relaxed text-theme-muted">
          Овој систем функционира на принцип на заедничко признание. Граѓаните
          самите ги наградуваат оние кои придонесуваат за подобро утре.
        </p>

        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold text-theme-heading">
            1. Решавање и објава (резултат)
          </h3>
          <p className="text-sm leading-relaxed text-theme-muted">
            <strong className="text-theme-heading">Акција:</strong> граѓанин или
            компанија решава конкретен отворен проблем во градот.
          </p>
          <p className="text-sm leading-relaxed text-theme-muted">
            <strong className="text-theme-heading">Доказ:</strong> решениот
            проблем се објавува на платформата под нивно име (на пр.
            „Компанијата Х ја поправи урбаната опрема во паркот“ или „Марко
            Марковски ја исчисти дивата депонија кај игралиштето“).
          </p>
        </div>

        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold text-theme-heading">
            2. Јавно гласање (моментот на аплауз)
          </h3>
          <p className="text-sm leading-relaxed text-theme-muted">
            <strong className="text-theme-heading">Поддршка од народот:</strong>{" "}
            останатите сограѓани ја гледаат оваа објава и можат да стиснат
            „Аплауз“ (слично како лајк).
          </p>
          <p className="text-sm leading-relaxed text-theme-muted">
            <strong className="text-theme-heading">Вреднување:</strong> колку
            позначаен и покорисен е проблемот што е решен, толку повеќе луѓе ќе
            стиснат аплауз за да кажат „Благодарам!“.
          </p>
        </div>

        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold text-theme-heading">
            3. Рангирање и Херој на месецот
          </h3>
          <p className="text-sm leading-relaxed text-theme-muted">
            <strong className="text-theme-heading">Автоматско бодување:</strong>{" "}
            сите аплаузи од заедницата се претвораат во поени на јавната
            ранг-листа.
          </p>
          <p className="text-sm leading-relaxed text-theme-muted">
            <strong className="text-theme-heading">Крунисување:</strong> на
            крајот на месецот, оној што успеал да собере најмногу аплаузи од
            своите сограѓани ја добива титулата{" "}
            <strong className="text-theme-heading">Херој на градот</strong> и
            соодветната награда.
          </p>
        </div>

        <div className="rounded-lg border border-theme bg-theme-canvas p-3">
          <p className="text-sm leading-relaxed text-theme-muted">
            <strong className="text-theme-heading">
              Зошто е ова одлично?
            </strong>{" "}
            Затоа што го спречува фаворизирањето. Не одлучува комисија кој е
            најдобар, туку самите граѓани гласаат за она што им е најважно. Ова
            ги мотивира компаниите и поединците да решаваат проблеми што навистина
            ги засегаат луѓето.
          </p>
        </div>
      </section>
    </div>
  );
}
