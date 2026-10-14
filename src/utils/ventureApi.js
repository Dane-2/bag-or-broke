// Shared sports-complex share market (multiplayer only). Writes go through the locked database
// functions in supabase/migrations/20261013000000_shared_ventures.sql; each player's ledger
// applies its own side of a transfer once, keyed by the transfer id.
import { supabase, isSupabaseConfigured } from './supabaseClient';

const rpc = async (fn, args) => {
  if (!isSupabaseConfigured) return { error: 'Multiplayer is not configured.' };
  const { data, error } = await supabase.rpc(fn, args);
  return error ? { error: error.message } : { data };
};

export const publishVenture = (roomId, founderId, founderName, v) =>
  rpc('venture_publish', {
    p_id: v.ventureId, p_room: String(roomId), p_founder: String(founderId), p_founder_name: founderName, p_title: v.title,
    p_value: v.value, p_rate: v.rateBps, p_progress: v.progress, p_failed: v.failed, p_stopped: v.stopped,
  });

export const listUnits = (ventureId, sellerId, units) =>
  rpc('venture_list', { p_id: ventureId, p_seller: String(sellerId), p_units: units });

export const buyUnits = ({ ventureId, transferId, buyerId, buyerName, sellerId, units, revision }) =>
  rpc('venture_buy', {
    p_id: ventureId, p_transfer: transferId, p_buyer: String(buyerId), p_buyer_name: buyerName,
    p_seller: String(sellerId), p_units: units, p_revision: revision,
  });

export const markApplied = (transferId, playerId) => rpc('venture_mark_applied', { p_transfer: transferId, p_player: String(playerId) });

export const freezeStake = (ventureId, playerId, stakeCents) =>
  rpc('venture_freeze', { p_id: ventureId, p_player: String(playerId), p_stake_cents: stakeCents });

export async function loadRoomVentures(roomId) {
  if (!isSupabaseConfigured || !roomId) return { ventures: [], transfers: [] };
  const [v, t] = await Promise.all([
    supabase.from('ventures').select('*').eq('room_id', String(roomId)),
    supabase.from('venture_transfers').select('*').eq('room_id', String(roomId)),
  ]);
  return { ventures: v.data || [], transfers: t.data || [], error: v.error?.message || t.error?.message };
}

/** Realtime updates for this room's companies and transfers; returns an unsubscribe function. */
export function subscribeRoomVentures(roomId, onChange) {
  if (!isSupabaseConfigured || !roomId) return () => {};
  const channel = supabase
    .channel(`ventures_${roomId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ventures', filter: `room_id=eq.${roomId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'venture_transfers', filter: `room_id=eq.${roomId}` }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
