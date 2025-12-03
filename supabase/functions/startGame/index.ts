import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
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
    const { roomId, totalLaps } = await req.json();

    if (!roomId) {
      return new Response(
        JSON.stringify({ error: "Missing roomId" }),
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error } = await supabase
      .from("rooms")
      .update({
        status: "started",
        total_laps: totalLaps ?? 5,
      })
      .eq("id", roomId);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Access-Control-Allow-Origin": "*" },
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.toString() }),
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
});
