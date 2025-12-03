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
    const { code, name, avatar, startingCash } = await req.json();

    if (!code || !name) {
      return new Response(
        JSON.stringify({ error: "Missing room code or name" }),
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    // Use SERVICE ROLE KEY to bypass RLS
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Find room by code
    const { data: room, error: roomErr } = await supabase
      .from("rooms")
      .select("*")
      .eq("code", code)
      .single();

    if (roomErr || !room) {
      return new Response(
        JSON.stringify({ error: "Room not found. Please check the room code." }),
        { status: 404, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    // Check if room is joinable (not started/completed/abandoned)
    if (room.status !== "lobby") {
      return new Response(
        JSON.stringify({ error: `Room is ${room.status}. Cannot join at this time.` }),
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    // Check max players limit (6 players)
    const { data: existingPlayers, error: countErr } = await supabase
      .from("player_state")
      .select("player_id")
      .eq("room_id", room.id);

    if (countErr) {
      return new Response(
        JSON.stringify({ error: "Failed to check room capacity" }),
        { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    if (existingPlayers && existingPlayers.length >= 6) {
      return new Response(
        JSON.stringify({ error: "Room is full (6 players maximum). Please join another room." }),
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    // Resolve host metadata if it is missing on the room record
    let hostName = room.host_name || "";
    let hostPlayerId = room.host_player_id || null;

    if (!hostName || !hostPlayerId) {
      const { data: hostCandidates } = await supabase
        .from("player_state")
        .select("player_id,name")
        .eq("room_id", room.id)
        .order("player_id", { ascending: true })
        .limit(1);

      const hostCandidate = hostCandidates?.[0];
      if (hostCandidate) {
        hostPlayerId = hostPlayerId || hostCandidate.player_id;
        hostName = hostName || hostCandidate.name || "";
      }
    }

    const roomWithHost = {
      ...room,
      host_name: hostName,
      host_player_id: hostPlayerId,
    };

    const parsedStartingCash =
      typeof startingCash === "number" && !Number.isNaN(startingCash)
        ? startingCash
        : 0;

    // 2. Add player to room
    const { data: player, error: insertErr } = await supabase
      .from("player_state")
      .insert({
        room_id: room.id,
        name,
        avatar,
        cash: parsedStartingCash,
        rep: 0,
        credit: 500,
        debt: 0,
        shadyDebt: 0,
        lap: 0,
        investments: [],
        luxuries: [],
      })
      .select()
      .single();

    if (insertErr) {
      return new Response(
        JSON.stringify({ error: insertErr.message }),
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    return new Response(
      JSON.stringify({ room: roomWithHost, player }),
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
