// ─── Player Distribution ──────────────────────────────────────────────
// Maps total player count → { good, evil }
const PLAYER_DISTRIBUTION = {
  5: { good: 3, evil: 2 },
  6: { good: 4, evil: 2 },
  7: { good: 4, evil: 3 },
  8: { good: 5, evil: 3 },
  9: { good: 6, evil: 3 },
  10: { good: 6, evil: 4 },
};

// ─── Quest Team Sizes ─────────────────────────────────────────────────
// questTeamSizes[playerCount][questIndex] = team size
const QUEST_TEAM_SIZES = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5],
  9: [3, 4, 4, 5, 5],
  10: [3, 4, 4, 5, 5],
};

// ─── Two-Fail Quests ──────────────────────────────────────────────────
// For 7+ players, Quest 4 (index 3) requires 2 fail cards to fail.
const TWO_FAIL_QUEST_INDEX = 3; // Quest 4 (0-indexed)
const TWO_FAIL_MIN_PLAYERS = 7;

// ─── Rejection Track ──────────────────────────────────────────────────
const MAX_REJECTIONS = 5;

// ─── Teams ────────────────────────────────────────────────────────────
const TEAM_GOOD = 'good';
const TEAM_EVIL = 'evil';

// ─── Roles ────────────────────────────────────────────────────────────
const ROLES = {
  // Good roles
  MERLIN: { name: 'Merlin', team: TEAM_GOOD, key: 'merlin' },
  PERCIVAL: { name: 'Percival', team: TEAM_GOOD, key: 'percival' },
  LOYAL_SERVANT: { name: 'Loyal Servant', team: TEAM_GOOD, key: 'loyalServant' },

  // Evil roles
  ASSASSIN: { name: 'Assassin', team: TEAM_EVIL, key: 'assassin' },
  MORGANA: { name: 'Morgana', team: TEAM_EVIL, key: 'morgana' },
  MORDRED: { name: 'Mordred', team: TEAM_EVIL, key: 'mordred' },
  OBERON: { name: 'Oberon', team: TEAM_EVIL, key: 'oberon' },
  MINION: { name: 'Minion of Mordred', team: TEAM_EVIL, key: 'minion' },
};

// Special roles that can be toggled by the host
const SPECIAL_ROLES = ['merlin', 'assassin', 'percival', 'morgana', 'mordred', 'oberon'];

// Roles that must be paired together
const ROLE_DEPENDENCIES = {
  merlin: 'assassin',
  assassin: 'merlin',
  percival: null,     // Can be standalone
  morgana: null,      // Can be standalone
  mordred: null,
  oberon: null,
};

// ─── Game Phases ──────────────────────────────────────────────────────
const PHASES = {
  LOBBY: 'LOBBY',
  COUNTDOWN: 'COUNTDOWN',
  ROLE_REVEAL: 'ROLE_REVEAL',
  TEAM_PROPOSAL: 'TEAM_PROPOSAL',
  VOTING: 'VOTING',
  QUEST: 'QUEST',
  ASSASSINATION: 'ASSASSINATION',
  GAME_OVER: 'GAME_OVER',
};

module.exports = {
  PLAYER_DISTRIBUTION,
  QUEST_TEAM_SIZES,
  TWO_FAIL_QUEST_INDEX,
  TWO_FAIL_MIN_PLAYERS,
  MAX_REJECTIONS,
  TEAM_GOOD,
  TEAM_EVIL,
  ROLES,
  SPECIAL_ROLES,
  ROLE_DEPENDENCIES,
  PHASES,
};
