// Server copy of a group player's save (supabase/migrations/20261026000000_player_saves.sql).
// The server keeps only the newest save (board progress, then ledger sequence).
import { supabase, isSupabaseConfigured } from './supabaseClient';

/** Which of two ledger saves is further along; null-safe. */
export function newerSave(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  const pa = a.progress || 0, pb = b.progress || 0;
  if (pa !== pb) return pa > pb ? a : b;
  return (a.seq || 0) >= (b.seq || 0) ? a : b;
}

export async function putServerSave(roomId, playerId, ledger) {
  if (!isSupabaseConfigured || !roomId || !playerId) return { error: 'offline' };
  const { error } = await supabase.rpc('player_save_put', {
    p_room: String(roomId), p_player: String(playerId), p_ruleset: ledger.rulesetId,
    p_progress: ledger.progress || 0, p_seq: ledger.seq || 0, p_state: ledger,
  });
  return error ? { error: error.message } : { ok: true };
}

export async function getServerSave(roomId, playerId) {
  if (!isSupabaseConfigured || !roomId || !playerId) return null;
  const { data, error } = await supabase.rpc('player_save_get', { p_room: String(roomId), p_player: String(playerId) });
  if (error || !data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return row?.state || null;
}
