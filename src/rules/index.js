// Rules release pinned for new games. Config files in ./config are copied unchanged from
// the bobupdates handoff (BOB-DIGITAL-ASSEMBLY-20261013-v1); change numbers there, not in code.
import core from './config/core.json';
import board from './config/board.json';

export const RULESET_ID = core.ruleset_id;
export const BOARD_SIZE = core.board_size;
export const GAME_LENGTHS = core.game_lengths;

/** localStorage key prefix for saves made under this ruleset. Older prefixes are discarded. */
export const SAVE_PREFIX = 'bagorbroke_v2_save_';
export const LEGACY_SAVE_PREFIXES = ['bagorbroke_save_'];

export const SPACE_CATEGORIES = board.categories;

/** Board space by zero-based index: { index, category, label }. */
export function boardSpace(index) {
  const space = board.spaces.find(s => s.index === index);
  if (!space) return null;
  return {
    index,
    category: space.category,
    label: space.category === 'start' ? 'Start' : board.categories[space.category],
  };
}
