import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Anonymous, cookie-free Supabase client for PUBLIC server reads.
 *
 * `./server` reads cookies() to carry the visitor's session, and in Next that
 * alone forces the whole route to render per request (0% cached on Vercel).
 * Pages that only show public data — the same rows for every visitor, as RLS
 * lets `anon` see them — should use this instead so they can be cached with
 * `export const revalidate`. Never use it for anything user-specific.
 */
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}
