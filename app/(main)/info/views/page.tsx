import Link from "@/components/ui/Link";

export default function ViewsInfoPage() {
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-900">Прегледи</h1>
        <p className="text-sm text-slate-500">
          Како се пресметува бројот на прегледи кај пријавите.
        </p>
      </header>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-3">
        <h2 className="text-base font-semibold text-slate-900">
          Што значи бројот
        </h2>
        <p className="text-sm text-slate-700 leading-relaxed">
          Бројот на прегледи покажува колку пати пријавата била видена во
          листата (feed) и колку пати била отворена во деталниот преглед.
        </p>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-3">
        <h2 className="text-base font-semibold text-slate-900">
          Кога се брои преглед
        </h2>
        <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1.5">
          <li>Кога пријавата станува видлива во feed.</li>
          <li>Секој пат кога се отвора деталниот преглед на пријавата.</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-3">
        <h2 className="text-base font-semibold text-slate-900">
          Зошто ова е важно
        </h2>
        <p className="text-sm text-slate-700 leading-relaxed">
          Прегледите помагаат да се разбере колку видливост има одреден проблем
          во заедницата и како се движи вниманието низ времето.
        </p>
        <Link
          href="/info"
          className="inline-flex rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-zinc-50 transition-colors">
          Назад кон Информатор
        </Link>
      </section>
    </div>
  );
}
