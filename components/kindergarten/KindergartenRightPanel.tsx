"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Phone, Clock, MapPin, ChevronRight, FileDown } from "lucide-react";
import { formatDays } from "../../lib/utils";
import WeeklyMenuPanel from "./WeeklyMenuPanel";
import { fetchAllInstitutions } from "../../lib/sanity/kindergarten";
import type {
  KindergartenInstitution,
  MenuPost,
  ProgrammePost,
  KindergartenAnnouncement,
  SignupDocument,
} from "../../lib/sanity/kindergarten";

interface Props {
  institution: KindergartenInstitution;
  todayMenu: MenuPost[];
  currentProgramme: ProgrammePost | null;
  recentAnnouncements: KindergartenAnnouncement[];
  signupDocuments: SignupDocument[];
  allInstitutions: KindergartenInstitution[];
}

export default function KindergartenRightPanel({
  institution,
  todayMenu,
  recentAnnouncements,
  signupDocuments,
  allInstitutions,
}: Props) {
  // The server-passed list is ISR-cached (up to 1h), so a newly added/removed
  // institution can lag. Re-fetch live on the client to keep this fresh — seeded
  // from the server prop so there's no flash of an empty list.
  const [institutions, setInstitutions] = useState<KindergartenInstitution[]>(allInstitutions);
  useEffect(() => {
    fetchAllInstitutions()
      .then((rows) => {
        if (rows.length > 0) setInstitutions(rows);
      })
      .catch(() => {});
  }, []);

  const others = institutions.filter((i) => i.slug !== institution.slug);

  const shortName = (name: string) =>
    name
      .replace(/Градинка\s*[„"«]Наша Иднина[»"»]\s*[–—-]?\s*/i, "")
      .replace(/Kindergarten\s*["']Our Future["']\s*[-–—]?\s*/i, "")
      .trim() || name;

  return (
    <div className="space-y-4 lg:p-3">

      {/* ── Weekly menu ── */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-base">🍽️</span>
          <p className="text-xs font-semibold text-zinc-500">Мени</p>
        </div>
        <WeeklyMenuPanel menus={todayMenu} />
      </div>

      {/* ── Signup documents ── */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-base">📄</span>
          <p className="text-xs font-semibold text-zinc-500">Документи за запишување</p>
        </div>
        {signupDocuments.length === 0 ? (
          <p className="text-xs text-zinc-400 italic">Наскоро ќе бидат достапни.</p>
        ) : (
          <div className="space-y-1">
            {signupDocuments.map((doc) => (
              <a
                key={doc._id}
                href={doc.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors group">
                <FileDown size={13} className="text-rose-400 shrink-0 group-hover:text-rose-500" />
                <span className="flex-1 truncate">{doc.title}</span>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* ── Recent news ── */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-base">📢</span>
          <p className="text-xs font-semibold text-zinc-500">Последни вести</p>
        </div>
        {recentAnnouncements.length === 0 ? (
          <p className="text-xs text-zinc-400 italic">Нема соопштенија.</p>
        ) : (
          <div className="space-y-2.5">
            {recentAnnouncements.map((a) => (
              <div key={a._id} className="border-l-2 pl-3" style={{ borderColor: "#fb7185" }}>
                <p className="text-xs font-semibold text-zinc-800 leading-snug line-clamp-2">{a.title}</p>
                <p className="mt-0.5 text-[10px] text-zinc-400">{formatDays(a.publishedAt)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Contact ── */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-2.5">
        <p className="text-xs font-semibold text-zinc-500">Контакт</p>
        {institution.phone && (
          <a href={`tel:${institution.phone.replace(/\s/g, "")}`}
             className="flex items-center gap-2.5 text-xs font-semibold text-zinc-700 hover:text-rose-500 transition-colors">
            <Phone size={13} className="text-zinc-400 shrink-0" />{institution.phone}
          </a>
        )}
        {institution.closingTime && (
          <div className="flex items-center gap-2.5 text-xs text-zinc-500">
            <Clock size={13} className="text-zinc-400 shrink-0" />
            Работи до <strong className="text-zinc-700">{institution.closingTime}</strong>
          </div>
        )}
        {institution.address && (
          <div className="flex items-start gap-2.5 text-xs text-zinc-500">
            <MapPin size={13} className="mt-0.5 text-zinc-400 shrink-0" />
            <span>{institution.address}</span>
          </div>
        )}
        {institution.lat && institution.lng && (
          <a href={`https://www.google.com/maps?q=${institution.lat},${institution.lng}`}
             target="_blank" rel="noopener noreferrer"
             className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-500 hover:underline">
            Отвори на Maps →
          </a>
        )}
      </div>

      {/* ── Other institutions ── */}
      {others.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-1">
          <p className="mb-2 text-xs font-semibold text-zinc-500">Останати установи</p>
          {others.map((inst) => (
            <Link key={inst._id} href={`/kindergarten/${inst.slug}`}
                  className="flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors">
              <span>{shortName(inst.name)}</span>
              <ChevronRight size={12} className="text-zinc-400" />
            </Link>
          ))}
        </div>
      )}

    </div>
  );
}
