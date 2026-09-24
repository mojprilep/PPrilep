"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft, X, User, Building2, Mail, Phone, MessageSquare, Send, Check, HandHeart,
} from "lucide-react";
import Image from "next/image";
import Link from "@/components/ui/Link";
import { cn } from "../../lib/utils";
import { toast } from "sonner";
import { submitMembershipRequest } from "../../app/actions/membership";
import PaymentDetails from "./PaymentDetails";

type Step = "choose" | "member" | "company" | "donate";
type MembershipTier = "volunteer" | "monthly" | "yearly";
type CompanyTier = "basic" | "preferred" | "premium";

interface MemberForm {
  name: string; email: string; phone: string; message: string;
  membership: MembershipTier;
}
interface CompanyForm {
  company: string; contact: string; email: string; phone: string; message: string;
  tier: CompanyTier;
}

const EMPTY_MEMBER: MemberForm = { name: "", email: "", phone: "", message: "", membership: "volunteer" };
const EMPTY_COMPANY: CompanyForm = { company: "", contact: "", email: "", phone: "", message: "", tier: "basic" };

const MEMBERSHIP_OPTIONS: { value: MembershipTier; label: string; price: string; desc: string }[] = [
  { value: "volunteer", label: "Волонтер",         price: "Бесплатно",       desc: "Придонесете со своето време и знаење" },
  { value: "monthly",   label: "Месечна членарина", price: "200 ден / мес",   desc: "Редовна финансиска поддршка на акциите" },
  { value: "yearly",    label: "Годишна членарина", price: "1.800 ден / год", desc: "Заштеда од 20% — уплатница на е-пошта" },
];

// Public-transparency notice shown under the free-text message field. Donations
// and memberships are published openly from the bank statement, so contributors
// who want to stay anonymous must say so here.
const PUBLIC_NOTICE =
  "Сите донации и членарини ги објавуваме јавно, директно од изводот од банка. Доколку не сакате вашето име да биде прикажано, ве молиме напоменете тука.";

interface Props {
  onClose: () => void;
  userId?: string | null;
  prefillName?: string | null;
  prefillEmail?: string | null;
}

export default function PartnerModal({ onClose, userId, prefillName, prefillEmail }: Props) {
  const [step, setStep] = useState<Step>("choose");
  const [memberForm, setMemberForm] = useState<MemberForm>({ ...EMPTY_MEMBER, name: prefillName ?? "", email: prefillEmail ?? "" });
  const [companyForm, setCompanyForm] = useState<CompanyForm>({ ...EMPTY_COMPANY, contact: prefillName ?? "", email: prefillEmail ?? "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [autoApproved, setAutoApproved] = useState(false);
  const [notifyConsent, setNotifyConsent] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  function back() { setStep("choose"); setDone(false); setAutoApproved(false); }

  async function submitMember(e: React.FormEvent) {
    e.preventDefault();
    const finalEmail = memberForm.email || prefillEmail || "";
    const finalName = memberForm.name || prefillName || (finalEmail ? finalEmail.split('@')[0] : "");
    if (!finalName || !finalEmail) return;
    // Consent to news and campaigns is deliberately optional: consent that is a
    // precondition of joining is not freely given, so it wouldn't be valid
    // anyway — and it turned people away at the last step of the form.
    setSubmitting(true);
    const finalMessage = notifyConsent ? (memberForm.message + (memberForm.message ? "\n\n" : "") + "[Согласен/а за известувања]") : memberForm.message;
    try {
      const res = await submitMembershipRequest({
        tier:      memberForm.membership as "volunteer" | "monthly" | "yearly",
        full_name: finalName,
        email:     finalEmail,
        phone:     memberForm.phone || undefined,
        message:   finalMessage || undefined,
      });
      if ("error" in res && res.error) { toast.error(res.error); return; }
      setAutoApproved("approved" in res && !!res.approved);
      setDone(true);
    } catch (err) {
      // Network drop / server error — without this the button would hang in its
      // submitting state with no feedback (the original bug).
      console.error("membership submit failed:", err);
      toast.error("Не успеавме да ја испратиме апликацијата. Проверете ја интернет врската и обидете се повторно.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitCompany(e: React.FormEvent) {
    e.preventDefault();
    if (!companyForm.company || !companyForm.email) return;
    setSubmitting(true);
    try {
      const res = await submitMembershipRequest({
        tier:      `company_${companyForm.tier}` as "company_basic" | "company_preferred" | "company_premium",
        full_name: companyForm.contact || companyForm.company,
        company:   companyForm.company,
        email:     companyForm.email,
        phone:     companyForm.phone || undefined,
        message:   companyForm.message || undefined,
      });
      if ("error" in res && res.error) { toast.error(res.error); return; }
      setAutoApproved(false);
      setDone(true);
    } catch (err) {
      console.error("partner submit failed:", err);
      toast.error("Не успеавме да ја испратиме апликацијата. Проверете ја интернет врската и обидете се повторно.");
    } finally {
      setSubmitting(false);
    }
  }

  const stepTitle =
    step === "member" ? "Станете член"
    : step === "company" ? "Партнер"
    : step === "donate" ? "Донација"
    : null;

  const modal = (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative flex w-full flex-col overflow-hidden bg-white shadow-2xl h-[90dvh] rounded-t-2xl sm:h-auto sm:max-h-[88dvh] sm:max-w-lg sm:rounded-2xl">

        {/* Header */}
        <div className="shrink-0 flex items-center gap-2 border-b border-zinc-100 px-5 py-4">
          {step !== "choose" && !done ? (
            <button onClick={back} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-zinc-100 transition-colors">
              <ArrowLeft size={18} className="text-zinc-600" />
            </button>
          ) : (
            <div className="h-8 w-8 shrink-0" />
          )}
          <div className="flex flex-1 items-center gap-3">
            <Image src="/logo/logo-black.svg" alt="Мој Прилеп" width={100} height={28} className="h-7 w-auto" />
            <div className="flex min-w-0 items-baseline gap-1 text-xl leading-none tracking-tight">
              <span className="font-semibold text-slate-900">Мој</span>
              <span className="font-semibold text-primary">Прилеп</span>
            </div>
          </div>
          {stepTitle && <span className="text-sm font-semibold text-zinc-500">{stepTitle}</span>}
          <button onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-zinc-100 transition-colors">
            <X size={18} className="text-zinc-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto">

          {/* Choose */}
          {step === "choose" && (
            <div className="px-5 py-6 space-y-3">
              <p className="text-sm text-zinc-500 pb-1">Изберете начин на поддршка:</p>
              <ChoiceCard icon={<User size={22} />} title="Станете член" desc="Поединци кои сакаат да придонесат со своето време, знаење или членарина." onClick={() => setStep("member")} />
              <ChoiceCard icon={<Building2 size={22} />} title="Компанија партнер" desc="Бизниси кои сакаат да вложат во заедницата и да добијат видливост." onClick={() => setStep("company")} />
              <ChoiceCard icon={<HandHeart size={22} />} title="Донација" desc="Еднократна донација на сметката на здружението — секој денар е важен." onClick={() => setStep("donate")} />
            </div>
          )}

          {/* Donate — show bank accounts directly */}
          {step === "donate" && (
            <div className="px-5 py-6 space-y-4">
              <p className="text-sm leading-relaxed text-zinc-600">
                Ви благодариме што сакате да го поддржите Прилеп! 💚 Уплатете слободен износ
                на сметката подолу — средствата одат во конкретни акции во градот.
              </p>
              <PaymentDetails />
              <button
                onClick={onClose}
                className="w-full rounded-xl px-6 py-2.5 text-sm font-semibold text-white transition-colors"
                style={{ background: "#2aa99d" }}>
                Затвори
              </button>
            </div>
          )}

          {/* Member — login gate */}
          {step === "member" && !done && !userId && (
            <div className="flex flex-col items-center justify-center gap-5 px-5 py-14 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full text-3xl" style={{ background: "#d8f4ef" }}>🔒</span>
              <div>
                <p className="text-base font-bold text-zinc-900">Потребна е сметка</p>
                <p className="mt-1.5 text-sm text-zinc-500 leading-relaxed max-w-xs">
                  За да станете член (волонтер или со членарина), треба сметка — за да можеме да ви го прикажеме статусот и значката.
                </p>
              </div>
              <div className="flex w-full max-w-xs flex-col gap-2">
                <Link href="/auth/login?next=/sponsors"
                   className="flex items-center justify-center rounded-xl py-3 text-sm font-semibold text-white transition-colors"
                   style={{ background: "#2aa99d" }}>
                  Најава
                </Link>
                <Link href="/auth/register?next=/sponsors"
                   className="flex items-center justify-center rounded-xl border border-zinc-200 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors">
                  Создадете сметка
                </Link>
              </div>
            </div>
          )}

          {/* Member form */}
          {step === "member" && !done && !!userId && (
            <form id="member-form" onSubmit={submitMember} className="px-5 py-5 space-y-5">

              <Field label="Телефон" icon={<Phone size={14} />} type="tel" placeholder="+389 7X XXX XXX" value={memberForm.phone} onChange={(v) => setMemberForm((f) => ({ ...f, phone: v }))} />

              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-600">Членарина</label>
                <div className="space-y-2">
                  {MEMBERSHIP_OPTIONS.map((opt) => {
                    const isActive = memberForm.membership === opt.value;
                    return (
                      <button key={opt.value} type="button"
                        onClick={() => setMemberForm((f) => ({ ...f, membership: opt.value }))}
                        className={cn("flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                          isActive ? "border-primary bg-primary-light" : "border-zinc-200 bg-zinc-50 hover:border-zinc-300")}>
                        <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                          isActive ? "border-primary bg-primary" : "border-zinc-300 bg-white")}>
                          {isActive && <Check size={11} className="text-white" strokeWidth={3} />}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-zinc-900">{opt.label}</p>
                          <p className="text-xs text-zinc-500">{opt.desc}</p>
                        </div>
                        <span className="shrink-0 text-xs font-bold" style={{ color: "#2aa99d" }}>{opt.price}</span>
                      </button>
                    );
                  })}
                </div>
                {(memberForm.membership === "monthly" || memberForm.membership === "yearly") && (
                  <div className="space-y-2">
                    <PaymentDetails
                      purpose={`${
                        memberForm.membership === "monthly" ? "Месечна" : "Годишна"
                      } членарина — Мој Прилеп`}
                    />
                    <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700 leading-relaxed">
                      Деталите за уплата ќе ги добиете и на е-пошта. Членарината се активира по евидентирана уплата.
                    </p>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setNotifyConsent(!notifyConsent)}
                className="mt-2 mb-4 flex w-full items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-left transition-colors hover:border-zinc-300"
              >
                <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
                  notifyConsent ? "border-primary bg-primary" : "border-zinc-300 bg-white")}>
                  {notifyConsent && <Check size={11} className="text-white" strokeWidth={3} />}
                </span>
                <p className="text-[13px] leading-relaxed text-zinc-700">
                  Се согласувам да добивам известувања за новости и акции на е-пошта или преку апликацијата.
                </p>
              </button>

              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-zinc-600">
                  <MessageSquare size={13} /> Порака (незадолжително)
                </label>
                <textarea rows={3} placeholder="Вашите вештини, идеи, прашања..." value={memberForm.message}
                  onChange={(e) => setMemberForm((f) => ({ ...f, message: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none focus:border-zinc-400 focus:bg-white resize-none transition-colors" />
                <p className="mt-1.5 text-xs font-semibold leading-relaxed text-red-600">{PUBLIC_NOTICE}</p>
              </div>
            </form>
          )}

          {/* Company form */}
          {step === "company" && !done && (
            <form id="company-form" onSubmit={submitCompany} className="px-5 py-5 space-y-5">
              <Field label="Назив на компанијата *" icon={<Building2 size={14} />} placeholder="ДООЕЛ / АД Пример" value={companyForm.company} onChange={(v) => setCompanyForm((f) => ({ ...f, company: v }))} required />
              <Field label="Контакт лице" icon={<User size={14} />} placeholder="Вашето Име и Презиме" value={companyForm.contact} onChange={(v) => setCompanyForm((f) => ({ ...f, contact: v }))} />
              <Field label="Е-пошта *" icon={<Mail size={14} />} type="email" placeholder="вашата@епошта.com" value={companyForm.email} onChange={(v) => setCompanyForm((f) => ({ ...f, email: v }))} required />
              <Field label="Телефон" icon={<Phone size={14} />} type="tel" placeholder="+389 2 XXX XXX" value={companyForm.phone} onChange={(v) => setCompanyForm((f) => ({ ...f, phone: v }))} />

              <div className="space-y-2">
                {!userId && (
                  <p className="text-xs text-zinc-500 px-1">
                    Имате сметка?{" "}
                    <Link href="/auth/login?next=/sponsors" className="font-semibold underline text-zinc-700">Најавете се</Link>
                    {" "}за да го следите статусот на вашата апликација.
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-zinc-600">
                  <MessageSquare size={13} /> Порака (незадолжително)
                </label>
                <textarea rows={3} placeholder="Идеи за соработка, прашања..." value={companyForm.message}
                  onChange={(e) => setCompanyForm((f) => ({ ...f, message: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none focus:border-zinc-400 focus:bg-white resize-none transition-colors" />
                <p className="mt-1.5 text-xs font-semibold leading-relaxed text-red-600">{PUBLIC_NOTICE}</p>
              </div>
            </form>
          )}

          {/* Success */}
          {done && (
            <div className="flex flex-col items-center gap-4 px-5 py-10 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full text-3xl" style={{ background: "#d8f4ef" }}>
                {autoApproved ? "🎉" : "📬"}
              </span>
              <div>
                <p className="text-lg font-bold text-zinc-900">Ви благодариме!</p>
                <p className="mt-1 text-sm text-zinc-500 leading-relaxed max-w-xs">
                  {autoApproved
                    ? "Вашиот волонтерски статус е активен. Проверете ја е-поштата за потврда."
                    : "Вашата апликација е примена. Извршете ја уплатата на сметката подолу — деталите ви ги испративме и на е-пошта."}
                </p>
              </div>
              {!autoApproved && (
                <div className="w-full max-w-sm text-left">
                  <PaymentDetails />
                </div>
              )}
              <button onClick={onClose} className="mt-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-white transition-colors" style={{ background: "#2aa99d" }}>
                Затвори
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {(step === "member" || step === "company") && !done && (step === "company" || !!userId) && (
          <div className="shrink-0 border-t border-zinc-100 px-5 py-3.5 flex gap-3">
            <button type="button" onClick={back} className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors">
              Назад
            </button>
            <button type="submit" form={step === "member" ? "member-form" : "company-form"} disabled={submitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50"
              style={{ background: "#2aa99d" }}>
              <Send size={14} />
              {submitting ? "Се испраќа..." : "Испрати барање"}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  if (typeof window === "undefined") return null;
  return createPortal(modal, document.body);
}

function ChoiceCard({ icon, title, desc, onClick }: { icon: React.ReactNode; title: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group flex w-full items-start gap-4 rounded-2xl bg-zinc-100 p-5 text-left transition-colors hover:bg-zinc-200">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-zinc-500 shadow-sm group-hover:shadow transition-shadow">{icon}</span>
      <div>
        <p className="font-semibold text-zinc-900">{title}</p>
        <p className="mt-0.5 text-sm text-zinc-500 leading-snug">{desc}</p>
      </div>
    </button>
  );
}

function Field({ label, icon, placeholder, value, onChange, type = "text", required = false }: {
  label: string; icon: React.ReactNode; placeholder?: string;
  value: string; onChange: (v: string) => void; type?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-zinc-600">{icon} {label}</label>
      <input type={type} required={required} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-colors" />
    </div>
  );
}
