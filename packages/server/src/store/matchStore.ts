import type { MatchState } from '@card-clash/engine';

export type MatchEntry = {
  matchId: string;
  status: EntryStatus;
  players: Player[];
  createdAt: number;
  state: MatchState | null;
  rematchAccepted: string[];
};

export type Player = {
  playerId: string;
  token: string;
  nickname: string;
  socketId: string;
};

export type EntryStatus = 'waiting' | 'playing' | 'ended';

const matches = new Map<string, MatchEntry>();

export function createMatchEntry(): MatchEntry {
  const matchId = crypto.randomUUID();
  const entry: MatchEntry = {
    matchId,
    status: 'waiting',
    players: [],
    createdAt: Date.now(),
    state: null,
    rematchAccepted: [],
  };
  matches.set(matchId, entry);
  return entry;
}

export function getMatch(matchId: string): MatchEntry | undefined {
  return matches.get(matchId);
}

export function addPlayer(matchId: string, player: Player): MatchEntry {
  const entry = matches.get(matchId);
  if (!entry) {
    throw new Error('Match not found');
  }
  entry.players.push(player);
  return entry;
}

export function startMatch(matchId: string, state: MatchState): MatchEntry {
  const entry = matches.get(matchId);
  if (!entry) {
    throw new Error('Match not found');
  }
  entry.state = state;
  entry.status = 'playing';
  return entry;
}

export function updateMatchState(
  matchId: string,
  state: MatchState,
): MatchEntry {
  const entry = matches.get(matchId);
  if (!entry) {
    throw new Error('Match not found');
  }
  entry.state = state;
  return entry;
}

export function endMatch(matchId: string, state: MatchState): MatchEntry {
  const entry = matches.get(matchId);
  if (!entry) {
    throw new Error('Match not found');
  }
  entry.state = state;
  entry.status = 'ended';
  return entry;
}

// Linear scan over the Map — fine at this scale; a socketId→matchId index
// would be premature (story 2.6, decision 6c).
export function findMatchBySocketId(socketId: string): MatchEntry | undefined {
  for (const entry of matches.values()) {
    if (entry.players.some((p) => p.socketId === socketId)) {
      return entry;
    }
  }
  return undefined;
}

export function deleteMatch(matchId: string): void {
  matches.delete(matchId);
}

export function acceptRematch(matchId: string, playerId: string): MatchEntry {
  const entry = matches.get(matchId);
  if (!entry) {
    throw new Error('Match not found');
  }
  entry.rematchAccepted.push(playerId);
  return entry;
}
