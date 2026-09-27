"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "../../lib/supabase/server";
import type { InitiativeCategory } from "../../lib/types/database";

// ── Validation ──────────────────────────────────────────────────────
const CATEGORIES: readonly InitiativeCategory[] = [
  "infrastructure",
  "education",
  "environment",
  "culture",
  "safety",
  "health",
  "other",
] as const;

const DISTRICTS = [
  "Center",
  "Varoš",
  "Trizla",
  "Točila",
  "Rid",
  "Tipski",
  "Boncejca",
  "KorzoMaalo",
  "MarinoMaalo",
  "Cacorica",
] as const;

const createSchema = z.object({
  title: z.string().trim().min(10, "Минимум 10 знаци").max(120, "Максимум 120 знаци"),
  description: z.string().trim().min(20, "Минимум 20 знаци").max(2000, "Максимум 2000 знаци"),
  category: z.enum(CATEGORIES as unknown as [InitiativeCategory, ...InitiativeCategory[]]),
  district: z.enum(DISTRICTS, { error: "Изберете населба" }),
  street_name: z.string().trim().max(160).nullable().optional(),
  lat: z.coerce.number().nullable().optional(),
  lng: z.coerce.number().nullable().optional(),
  problem_statement: z.string().trim().max(500).nullable().optional(),
  expected_impact: z.string().trim().max(500).nullable().optional(),
  target_amount: z
    .union([z.coerce.number().positive("Износот мора да биде позитивен"), z.literal(null)])
    .nullable()
    .optional(),
  funding_deadline: z.string().datetime().nullable().optional(),
  cover_image_url: z.string().url().nullable().optional(),
});

type CreateResult =
  | { success: true; id: string }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export async function createInitiative(formData: FormData): Promise<CreateResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login?next=/initiatives/new");
  }

  const raw = {
    title: (formData.get("title") as string) ?? "",
    description: (formData.get("description") as string) ?? "",
    category: formData.get("category") as InitiativeCategory,
    district: (formData.get("district") as string) || null,
    street_name: (formData.get("street_name") as string) || null,
    lat: formData.get("lat") ? Number(formData.get("lat")) : null,
    lng: formData.get("lng") ? Number(formData.get("lng")) : null,
    problem_statement: (formData.get("problem_statement") as string) || null,
    expected_impact: (formData.get("expected_impact") as string) || null,
    target_amount: formData.get("target_amount") ? Number(formData.get("target_amount")) : null,
    funding_deadline: (formData.get("funding_deadline") as string) || null,
    cover_image_url: (formData.get("cover_image_url") as string) || null,
  };

  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: "Проверете ги полињата",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { data: row, error } = await supabase
    .from("initiatives")
    .insert({
      user_id: user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      district: parsed.data.district,
      street_name: parsed.data.street_name,
      lat: parsed.data.lat ?? null,
      lng: parsed.data.lng ?? null,
      problem_statement: parsed.data.problem_statement,
      expected_impact: parsed.data.expected_impact,
      target_amount: parsed.data.target_amount ?? null,
      funding_deadline: parsed.data.funding_deadline ?? null,
      cover_image_url: parsed.data.cover_image_url ?? null,
    })
    .select("id")
    .single();

  if (error || !row) {
    return { success: false, error: error?.message ?? "Грешка при креирање" };
  }

  revalidatePath("/initiatives");
  return { success: true, id: row.id };
}

// ── Update (owner or admin; RLS enforces) ───────────────────────────
export async function updateInitiative(
  id: string,
  formData: FormData,
): Promise<CreateResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login?next=/initiatives");
  }

  const raw = {
    title: (formData.get("title") as string) ?? "",
    description: (formData.get("description") as string) ?? "",
    category: formData.get("category") as InitiativeCategory,
    district: (formData.get("district") as string) || null,
    street_name: (formData.get("street_name") as string) || null,
    lat: formData.get("lat") ? Number(formData.get("lat")) : null,
    lng: formData.get("lng") ? Number(formData.get("lng")) : null,
    problem_statement: (formData.get("problem_statement") as string) || null,
    expected_impact: (formData.get("expected_impact") as string) || null,
    target_amount: formData.get("target_amount") ? Number(formData.get("target_amount")) : null,
    funding_deadline: (formData.get("funding_deadline") as string) || null,
    cover_image_url: (formData.get("cover_image_url") as string) || null,
  };

  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: "Проверете ги полињата",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  // Only the author-editable fields — never stage/votes/raised_amount.
  const { data: row, error } = await supabase
    .from("initiatives")
    .update({
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      district: parsed.data.district,
      street_name: parsed.data.street_name,
      lat: parsed.data.lat ?? null,
      lng: parsed.data.lng ?? null,
      problem_statement: parsed.data.problem_statement,
      expected_impact: parsed.data.expected_impact,
      target_amount: parsed.data.target_amount ?? null,
      funding_deadline: parsed.data.funding_deadline ?? null,
      cover_image_url: parsed.data.cover_image_url ?? null,
    })
    .eq("id", id)
    .select("id")
    .single();

  if (error || !row) {
    return {
      success: false,
      error: error?.message ?? "Немате дозвола или иницијативата не постои",
    };
  }

  revalidatePath("/initiatives");
  revalidatePath(`/initiatives/${id}`);
  return { success: true, id: row.id };
}

// ── Delete (owner or admin; RLS enforces) ───────────────────────────
type DeleteResult = { success: true } | { success: false; error: string };

export async function deleteInitiative(id: string): Promise<DeleteResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "NOT_AUTHENTICATED" };
  }

  const { error } = await supabase.from("initiatives").delete().eq("id", id);
  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/initiatives");
  return { success: true };
}

// ── Manage: stage + progress/completion log (owner or admin; RLS enforces) ──
type ManageResult = { success: true } | { success: false; error: string };

const STAGES = [
  "idea",
  "voting",
  "funding",
  "completed",
  "rejected",
] as const;
type Stage = (typeof STAGES)[number];

/**
 * Move an initiative to a different stage. Sets `completed_at` on entering the
 * `completed` stage and clears it on leaving, so the timestamp tracks the
 * current state. RLS ("Own or admin update initiative") gates authorization.
 */
export async function setInitiativeStage(
  id: string,
  stage: Stage,
): Promise<ManageResult> {
  if (!STAGES.includes(stage)) {
    return { success: false, error: "Непознат стадиум" };
  }
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "NOT_AUTHENTICATED" };

  const { error } = await supabase
    .from("initiatives")
    .update({
      stage,
      completed_at: stage === "completed" ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/initiatives");
  revalidatePath(`/initiatives/${id}`);
  return { success: true };
}

const progressSchema = z.object({
  note: z.string().trim().max(2000, "Максимум 2000 знаци").nullable().optional(),
  images: z.array(z.string().url()).max(5, "Најмногу 5 слики"),
});

/**
 * Save the progress/completion note and gallery. Images are uploaded
 * client-side to the `initiative-images` bucket (same as the cover) and their
 * URLs passed here. Does NOT change the stage — completing is a separate,
 * explicit action via {@link setInitiativeStage}. RLS gates authorization.
 */
export async function saveInitiativeProgress(
  id: string,
  input: { note: string | null; images: string[] },
): Promise<ManageResult> {
  const parsed = progressSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Проверете ги полињата" };
  }
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "NOT_AUTHENTICATED" };

  const { error } = await supabase
    .from("initiatives")
    .update({
      completion_note: parsed.data.note?.trim() || null,
      completion_images: parsed.data.images,
    })
    .eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/initiatives");
  revalidatePath(`/initiatives/${id}`);
  return { success: true };
}

// ── Vote toggle ─────────────────────────────────────────────────────
type VoteResult =
  | { success: true; voted: boolean; count: number }
  | { success: false; error: string };

export async function castVoteOnInitiative(initiativeId: string): Promise<VoteResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "NOT_AUTHENTICATED" };
  }

  const { data, error } = await supabase
    .rpc("toggle_initiative_vote", { p_initiative_id: initiativeId })
    .single<{ vote_count: number; voted: boolean }>();

  if (error || !data) {
    return { success: false, error: error?.message ?? "Грешка" };
  }

  revalidatePath("/initiatives");
  return { success: true, voted: data.voted, count: data.vote_count };
}
