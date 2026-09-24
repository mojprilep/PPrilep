import Link from "@/components/ui/Link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { PortableText, type PortableTextComponents } from "@portabletext/react";
import { fetchProject } from "../../../../lib/sanity/queries";
import { urlForImage } from "../../../../lib/sanity/image";
import BeforeAfterSlider from "../../../../components/projects/BeforeAfterSlider";
import ShareRow from "../../../../components/ui/ShareRow";

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  completed: { label: "Завршен", classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  ongoing: { label: "Во тек", classes: "bg-blue-50 text-blue-700 border-blue-200" },
  planned: { label: "Планиран", classes: "bg-amber-50 text-amber-700 border-amber-200" },
};

const CATEGORY_LABELS: Record<string, string> = {
  cleaning: "🧹 Чистење",
  greening: "🌳 Зазеленување",
  urban: "🏙️ Урбана опрема",
  digital: "💻 Дигитализација",
  education: "🎓 Едукација",
  community: "🤝 Заедница",
  fund: "💛 Фонд",
  other: "Друго",
};

interface Props {
  params: Promise<{ slug: string }>;
}

export const revalidate = 60;

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const project = await fetchProject(slug);
  if (!project) return { title: "Проект — Мојот Град Прилеп" };
  return {
    title: `${project.title} — Наши Проекти | Мојот Град Прилеп`,
    description: project.excerpt ?? undefined,
    openGraph: project.coverImage
      ? { images: [urlForImage(project.coverImage).width(1200).height(630).url()] }
      : undefined,
  };
}

const portableTextComponents: PortableTextComponents = {
  types: {
    image: ({ value }: { value: { asset: { _ref: string }; alt?: string; caption?: string } }) => (
      <figure className="my-5 -mx-3 sm:mx-0">
        <Image
          src={urlForImage(value).width(800).url()}
          alt={value.alt ?? ""}
          width={800}
          height={450}
          className="h-auto w-full sm:rounded-xl"
        />
        {value.caption && (
          <figcaption className="mt-1.5 px-3 text-xs text-zinc-500 sm:px-0">
            {value.caption}
          </figcaption>
        )}
      </figure>
    ),
  },
  block: {
    h2: ({ children }) => (
      <h2 className="mb-2 mt-6 text-lg font-semibold text-zinc-900">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="mb-1.5 mt-4 text-base font-semibold text-zinc-900">{children}</h3>
    ),
    blockquote: ({ children }) => (
      <blockquote className="my-3 border-l-3 border-primary pl-3 italic text-zinc-700">
        {children}
      </blockquote>
    ),
    normal: ({ children }) => (
      <p className="my-2.5 text-sm leading-relaxed text-zinc-700">{children}</p>
    ),
  },
  list: {
    bullet: ({ children }) => (
      <ul className="my-2.5 list-disc space-y-1 pl-5 text-sm text-zinc-700">{children}</ul>
    ),
    number: ({ children }) => (
      <ol className="my-2.5 list-decimal space-y-1 pl-5 text-sm text-zinc-700">{children}</ol>
    ),
  },
  marks: {
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    link: ({ children, value }) => (
      <a
        href={value?.href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2 hover:opacity-80">
        {children}
      </a>
    ),
  },
};

export default async function ProjectDetailPage({ params }: Props) {
  const { slug } = await params;
  const project = await fetchProject(slug);
  if (!project) notFound();

  const status = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.planned;
  const dateLabel = project.startDate
    ? new Date(project.startDate).toLocaleDateString("mk-MK", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <article>
      <Link
        href="/projects"
        className="mb-3 inline-block text-xs text-zinc-500 hover:text-zinc-700">
        ← Наши Проекти
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`rounded-full border px-2.5 py-0.5 font-semibold ${status.classes}`}>
            {status.label}
          </span>
          <span className="font-medium text-slate-500">
            {CATEGORY_LABELS[project.category] ?? project.category}
          </span>
        </div>
        <h1 className="text-2xl font-bold leading-tight text-zinc-900">
          {project.title}
        </h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
          {project.location && <span>📍 {project.location}</span>}
          {dateLabel && <span>📅 {dateLabel}</span>}
          {project.volunteersCount != null && (
            <span>🙋 {project.volunteersCount} волонтери</span>
          )}
        </div>
      </header>

      {project.coverImage && (
        <div className="relative my-4 aspect-[16/9] w-full overflow-hidden rounded-2xl bg-slate-100">
          <Image
            src={urlForImage(project.coverImage).width(1200).height(675).url()}
            alt={project.coverImage.alt ?? project.title}
            fill
            sizes="(max-width: 640px) 100vw, 720px"
            className="object-cover"
            priority
          />
        </div>
      )}

      {project.excerpt && (
        <p className="my-4 border-l-3 border-zinc-200 pl-3 text-base font-medium leading-relaxed text-zinc-600">
          {project.excerpt}
        </p>
      )}

      <div className="prose-content">
        {project.body && (
          <PortableText
            value={project.body as never}
            components={portableTextComponents}
          />
        )}
      </div>

      {/* Before / after sliders */}
      {project.beforeAfter && project.beforeAfter.length > 0 && (
        <section className="my-6 space-y-4">
          <h2 className="text-lg font-semibold text-zinc-900">
            Пред / Потоа
          </h2>
          {project.beforeAfter.map((c, i) => (
            <BeforeAfterSlider
              key={i}
              beforeUrl={urlForImage(c.before).width(900).height(675).fit("crop").url()}
              afterUrl={urlForImage(c.after).width(900).height(675).fit("crop").url()}
              label={c.label}
            />
          ))}
        </section>
      )}

      {/* Gallery */}
      {project.gallery && project.gallery.length > 1 && (
        <section className="my-6 space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900">Галерија</h2>
          <div className="grid grid-cols-2 gap-2">
            {project.gallery.map((img, i) => (
              <figure key={i} className="space-y-1">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-slate-100">
                  <Image
                    src={urlForImage(img).width(600).height(450).fit("crop").url()}
                    alt={img.alt ?? project.title}
                    fill
                    sizes="(max-width: 640px) 50vw, 360px"
                    className="object-cover"
                  />
                </div>
                {img.caption && (
                  <figcaption className="text-[11px] text-zinc-500">
                    {img.caption}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        </section>
      )}

      <ShareRow
        url={`https://www.mojprilep.mk/projects/${project.slug}`}
        title={project.title}
      />
    </article>
  );
}
