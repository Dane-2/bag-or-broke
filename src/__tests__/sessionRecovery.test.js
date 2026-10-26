// Fix Log v1.2 #3 / #5 / #6: a group player who goes offline returns to the same seat with the
// same game, and the lap and year counters always agree.
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, act } from '@testing-library/react';
import App from '../App';
import { createLedger, applyOp, currentYear, completedLaps } from '../rules/ledger';
import { newerSave } from '../utils/saveApi';
import { SAVE_PREFIX } from '../rules';

const mockLeave = jest.fn(async () => ({}));
const mockRejoin = jest.fn(async () => ({ room: { id: 'room-1' }, player: { player_id: 'p-1' } }));
jest.mock('../utils/roomApi', () => ({
  leaveRoom: (...a) => mockLeave(...a),
  rejoinRoom: (...a) => mockRejoin(...a),
  createRoom: jest.fn(), joinRoom: jest.fn(), startGame: jest.fn(),
}));
jest.mock('../utils/supabaseClient', () => {
  const channel = { on: () => channel, subscribe: () => channel };
  const query = { select: () => query, eq: () => query, update: () => query, single: async () => ({ data: null }), then: r => r({ data: [], error: null }) };
  return {
    isSupabaseConfigured: false,
    supabase: { channel: () => channel, removeChannel: () => {}, from: () => query, rpc: async () => ({ data: null }) },
  };
});
jest.mock('jspdf', () => ({ jsPDF: jest.fn() }));
jest.mock('../utils/fetchAiSummary', () => ({ fetchAiSummary: async () => ({ summary: 'ok' }) }));

const roll = (d, n, i) => applyOp(d, { id: `r${i}`, type: 'roll', steps: n, draws: Array(60).fill(3) }).state;
const playLaps = (laps) => {
  let d = createLedger({ openingCash: 1250000, totalLaps: 5, landingEvents: false });
  for (let i = 0; d.progress < laps * 40; i++) d = roll(d, Math.min(6, laps * 40 - d.progress), i);
  return d;
};

beforeEach(() => {
  localStorage.clear();
  mockLeave.mockClear();
  mockRejoin.mockClear();
});

test('one lap is one year: the year is the lap in progress and stays at the last year at the end', () => {
  expect(currentYear(createLedger({ openingCash: 0, totalLaps: 5 }))).toBe(1);
  const four = playLaps(4);
  expect(completedLaps(four)).toBe(4);
  expect(currentYear(four)).toBe(5); // 4 laps done, lap/year 5 in progress
  expect(currentYear(playLaps(5))).toBe(5);
  // A restored save is plain data, so the year comes back identical.
  expect(currentYear(JSON.parse(JSON.stringify(four)))).toBe(5);
});

test('the newer save wins by board progress, then ledger sequence; a stale copy never wins', () => {
  const a = { progress: 40, seq: 9 };
  const b = { progress: 44, seq: 2 };
  expect(newerSave(a, b)).toBe(b);
  expect(newerSave(b, a)).toBe(b);
  expect(newerSave({ progress: 40, seq: 10 }, a).seq).toBe(10);
  expect(newerSave(a, { ...a })).toBe(a); // tie keeps the copy already in play
  expect(newerSave(null, a)).toBe(a);
});

const seatSave = (finance) => ({
  rulesetId: finance.rulesetId, playerName: 'Jordan', avatar: 'Walk-On', finance, totalLaps: 5, savedAt: 2,
  room: { roomId: 'room-1', code: 'ABCD', playerId: 'p-1', name: 'Jordan', avatar: 'Walk-On', totalLaps: 5 },
});

test('reopening the app returns a group player to the same room and seat with their game', async () => {
  const finance = playLaps(2);
  localStorage.setItem(`${SAVE_PREFIX}room_room-1_p-1`, JSON.stringify(seatSave(finance)));
  localStorage.setItem(`${SAVE_PREFIX}Jordan`, JSON.stringify({ rulesetId: finance.rulesetId, playerName: 'Jordan', finance: createLedger({ openingCash: 0 }), savedAt: 1 }));
  window.confirm = jest.fn(() => true);

  render(<App />);
  await waitFor(() => expect(window.confirm).toHaveBeenCalledWith('Rejoin your group game (room ABCD) as Jordan?'));
  // Same game: year 3 (two laps done) and the group leaderboard button, not a private copy.
  await waitFor(() => expect(screen.getAllByText('Year 3 of 5 · Lap 3').length).toBeGreaterThan(0));
  expect(screen.getByLabelText('Leaderboard')).toBeInTheDocument();
  expect(mockLeave).not.toHaveBeenCalled();
  // The saved seat is kept for the room, not rewritten under an offline key.
  await act(async () => {});
  const kept = JSON.parse(localStorage.getItem(`${SAVE_PREFIX}room_room-1_p-1`));
  expect(kept.room.playerId).toBe('p-1');
  expect(kept.finance.progress).toBe(80);
});

test('declining once keeps the seat; only confirming "leave for good" removes it', async () => {
  const finance = playLaps(1);
  localStorage.setItem(`${SAVE_PREFIX}room_room-1_p-1`, JSON.stringify(seatSave(finance)));
  window.confirm = jest.fn(() => false);
  const { unmount } = render(<App />);
  await waitFor(() => expect(window.confirm).toHaveBeenCalledTimes(2));
  expect(mockLeave).not.toHaveBeenCalled();
  expect(localStorage.getItem(`${SAVE_PREFIX}room_room-1_p-1`)).not.toBeNull();
  unmount();

  window.confirm = jest.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
  render(<App />);
  await waitFor(() => expect(mockLeave).toHaveBeenCalledWith('room-1', 'p-1'));
  expect(localStorage.getItem(`${SAVE_PREFIX}room_room-1_p-1`)).toBeNull();
});
