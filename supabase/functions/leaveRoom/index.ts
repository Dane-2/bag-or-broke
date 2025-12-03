import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  // --- CORS ---
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  try {
    const { roomId, playerId } = await req.json();

    if (!roomId || !playerId) {
      return new Response(
        JSON.stringify({ error: "Missing roomId or playerId" }),
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    // Use SERVICE ROLE KEY to bypass RLS
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Get room info to check if player is host
    const { data: room, error: roomErr } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", roomId)
      .single();

    if (roomErr || !room) {
      return new Response(
        JSON.stringify({ error: "Room not found" }),
        { status: 404, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const isHost = room.host_player_id === playerId;

    // 2. Delete player from player_state
    const { error: deleteErr } = await supabase
      .from("player_state")
      .delete()
      .eq("room_id", roomId)
      .eq("player_id", playerId);

    if (deleteErr) {
      return new Response(
        JSON.stringify({ error: deleteErr.message }),
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    // 3. If host left, transfer host to another player or mark room as abandoned
    if (isHost) {
      // Find another player to become host
      const { data: remainingPlayers } = await supabase
        .from("player_state")
        .select("player_id, name")
        .eq("room_id", roomId)
        .order("player_id", { ascending: true })
        .limit(1);

      if (remainingPlayers && remainingPlayers.length > 0) {
        // Transfer host to first remaining player
        const newHost = remainingPlayers[0];
        await supabase
          .from("rooms")
          .update({
            host_player_id: newHost.player_id,
            host_name: newHost.name,
          })
          .eq("id", roomId);
      } else {
        // No players left, delete the room and all player_state entries
        await supabase
          .from("player_state")
          .delete()
          .eq("room_id", roomId);

        await supabase
          .from("rooms")
          .delete()
          .eq("id", roomId);
      }
    } else {
      // Regular player left - check if room is now empty and delete if so
      const { data: remainingPlayers } = await supabase
        .from("player_state")
        .select("player_id")
        .eq("room_id", roomId);

      if (!remainingPlayers || remainingPlayers.length === 0) {
        // Room is empty, delete it
        await supabase
          .from("rooms")
          .delete()
          .eq("id", roomId);
      }
    }

    return new Response(
      JSON.stringify({ success: true, wasHost: isHost }),
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.toString() }),
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
});

