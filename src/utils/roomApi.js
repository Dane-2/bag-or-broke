import { supabase } from "./supabaseClient";

export async function createRoom() {
  const { data, error } = await supabase.functions.invoke("createRoom", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
    }
  });

  if (error) {
    console.error("createRoom error:", error);
    return { error: error.message };
  }

  return data;
}

export async function joinRoom(code, name, avatar, startingCash) {
  const { data, error } = await supabase.functions.invoke("joinRoom", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
    },
    body: { code, name, avatar, startingCash }
  });

  if (error) {
    console.error("joinRoom error:", error);
    return { error: error.message };
  }

  return data;
}

export async function startGame(roomId, totalLaps = 5) {
  if (!roomId) return { error: "Missing roomId" };

  try {
    const response = await fetch(
      `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/startGame`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: process.env.REACT_APP_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ roomId, totalLaps }),
      }
    );

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const error = payload?.error || `startGame failed (${response.status})`;
      return { error };
    }

    const payload = await response.json().catch(() => ({}));
    return payload;
  } catch (err) {
    console.error("startGame error:", err);
    return { error: err.message || "startGame failed" };
  }
}

export async function leaveRoom(roomId, playerId) {
  if (!roomId || !playerId) return { error: "Missing roomId or playerId" };

  try {
    const response = await fetch(
      `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/leaveRoom`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: process.env.REACT_APP_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ roomId, playerId }),
      }
    );

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const error = payload?.error || `leaveRoom failed (${response.status})`;
      return { error };
    }

    const payload = await response.json().catch(() => ({}));
    return payload;
  } catch (err) {
    console.error("leaveRoom error:", err);
    return { error: err.message || "leaveRoom failed" };
  }
}
