import {
  fetchSignupDocuments,
  fetchLatestGlobalMenu,
} from "../../../lib/sanity/kindergarten";
import KindergartenListPanelInjector from "../../../components/kindergarten/KindergartenListPanelInjector";

// Server component — fetches panel data at request time so the client injector
// has everything it needs immediately on mount (no client-side async fetch).
export default async function KindergartenLayout({ children }: { children: React.ReactNode }) {
  const [signupDocuments, latestMenu] = await Promise.all([
    fetchSignupDocuments(null).catch(() => []),
    fetchLatestGlobalMenu().catch(() => []),
  ]);

  return (
    <>
      <KindergartenListPanelInjector
        signupDocuments={signupDocuments}
        latestMenu={latestMenu}
      />
      {children}
    </>
  );
}
