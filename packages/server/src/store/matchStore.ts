export type MatchEntry = {
  matchId: string;
  status: EntryStatus;
  players: Player[];
  createdAt: number;
};

export type Player = {
  playerId: string;
  token: string;
  nickname: string;
  socketId: string;
};

export type EntryStatus = 'waiting' | 'playing' | 'ended';

const matches = new Map<string, MatchEntry>();

export function createMatch(): MatchEntry {
  const matchId = crypto.randomUUID();
  const entry: MatchEntry = {
    matchId,
    status: 'waiting',
    players: [],
    createdAt: Date.now(),
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
