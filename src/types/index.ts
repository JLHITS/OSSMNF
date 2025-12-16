export type Position = 'DEF' | 'ATT' | 'ALR';

export interface Player {
  id: string;
  name: string;
  photoUrl: string;
  fitness: number; // 1-10
  defence: number; // 1-10
  attack: number; // 1-10
  ballUse: number; // 1-10
  position: Position;
  ovr: number; // calculated
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamPlayer extends Player {
  isCaptain: boolean;
}

export interface Team {
  players: TeamPlayer[];
  totalOvr: number;
  color: 'red' | 'white';
}

export interface Match {
  id: string;
  date: Date;
  redTeam: TeamPlayer[];
  whiteTeam: TeamPlayer[];
  redTeamOvr: number;
  whiteTeamOvr: number;
  redScore: number | null;
  whiteScore: number | null;
  redScorers: string[]; // player IDs
  whiteScorers: string[]; // player IDs
  matchSize: MatchSize;
  status: 'pending' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

export type MatchSize = '5v5' | '6v6' | '7v7' | '8v8' | '9v9';

export interface PlayerStats {
  playerId: string;
  playerName: string;
  photoUrl: string;
  wins: number;
  losses: number;
  draws: number;
  totalMatches: number;
  winPercentage: number;
  goals: number;
}

export interface AppState {
  isAuthenticated: boolean;
  players: Player[];
  matches: Match[];
}
