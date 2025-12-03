import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  // --- CORS ---
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
    // Use SERVICE ROLE KEY to bypass RLS
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find rooms with no activity for 10 minutes (600000 ms)
    const tenMinutesAgo = new Date(Date.now() - 600000).toISOString();

    // Get rooms that haven't been updated and have no active players
    const { data: oldRooms, error: roomsErr } = await supabase
      .from("rooms")
      .select("id, updated_at")
      .or(`status.eq.abandoned,updated_at.lt.${tenMinutesAgo}`);

    if (roomsErr) {
      return new Response(
        JSON.stringify({ error: roomsErr.message }),
        { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    if (!oldRooms || oldRooms.length === 0) {
      return new Response(
        JSON.stringify({ cleaned: 0, message: "No rooms to clean up" }),
        {
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
          },
        }
      );
    }

    let cleaned = 0;

    for (const room of oldRooms) {
      // Check if room has any active players
      const { data: players } = await supabase
        .from("player_state")
        .select("player_id")
        .eq("room_id", room.id);

      // If no players or room is abandoned, delete it
      if (!players || players.length === 0 || room.status === "abandoned") {
        // Delete all player_state entries for this room
        await supabase
          .from("player_state")
          .delete()
          .eq("room_id", room.id);

        // Delete the room
        await supabase
          .from("rooms")
          .delete()
          .eq("id", room.id);

        cleaned++;
      }
    }

    return new Response(
      JSON.stringify({ cleaned, message: `Cleaned up ${cleaned} room(s)` }),
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


