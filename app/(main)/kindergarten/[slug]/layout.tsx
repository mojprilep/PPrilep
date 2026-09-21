import { notFound } from "next/navigation";
import {
  fetchInstitutionBySlug,
  fetchAllInstitutions,
  fetchTodayMenu,
  fetchCurrentProgramme,
  fetchRecentAnnouncements,
  fetchSignupDocuments,
  type KindergartenInstitution,
} from "../../../../lib/sanity/kindergarten";
import {
  INSTITUTION_FALLBACK,
  getFallbackBySlug,
} from "../../../../lib/kindergarten-fallback";
import InstitutionPanelInjector from "../../../../components/kindergarten/InstitutionPanelInjector";

export default async function InstitutionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [sanityInst, sanityAll] = await Promise.all([
    fetchInstitutionBySlug(slug).catch(() => null),
    fetchAllInstitutions().catch(() => [] as KindergartenInstitution[]),
  ]);

  const fb = getFallbackBySlug(slug);
  const institution: KindergartenInstitution | null = sanityInst ?? (fb
    ? {
        _id: `fallback-${fb.slug}`, name: fb.name, slug: fb.slug,
        address: fb.address, phone: fb.phone, closingTime: fb.closingTime,
        district: fb.district, description: fb.description ?? null,
        coverImage: null, lat: null, lng: null,
      }
    : null);

  if (!institution) notFound();

  const allInstitutions: KindergartenInstitution[] =
    sanityAll.length > 0
      ? sanityAll
      : INSTITUTION_FALLBACK.map((f) => ({
          _id: `fallback-${f.slug}`, name: f.name, slug: f.slug,
          address: f.address, phone: f.phone, closingTime: f.closingTime,
          district: f.district, description: f.description ?? null,
          coverImage: null, lat: null, lng: null,
        }));

  const [todayMenu, currentProgramme, recentAnnouncements, signupDocuments] =
    await Promise.all([
      fetchTodayMenu(institution._id).catch(() => []),
      fetchCurrentProgramme(institution._id).catch(() => null),
      fetchRecentAnnouncements(institution._id).catch(() => []),
      fetchSignupDocuments(institution._id).catch(() => []),
    ]);

  return (
    <>
      <InstitutionPanelInjector
        slug={slug}
        institution={institution}
        allInstitutions={allInstitutions}
        todayMenu={todayMenu}
        currentProgramme={currentProgramme}
        recentAnnouncements={recentAnnouncements}
        signupDocuments={signupDocuments}
      />
      {children}
    </>
  );
}
