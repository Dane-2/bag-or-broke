import { useEffect, useRef, useState } from "react";

// Tracks previous net worth values to show gain/loss arrows.
export default function useNetWorthHistory(roomPlayers) {
  const prevValuesRef = useRef({});
  const [deltas, setDeltas] = useState({}); // { playerId: "up" | "down" | "none" }

  useEffect(() => {
    const newDeltas = {};

    Object.values(roomPlayers).forEach((p) => {
      const id = p.player_id;

      const net =
        (p.cash || 0) +
        (p.rep * 100 || 0) + // example multiplier
        (p.laps * 500 || 0) -
        (p.debt || 0);

      const prev = prevValuesRef.current[id];

      if (prev === undefined) {
        newDeltas[id] = "none";
      } else if (net > prev) {
        newDeltas[id] = "up";
      } else if (net < prev) {
        newDeltas[id] = "down";
      } else {
        newDeltas[id] = "none";
      }

      prevValuesRef.current[id] = net;
    });

    setDeltas(newDeltas);
  }, [roomPlayers]);

  return deltas;
}
