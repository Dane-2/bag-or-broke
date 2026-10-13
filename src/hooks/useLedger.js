import { useCallback, useRef, useState } from 'react';
import { applyOp, newOpId } from '../rules/ledger';
import { fromCents, toCents } from '../rules/money';

/**
 * Holds the player's finance ledger. `run` applies an operation synchronously against the
 * latest state (so back-to-back calls never read a stale balance) and returns its result,
 * or throws a LedgerError without changing anything.
 */
export default function useLedger(initial) {
  const [ledger, setLedgerState] = useState(initial);
  const ref = useRef(ledger);

  const replace = useCallback(next => {
    ref.current = next;
    setLedgerState(next);
  }, []);

  const run = useCallback(
    (type, payload = {}, id = newOpId(type)) => {
      const { state, result } = applyOp(ref.current, { id, type, ...payload });
      replace(state);
      return result;
    },
    [replace]
  );

  /**
   * Adapter for components that still adjust cash in dollars via setCash(prev => ...).
   * Each call becomes an untaxed cash adjustment in the ledger.
   */
  const setCash = useCallback(
    (valueOrUpdater, label = 'Cash adjustment') => {
      const current = fromCents(ref.current.cash);
      const next = typeof valueOrUpdater === 'function' ? valueOrUpdater(current) : valueOrUpdater;
      const delta = toCents(next) - ref.current.cash;
      if (delta !== 0 && !ref.current.snapshot) run('adjust_cash', { amount: delta, label });
    },
    [run]
  );

  return { ledger, run, replace, setCash, current: ref };
}
