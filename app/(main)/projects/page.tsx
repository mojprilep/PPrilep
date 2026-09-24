import Image from "next/image";
import Link from "@/components/ui/Link";
import { fetchProjects } from "../../../lib/sanity/queries";
import { urlForImage } from "../../../lib/sanity/image";
import type { SanityProject } from "../../../lib/sanity/queries";

const STATUS_CONFIG = {
  completed: { label: "Завршен",  classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  ongoing:   { label: "Во тек",   classes: "bg-blue-50 text-blue-700 border-blue-200" },
  planned:   { label: "Планиран", classes: "bg-amber-50 text-amber-700 border-amber-200" },
};

const CATEGORY_LABELS: Record<string, string> = {
  cleaning:  "🧹 Чистење",
  greening:  "🌳 Зазеленување",
  urban:     "🏙️ Урбана опрема",
  digital:   "💻 Дигитализација",
  education: "🎓 Едукација",
  community: "🤝 Заедница",
  fund:      "💛 Фонд",
  other:     "Друго",
};

function ProjectCard({ project }: { project: SanityProject }) {
  const status = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.planned;
  const coverUrl = project.coverImage
    ? urlForImage(project.coverImage).width(600).height(340).fit("crop").url()
    : null;

  return (
    <Link
      href={`/projects/${project.slug}`}
      className="group block overflow-hidden rounded-2xl border border-[#e4ece8] bg-white transition-all hover:border-[#cfe0da] hover:shadow-md">
      {/* Cover image */}
      <div className="relative h-80 w-full bg-slate-100">
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt={project.coverImage?.alt ?? project.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl text-slate-200">
            🏗️
          </div>
        )}
        <span
          className={`absolute right-3 top-3 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur-sm ${status.classes}`}>
          {status.label}
        </span>
        {project.featured && (
          <span className="absolute left-3 top-3 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-white">
            ⭐ Истакнат
          </span>
        )}
      </div>

      {/* Content */}
      <div className="space-y-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium text-slate-500">
            {CATEGORY_LABELS[project.category] ?? project.category}
          </span>
          {project.location && (
            <>
              <span className="text-slate-300">·</span>
              <span className="text-[11px] text-slate-400">📍 {project.location}</span>
            </>
          )}
        </div>

        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-slate-800 transition-colors group-hover:text-primary">
          {project.title}
        </h3>

        {project.excerpt && (
          <p className="line-clamp-2 text-[13px] leading-relaxed text-slate-500">
            {project.excerpt}
          </p>
        )}

        <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-400">
          {project.startDate && (
            <span>
              📅{" "}
              {new Date(project.startDate).toLocaleDateString("mk-MK", {
                month: "short",
                year: "numeric",
              })}
            </span>
          )}
          {project.volunteersCount && (
            <span>🙋 {project.volunteersCount} волонтери</span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default async function ProjectsPage() {
  const projects = await fetchProjects();

  const featured = projects.filter((p) => p.featured);
  const rest = projects.filter((p) => !p.featured);

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-theme-heading">🏗️ Наши Проекти</h1>
        <p className="text-sm text-theme-muted">
          Реализирани и активни проекти на граѓанското здружение Мојот Град — Прилеп.
        </p>
      </header>

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#e4ece8] bg-white p-12 text-center space-y-3">
          <p className="text-4xl">🏗️</p>
          <p className="text-sm font-semibold text-slate-700">Наскоро...</p>
          <p className="text-sm text-slate-400">
            Проектите се во подготовка. Следи не за ажурирања.
          </p>
        </div>
      ) : (
        <>
          {featured.length > 0 && (
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-theme-subtle">
                Истакнати проекти
              </p>
              <div className="grid grid-cols-1 gap-4">
                {featured.map((p) => (
                  <ProjectCard key={p._id} project={p} />
                ))}
              </div>
            </div>
          )}

          {rest.length > 0 && (
            <div className="space-y-3">
              {featured.length > 0 && (
                <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-theme-subtle">
                  Сите проекти
                </p>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {rest.map((p) => (
                  <ProjectCard key={p._id} project={p} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
