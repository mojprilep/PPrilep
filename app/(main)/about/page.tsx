import Image from "next/image";
import Link from "@/components/ui/Link";
import ContactForm from "../../../components/about/ContactForm";

export default function AboutPage() {
  return (
    <div className="space-y-4 [&_p]:text-justify [&_li_p]:text-justify">
      <header className="rounded-2xl border border-theme bg-theme-surface p-6 flex flex-col items-center text-center lg:items-start lg:text-left gap-4">
        <Image
          src="/logo/logo-black.svg"
          alt="Мојот Град — Прилеп"
          width={40}
          height={60}
       
          priority
        />
        
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-theme-heading">Мојот Град — Прилеп</h1>
          <p className="text-sm text-theme-muted leading-relaxed">
            Независна, непартиска и непрофитна граѓанска организација. Нашата мисија е преку
            конкретни проекти, дигитални алатки и директно вклучување на граѓаните, да го
            подобриме квалитетот на живеење во Прилеп.
          </p>
        </div>
      </header>

      {/* Верување */}
      <section className="rounded-2xl border border-theme bg-theme-surface p-5 space-y-3">
        <p className="text-sm text-theme-body leading-relaxed">
          Ние веруваме дека одлуките за градот треба да ги носат луѓето кои живеат во него.
          Наместо само да ја констатираме состојбата и да дебатираме за лошо лоцираните
          проблеми, ние нудиме платформа за конкретни чекори, реална акција и системски
          промени.
        </p>
      </section>

      {/* Јавна свест */}
      <section className="rounded-2xl border border-theme bg-theme-surface p-5 space-y-3">
        <h2 className="text-base font-semibold text-theme-heading">
          💡 Промената почнува од јавната свест
        </h2>
        <p className="text-sm text-theme-body leading-relaxed">
          Веруваме дека можеме да изградиме совршени дигитални алатки и да исчистиме десетици
          локации, но без разбудување и надоградување на јавната свест на сите нас, промените
          ќе бидат само привремени. Секој од нас мора да разбере дека јавниот простор е наш
          заеднички двор, а не ничија земја.
        </p>
        <p className="text-sm text-theme-body leading-relaxed">
          Ние не сме тука само да чистиме по другите, туку заедно да научиме да не загадуваме.
          Не сме тука само да ги посочуваме грешките на системот, туку да изградиме култура на
          одговорност каде секој поединец си го крева гласот и си го заштитува маалото.
        </p>
        <blockquote className="rounded-xl border-l-4 border-primary bg-primary/5 px-4 py-3">
          <p className="text-sm font-semibold text-theme-heading italic">
            „Ништо нема да се смени, ако ништо не се смени.&quot;
          </p>
        </blockquote>
        <p className="text-sm text-theme-body leading-relaxed">
          Промената на Прилеп не зависи од некој друг — таа зависи директно од нашите
          секојдневни навики, нашиот револт и нашата подготвеност да преземеме акција наместо
          да чекаме друг да ни го реши проблемот.
        </p>
      </section>

      {/* Почетни цели */}
      <section className="rounded-2xl border border-theme bg-theme-surface p-5 space-y-4">
        <h2 className="text-base font-semibold text-theme-heading">🎯 Нашите почетни цели</h2>
        <p className="text-sm text-theme-body leading-relaxed">
          За почеток, се фокусираме на три едноставни, но клучни столбови кои се неопходни за
          нормално функционирање на секоја современа заедница: чист, организиран и
          дигитализиран Прилеп.
        </p>
        <div className="space-y-3">
          {[
            {
              emoji: "🧹",
              label: "Чист град",
              badge: "Главен приоритет",
              desc: "Веруваме дека мора прво да ги решиме основните, базични потреби на градот за да можеме да градиме понатаму. Хигиената на јавните простори, правилното менаџирање со отпадот и уредените зелени површини се нашиот прв и најважен фокус. Без чиста средина, не можеме да зборуваме за никаков друг развој.",
            },
            {
              emoji: "🏙️",
              label: "Организиран град",
              badge: null,
              desc: "Подобрување на урбаната опрема, функционалност на јавните простори и инфраструктурни иницијативи кои го олеснуваат секојдневието на прилепчани.",
            },
            {
              emoji: "📱",
              label: "Дигитализиран град",
              badge: null,
              desc: "Воведување на современи дигитални алатки преку кои граѓаните брзо, лесно и директно ќе можат да влијаат врз процесите во својата околина.",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-theme bg-theme-surface-muted p-4 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base">{item.emoji}</span>
                <span className="text-sm font-semibold text-theme-heading">{item.label}</span>
                {item.badge && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {item.badge}
                  </span>
                )}
              </div>
              <p className="text-[13px] text-theme-muted leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Кои сме */}
      <section className="rounded-2xl border border-theme bg-theme-surface p-5 space-y-3">
        <h2 className="text-base font-semibold text-theme-heading">🤝 Кои сме ние?</h2>
        <p className="text-sm text-theme-body leading-relaxed">
          Ние сме здружение на граѓани предводено од тим на Прилепчани на кои им е преку глава
          и активисти од различни сектори. Она што нè обединува не е политичка или лична
          агенда, туку желбата за транспарентно и одржливо менаџирање на јавните простори и
          ресурси во Прилеп.
        </p>
        <p className="text-sm text-theme-body leading-relaxed">
          Нашиот основен принцип е целосна транспарентност и директно одлучување. Кај нас нема
          одлуки зад затворени врати или скриена хиерархија.
        </p>
      </section>

      {/* Што правиме */}
      <section className="rounded-2xl border border-theme bg-theme-surface p-5 space-y-4">
        <h2 className="text-base font-semibold text-theme-heading">⚙️ Што правиме?</h2>
        <p className="text-sm text-theme-body leading-relaxed">
          Нашите активности се насочени кон реализација на проекти кои носат долгорочна корист
          за Прилеп:
        </p>
        <ul className="space-y-3 text-sm text-theme-body">
          {[
            {
              emoji: "🌳",
              label: "Локален активизам и урбани иницијативи",
              desc: "Реализираме проекти за уредување, чистење и зазеленување на јавни површини, како и поставување на соодветна урбана опрема.",
            },
            {
              emoji: "💻",
              label: "Развој на дигитални платформи",
              desc: "Градиме софтверски решенија кои им овозможуваат на граѓаните полесно да ги лоцираат, пријават и решат проблемите во нивните маала.",
            },
            {
              emoji: "🏛️",
              label: "Застапување пред институциите",
              desc: "Делуваме како легитимен глас на заедницата пред локалната власт, барајќи одговорност, отчетност и брза реакција за прашањата од јавен интерес.",
            },
          ].map((item) => (
            <li key={item.label} className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-base">{item.emoji}</span>
              <div>
                <p className="font-semibold text-theme-heading">{item.label}</p>
                <p className="mt-0.5 text-theme-muted leading-relaxed">{item.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Финансии */}
      <section className="rounded-2xl border border-theme bg-theme-surface p-5 space-y-3">
        <h2 className="text-base font-semibold text-theme-heading">💰 Како се трошат средствата?</h2>
        <p className="text-sm text-theme-body leading-relaxed">
          Финансискиот модел на „Мојот Град — Прилеп&quot; е поставен врз основа на апсолутна
          транспарентност. Здружението се финансира преку донации од граѓани, поддршка од
          општествено одговорни компании и фондови наменети за развој на граѓанското општество.
        </p>
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <p className="text-sm font-semibold text-primary">
            Сите собрани пари се враќаат директно назад во проекти за градот.
          </p>
        </div>
        <p className="text-sm text-theme-body">Средствата се трошат исклучиво за:</p>
        <ul className="space-y-2 text-sm text-theme-body">
          <li className="flex gap-3">
            <span className="shrink-0 text-base">🔨</span>
            <div>
              <span className="font-semibold text-theme-heading">Реализација на проекти на терен</span>
              <p className="mt-0.5 text-theme-muted leading-relaxed">
                Набавка на материјали, садници, урбана опрема и сè што е потребно за физичко
                изведување на иницијативите.
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="shrink-0 text-base">🖥️</span>
            <div>
              <span className="font-semibold text-theme-heading">Технолошка поддршка</span>
              <p className="mt-0.5 text-theme-muted leading-relaxed">
                Одржување и развој на дигиталната платформа која овозможува организација и
                гласање на акциите.
              </p>
            </div>
          </li>
        </ul>
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
          <p className="text-xs text-amber-800 leading-relaxed">
            📋 Детален финансиски извештај се објавува квартално на оваа страна и се испраќа
            до сите членови по е-пошта.
          </p>
        </div>
        <Link href="/fund" className="text-sm font-medium text-primary hover:underline">
          Погледни го нашиот Фонд →
        </Link>
      </section>

      {/* Како функционираме */}
      <section className="rounded-2xl border border-theme bg-theme-surface p-5 space-y-4">
        <h2 className="text-base font-semibold text-theme-heading">
          🗳️ Како функционираме? (Директно одлучување)
        </h2>
        <p className="text-sm text-theme-body leading-relaxed">
          За разлика од традиционалните организации каде тесен круг на луѓе одлучува за сè,
          кај нас одлучува целата заедница. Процесот е целосно отворен и дигитализиран:
        </p>
        <div className="space-y-3">
          {[
            {
              step: "1",
              label: "Предлог",
              desc: "Секој граѓанин може да поднесе идеја или предлог-проект за подобрување на некој дел од градот.",
            },
            {
              step: "2",
              label: "Гласање",
              desc: "Сите пристигнати предлози и иницијативи се објавуваат на нашата страница. Таму, вие — граѓаните на Прилеп, гласате кои проекти ви се најприоритетни.",
            },
            {
              step: "3",
              label: "Реализација",
              desc: "Проектите кои ќе добијат најмногу гласови од заедницата се оние во кои ги вложуваме собраните средства и заеднички ги реализираме на терен.",
            },
          ].map((s) => (
            <div key={s.step} className="flex gap-3 items-start">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white">
                {s.step}
              </span>
              <div>
                <p className="text-sm font-semibold text-theme-heading">{s.label}</p>
                <p className="mt-0.5 text-[13px] text-theme-muted leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-sm text-theme-body leading-relaxed">
          На овој начин, вие имате директна контрола врз тоа каде завршува секој денар и кој
          проект ќе биде следен реализиран во Прилеп.
        </p>
      </section>

      {/* CTA */}
      <section className="rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-3 text-center">
        <p className="text-base font-semibold text-theme-heading">
          Твојот глас е твојата акција.
        </p>
        <p className="text-sm text-theme-muted leading-relaxed">
          Погледни ги активните предлози, поддржи ги со твојот глас или поднеси нова
          иницијатива.
        </p>
        <Link
          href="/initiatives"
          className="inline-block rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors">
          Активни иницијативи →
        </Link>
      </section>

      {/* Контакт */}
      <section className="rounded-2xl border border-theme bg-theme-surface overflow-hidden">
        {/* Header strip */}
        <div className="bg-primary/5 border-b border-theme px-5 py-5 flex flex-col items-center text-center gap-1">
          <h2 className="text-base font-semibold text-theme-heading">📬 Контактирај не</h2>
          <p className="text-[13px] text-theme-muted">
            За прашања, соработка, медиуми или само за да кажеш здраво.
          </p>
          <a
            href="mailto:hello@mojprilep.mk"
            className="mt-1 text-sm font-semibold text-primary hover:underline">
            hello@mojprilep.mk
          </a>
          <span className="text-[12px] text-theme-muted">Прилеп, Северна Македонија</span>
        </div>
        {/* Form */}
        <div className="p-5">
          <ContactForm />
        </div>
      </section>

      {/* Policies */}
      <section className="flex flex-wrap justify-center gap-x-6 gap-y-2 py-4 text-sm font-medium text-theme-muted">
        <Link href="/privacy" className="hover:text-primary transition-colors">Политика за приватност</Link>
        <Link href="/terms" className="hover:text-primary transition-colors">Услови за користење</Link>
        <Link href="/data-deletion" className="hover:text-primary transition-colors">Бришење податоци</Link>
        <Link href="/support" className="hover:text-primary transition-colors">Поддршка</Link>
      </section>
    </div>
  );
}
