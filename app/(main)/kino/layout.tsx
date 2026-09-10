import KinoPanelMount from "../../../components/kino/KinoPanelMount";
import { fetchPastScreenings } from "../../../lib/sanity/moviePoll";

// The archive ("Досега гледавме") is fetched here on the server. Without a
// revalidate the whole /kino route is frozen at build time, so a newly published
// pastScreening only shows on the web after a redeploy — while mobile, which
// fetches the archive live, already shows it. Re-check every 5 minutes.
export const revalidate = 300;

export default async function KinoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const screenings = await fetchPastScreenings();
  return <KinoPanelMount screenings={screenings}>{children}</KinoPanelMount>;
}
