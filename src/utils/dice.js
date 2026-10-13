// Fair six-sided dice for rolls the app makes on the player's behalf (market moves each
// owned lap, or "roll for me"). Results are stored in the ledger operation that uses them,
// so refreshing or retrying never rerolls.
export function rollDie() {
  const cryptoObj = typeof window !== 'undefined' ? window.crypto : null;
  if (cryptoObj && cryptoObj.getRandomValues) {
    const buf = new Uint8Array(1);
    // Rejection sampling keeps all six faces equally likely (252 = 6 * 42).
    do {
      cryptoObj.getRandomValues(buf);
    } while (buf[0] >= 252);
    return (buf[0] % 6) + 1;
  }
  return Math.floor(Math.random() * 6) + 1;
}

export function rollDice(count) {
  return Array.from({ length: count }, rollDie);
}
