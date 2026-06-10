import type { createServiceClient } from '@/lib/supabase-server'

type ServiceClient = ReturnType<typeof createServiceClient>

/**
 * `members.name_color` is a pending migration (supabase/migrate-name-color.sql)
 * that is not present in every environment. Probe for it once per process so
 * queries can include the column when it exists and omit it (defaulting to
 * null) otherwise — instead of hard-failing with a PostgREST 42703 error, which
 * is what currently breaks the chatter leaderboard and member profile stats in
 * any environment where the migration hasn't been run.
 */
let nameColorPresent: boolean | null = null

/** PostgREST error code for "column does not exist". */
const UNDEFINED_COLUMN = '42703'

export async function membersHaveNameColor(supabase: ServiceClient): Promise<boolean> {
  if (nameColorPresent !== null) return nameColorPresent
  const { error } = await supabase.from('members').select('name_color').limit(1)
  nameColorPresent = error?.code !== UNDEFINED_COLUMN
  return nameColorPresent
}

/**
 * Build a members `select` list that includes `name_color` only when the column
 * exists. `extra` is appended verbatim (e.g. `, created_at`).
 */
export function memberSelect(hasNameColor: boolean, extra = ''): string {
  return `id, name, display_name, ${hasNameColor ? 'name_color, ' : ''}access_badges, is_moderator, is_admin${extra}`
}
