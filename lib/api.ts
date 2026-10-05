import type { SupabaseClient } from '@supabase/supabase-js';
import { currentAccess } from './auth/access';
import type { Permission } from './permissions';

/** Every module requests its permission; omitted permission checks enabled authentication only. RLS still applies. */
export async function authedClient(access?: Permission): Promise<SupabaseClient | null> {
  const session = await currentAccess();
  if (!session || (access && !session.profile.permissions.includes(access))) return null;
  return session.supabase;
}

export const unauthorized = () => Response.json({ error: 'Necesitás una cuenta con permiso para esta acción.' }, { status: 403 });

const PAGE = 1000;

/** PostgREST caps each response (1000 rows by default); read every page of a query. */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

/** The client UI reads JSON columns as strings (as they were stored in SQLite). */
export function reservationOut<T extends { sectors_json?: unknown; repeat_rule?: unknown }>(row: T) {
  return {
    ...row,
    sectors_json: row.sectors_json == null ? null : JSON.stringify(row.sectors_json),
    repeat_rule: row.repeat_rule == null ? null : JSON.stringify(row.repeat_rule),
  };
}

/** Escapes LIKE wildcards so ilike behaves as a case-insensitive equality. */
export const likeLiteral = (value: string) => value.replace(/[\\%_]/g, c => '\\' + c);
