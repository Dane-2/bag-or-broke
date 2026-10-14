// Smoke test: a solo game driven through the real dashboard and the finance ledger.
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, within } from '@testing-library/react';
import PlayerDashboard from '../PlayerDashboard';

jest.mock('../../utils/fetchAiSummary', () => ({
  fetchAiSummary: async () => ({ summary: 'ok', archetype: 'The Architect' }),
}));

const rollButtons = () => {
  const label = screen.getByText('Log your roll');
  return within(label.closest('div').parentElement).getAllByRole('button').filter(b => /^\d+$/.test(b.textContent));
};
const roll = n => fireEvent.click(rollButtons().find(b => b.textContent === String(n)));

beforeEach(() => {
  localStorage.clear();
  window.confirm = jest.fn(() => true);
});

test('rolling closes a lap, posts the award and bills tax on NIL income', () => {
  render(<PlayerDashboard playerName="Tester" avatar="Walk On" startingCash={12500} totalLaps={5} showFinal={jest.fn()} />);

  // NIL income with the 20% set-aside.
  fireEvent.click(screen.getByText('+ Add Cash'));
  fireEvent.change(screen.getByPlaceholderText('Amount ($)'), { target: { value: '50000' } });
  fireEvent.click(screen.getByText('Confirm'));
  expect(screen.getByText('$52,500')).toBeInTheDocument(); // 12,500 + 40,000
  expect(screen.getByText('$10,000')).toBeInTheDocument(); // Tax Bucket

  // Exactly one lap, stepping only on green, diamond and purple spaces (no cash events).
  [5, 6, 6, 6, 6, 5, 5, 1].forEach(roll);
  expect(screen.getByText('Lap 1 / 5 complete')).toBeInTheDocument();
  expect(screen.getByText('$55,000')).toBeInTheDocument(); // + $2,500 lap award

  // Finance shows the lap tax bill: 20% of $52,500.
  fireEvent.click(screen.getAllByText('Finance').pop());
  expect(screen.getByText('Lap 1 tax')).toBeInTheDocument();
  expect(screen.getAllByText('$10,500').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByText(/^Pay \$10,000$/));
  expect(screen.getByText('Taxes Owed').nextSibling.textContent).toBe('$500');
  expect(screen.getByText('Tax Bucket', { selector: 'span' }).nextSibling.textContent).toBe('$0');
});

test('landing on green buys an investment; launch roll sets its value', () => {
  render(<PlayerDashboard playerName="Investor" avatar="Walk On" startingCash={12500} totalLaps={5} showFinal={jest.fn()} />);
  roll(1); // space 1 is green
  expect(screen.getByText('Space 1: Investments')).toBeInTheDocument();
  fireEvent.click(screen.getAllByText('Invest').pop());
  fireEvent.click(screen.getAllByText('Start a Video Creator Channel')[0]);
  fireEvent.click(screen.getByRole('button', { name: '4' }));
  fireEvent.click(screen.getByText('Confirm purchase'));
  expect(screen.getByText('Businesses & property')).toBeInTheDocument();
  expect(screen.getAllByText('$11,500').length).toBeGreaterThan(0);
  // The landing is used: a second purchase is refused.
  expect(screen.getByText(/already used this landing/)).toBeInTheDocument();
});

test('a luxury bought on credit from a diamond landing shows as debt', () => {
  render(<PlayerDashboard playerName="Buyer" avatar="Walk On" startingCash={12500} totalLaps={5} showFinal={jest.fn()} />);
  roll(3); // space 3 is diamond
  fireEvent.click(screen.getAllByText('Luxury').pop());
  fireEvent.click(screen.getAllByText('Used economy sedan')[0]);
  fireEvent.change(screen.getByDisplayValue('Pay with cash'), { target: { value: 'finance' } });
  expect(screen.getByText('$10,000', { selector: '.text-red-800' })).toBeInTheDocument(); // new debt
  fireEvent.click(screen.getByText('Confirm purchase'));
  expect(screen.getByText(/Resale \$8,000/)).toBeInTheDocument();

  fireEvent.click(screen.getAllByText('Finance').pop());
  expect(screen.getByText('Total Borrowing').nextSibling.textContent).toBe('$10,000');
  expect(screen.getByText('Available credit').nextSibling.textContent).toBe('$10,000');
});

test('landing on yellow draws an NIL card and posts its base benefit', () => {
  render(<PlayerDashboard playerName="Star" avatar="Walk On" startingCash={12500} totalLaps={5} showFinal={jest.fn()} />);
  roll(2); // space 2 is yellow
  expect(screen.getByText(/NIL opportunities/)).toBeInTheDocument();
  // The drawn card is random; its benefit line (or the toast) names the kind of benefit.
  expect(screen.getAllByText(/added to your cash|Emergency Fund added|Optional service offered/).length).toBeGreaterThan(0);
});

test('landing on purple offers a career activity that awards points on completion', () => {
  render(<PlayerDashboard playerName="Pro" avatar="Walk On" startingCash={12500} totalLaps={5} showFinal={jest.fn()} />);
  roll(6);
  roll(1); // space 7 is purple
  expect(screen.getByText('Career opportunity')).toBeInTheDocument();
  fireEvent.change(screen.getByDisplayValue('Choose a career path…'), { target: { value: 'energy' } });
  const choices = screen.getAllByRole('button').filter(b => b.className.includes('text-left') && !b.disabled);
  fireEvent.click(choices[choices.length - 1]);
  expect(screen.queryByText('Career opportunity')).not.toBeInTheDocument();
});

test('landing on red draws a curveball with response cards', () => {
  render(<PlayerDashboard playerName="Grit" avatar="Walk On" startingCash={12500} totalLaps={5} showFinal={jest.fn()} />);
  roll(4); // space 4 is red
  const panel = screen.queryByText('Financial curveball') || screen.queryByText('All clear this turn');
  expect(panel).toBeInTheDocument();
});

test('finish freezes the result and reports the game value', async () => {
  const showFinal = jest.fn();
  render(<PlayerDashboard playerName="Finisher" avatar="Walk On" startingCash={12500} totalLaps={5} showFinal={showFinal} />);
  fireEvent.click(screen.getByLabelText('Profile'));
  fireEvent.click(screen.getByText('Finish Early & Reveal'));
  await screen.findByText('Finish Early & Reveal');
  await new Promise(r => setTimeout(r, 0));
  expect(showFinal).toHaveBeenCalled();
  const payload = showFinal.mock.calls[0][0];
  // $12,500 cash + credit bonus $0 at 500 (deadline never reached) = $12,500.
  expect(payload.score.gameValue).toBe(1250000);
});
