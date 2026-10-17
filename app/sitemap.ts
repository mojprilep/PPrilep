import type { MetadataRoute } from "next";
import { fetchSportClubSlugs } from "../lib/sanity/sport";

const SITE_URL = "https://mojprilep.mk";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // Public, indexable routes. Dynamic content pages (issues, initiatives,
  // positive stories, kindergartens) can be appended here later by querying
  // Supabase / Sanity at build time.
  const routes: {
    path: string;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
    priority: number;
  }[] = [
    { path: "/", changeFrequency: "daily", priority: 1 },
    { path: "/issues", changeFrequency: "hourly", priority: 0.9 },
    { path: "/map", changeFrequency: "daily", priority: 0.7 },
    { path: "/heroes", changeFrequency: "daily", priority: 0.7 },
    { path: "/initiatives", changeFrequency: "daily", priority: 0.8 },
    { path: "/communities", changeFrequency: "weekly", priority: 0.6 },
    { path: "/events", changeFrequency: "daily", priority: 0.7 },
    { path: "/positive", changeFrequency: "daily", priority: 0.7 },
    { path: "/sport", changeFrequency: "weekly", priority: 0.6 },
    { path: "/sport/ce-trcame", changeFrequency: "weekly", priority: 0.6 },
    { path: "/sport/raspored", changeFrequency: "daily", priority: 0.6 },
    { path: "/sport/rakomet", changeFrequency: "daily", priority: 0.6 },
    { path: "/projects", changeFrequency: "weekly", priority: 0.6 },
    { path: "/about", changeFrequency: "monthly", priority: 0.5 },
    { path: "/sponsors", changeFrequency: "monthly", priority: 0.5 },
    { path: "/utility/water", changeFrequency: "weekly", priority: 0.6 },
    { path: "/utility/garbage", changeFrequency: "weekly", priority: 0.6 },
    { path: "/kindergarten", changeFrequency: "weekly", priority: 0.6 },
    { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  ];

  const staticEntries: MetadataRoute.Sitemap = routes.map(
    ({ path, changeFrequency, priority }) => ({
      url: `${SITE_URL}${path}`,
      lastModified: now,
      changeFrequency,
      priority,
    }),
  );

  // Each approved club profile is its own indexable page. The slug query is
  // already gated to public clubs (reviewed submissions + non-submissions), so
  // pending ones never leak in. Fail soft: a Sanity hiccup drops the club URLs
  // for this build rather than breaking the whole sitemap.
  let clubEntries: MetadataRoute.Sitemap = [];
  try {
    const slugs = await fetchSportClubSlugs();
    clubEntries = slugs.map((slug) => ({
      url: `${SITE_URL}/sport/${slug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.5,
    }));
  } catch {
    /* keep the static sitemap even if the club query fails */
  }

  return [...staticEntries, ...clubEntries];
}
