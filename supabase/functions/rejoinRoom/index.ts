import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Returns a player to the group they already belong to (Fix Log v1.2 #3 / #5).
// Going offline never removes a player; only the Leave Room button does (leaveRoom).
//   { roomId, playerId }  same device: the saved seat is touched and returned (restored under
//                         the same id if an older app version removed it on tab close).
//   { code, name }        another device: matches the seat by exact name, only while that
//                         seat is offline, so an active player's seat cannot be taken.
const OFFLINE_AFTER_MS = 30000;

const headers = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      },
    });
  }

  try {
    const { roomId, playerId, code, name, avatar } = await req.json();
    if (!(roomId && playerId) && !(code && name)) {
      return reply({ error: "Missing room and player" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const roomQuery = supabase.from("rooms").select("*");
    const { data: room } = await (roomId ? roomQuery.eq("id", roomId) : roomQuery.eq("code", code)).maybeSingle();
    if (!room) return reply({ error: "This group game is no longer available." }, 404);
    if (room.status === "completed") return reply({ error: "This group game has already finished." }, 400);

    const { data: seats } = await supabase.from("player_state").select("*").eq("room_id", room.id);
    let player = null;
    if (playerId) {
      player = (seats || []).find((p) => String(p.player_id) === String(playerId)) || null;
    } else {
      const matches = (seats || []).filter((p) => (p.name || "").trim().toLowerCase() === String(name).trim().toLowerCase());
      if (matches.length > 1) return reply({ error: "More than one player uses that name in this room." }, 409);
      player = matches[0] || null;
      if (player && player.updated_at && Date.now() - new Date(player.updated_at).getTime() < OFFLINE_AFTER_MS) {
        return reply({ error: "That player is active on another device." }, 409);
      }
    }
    if (!player && playerId && name && (seats || []).length < 6) {
      // A seat removed by the old "close tab = leave" behavior: restore it under the same id.
      const { data: restored } = await supabase
        .from("player_state")
        .insert({ room_id: room.id, player_id: playerId, name, avatar, rep: 0, credit: 500, debt: 0, laps: 0, investments: [], luxuries: [] })
        .select()
        .single();
      player = restored || null;
    }
    if (!player) return reply({ error: "You are no longer a member of this group game." }, 404);

    // Touch the seat so the group sees the player online again.
    const { data: touched } = await supabase
      .from("player_state")
      .update({ updated_at: new Date().toISOString() })
      .eq("room_id", room.id)
      .eq("player_id", player.player_id)
      .select()
      .single();

    // The newest server copy of this player's game (absent until the first save upload).
    const { data: saved } = await supabase
      .from("player_saves")
      .select("state")
      .eq("room_id", String(room.id))
      .eq("player_id", String(player.player_id))
      .maybeSingle();

    return reply({ room, player: touched || player, save: saved?.state || null });
  } catch (err) {
    return reply({ error: String(err) }, 500);
  }
});
