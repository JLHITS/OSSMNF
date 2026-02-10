import type { Match, Player } from '../types';

export interface MonthlyPlayerStats {
  playerId: string;
  playerName: string;
  photoUrl: string;
  playerOvr: number;
  wins: number;
  losses: number;
  draws: number;
  goals: number;           // Personal goals scored
  teamGoalsFor: number;    // Team goals for (own team's score)
  goalsConceded: number;   // Team goals against (opponent's score)
  matchesPlayed: number;
  winRate: number;
  lossRate: number;
  goalsPerMatch: number;
  goalsConcededPerMatch: number;
  pointsPerGame: number;
}

export interface MonthlyAward {
  playerId: string;
  playerName: string;
  photoUrl: string;
  month: string; // 'YYYY-MM'
  monthLabel: string; // 'January 2025'
  type: 'potm' | 'dotm';
  score: number;
  stats: MonthlyPlayerStats;
}

export interface MonthlyAwardsResult {
  awards: MonthlyAward[];
  latestPotm: MonthlyAward | null;
  latestDotm: MonthlyAward | null;
  potmCounts: Map<string, number>;
  dotmCounts: Map<string, number>;
}

const MIN_MATCHES_FOR_AWARD = 2;
const MIN_PLAYERS_FOR_AWARDS = 3;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getMonthKey(date: Date): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  return `${MONTH_NAMES[parseInt(month) - 1]} ${year}`;
}

/**
 * Calculate monthly stats for all players in a given set of matches.
 * Groups matches by month, then evaluates each player's performance.
 */
function calculateMonthlyStats(
  matches: Match[],
  players: Player[]
): Map<string, MonthlyPlayerStats[]> {
  const monthlyMatches = new Map<string, Match[]>();

  // Group completed matches by month
  matches
    .filter((m) => m.status === 'completed' && m.redScore !== null && m.whiteScore !== null)
    .forEach((match) => {
      const key = getMonthKey(match.date);
      const existing = monthlyMatches.get(key) || [];
      existing.push(match);
      monthlyMatches.set(key, existing);
    });

  const result = new Map<string, MonthlyPlayerStats[]>();

  for (const [monthKey, monthMatches] of monthlyMatches) {
    const playerStatsMap = new Map<string, {
      wins: number; losses: number; draws: number;
      goals: number; teamGoalsFor: number; goalsConceded: number; matchesPlayed: number;
    }>();

    for (const match of monthMatches) {
      const redWon = match.redScore! > match.whiteScore!;
      const whiteWon = match.whiteScore! > match.redScore!;
      const isDraw = match.redScore === match.whiteScore;

      // Process red team
      for (const p of match.redTeam) {
        const s = playerStatsMap.get(p.id) || {
          wins: 0, losses: 0, draws: 0, goals: 0, teamGoalsFor: 0, goalsConceded: 0, matchesPlayed: 0,
        };
        s.matchesPlayed++;
        s.teamGoalsFor += match.redScore!;
        s.goalsConceded += match.whiteScore!;
        if (redWon) s.wins++;
        else if (whiteWon) s.losses++;
        else if (isDraw) s.draws++;
        playerStatsMap.set(p.id, s);
      }

      // Process white team
      for (const p of match.whiteTeam) {
        const s = playerStatsMap.get(p.id) || {
          wins: 0, losses: 0, draws: 0, goals: 0, teamGoalsFor: 0, goalsConceded: 0, matchesPlayed: 0,
        };
        s.matchesPlayed++;
        s.teamGoalsFor += match.whiteScore!;
        s.goalsConceded += match.redScore!;
        if (whiteWon) s.wins++;
        else if (redWon) s.losses++;
        else if (isDraw) s.draws++;
        playerStatsMap.set(p.id, s);
      }

      // Count goals
      for (const playerId of match.redScorers) {
        const s = playerStatsMap.get(playerId);
        if (s) s.goals++;
      }
      for (const playerId of match.whiteScorers) {
        const s = playerStatsMap.get(playerId);
        if (s) s.goals++;
      }
    }

    // Convert to MonthlyPlayerStats array
    const monthStats: MonthlyPlayerStats[] = [];
    for (const [playerId, s] of playerStatsMap) {
      const player = players.find((p) => p.id === playerId);
      if (!player) continue;
      if (s.matchesPlayed < MIN_MATCHES_FOR_AWARD) continue;

      monthStats.push({
        playerId,
        playerName: player.name,
        photoUrl: player.photoUrl,
        playerOvr: player.ovr,
        wins: s.wins,
        losses: s.losses,
        draws: s.draws,
        goals: s.goals,
        teamGoalsFor: s.teamGoalsFor,
        goalsConceded: s.goalsConceded,
        matchesPlayed: s.matchesPlayed,
        winRate: s.wins / s.matchesPlayed,
        lossRate: s.losses / s.matchesPlayed,
        goalsPerMatch: s.goals / s.matchesPlayed,
        goalsConcededPerMatch: s.goalsConceded / s.matchesPlayed,
        pointsPerGame: (s.wins * 3 + s.draws * 1) / s.matchesPlayed,
      });
    }

    if (monthStats.length >= MIN_PLAYERS_FOR_AWARDS) {
      result.set(monthKey, monthStats);
    }
  }

  return result;
}

/**
 * POTM Scoring Algorithm
 *
 * Evaluates player performance relative to peers in the same month.
 * Each metric is normalized against the best performer that month (0-1 scale).
 *
 * Weights:
 *   Win Rate:                30% - Primary measure of success
 *   Goals Per Match:         25% - Offensive contribution (can outweigh wins)
 *   Goals Conceded/Match:   15% - Defensive solidity (inverted - fewer = better)
 *   Points Per Game:         15% - Overall consistency (W=3, D=1, L=0)
 *   Activity:                15% - Playing more matches gives slight edge
 *
 * OVR Surprise Factor:
 *   Lower-rated players who perform well get a boost.
 *   A player 2 OVR below average gets ~10% bonus.
 *   A player 2 OVR above average gets ~10% penalty.
 *   This rewards underdogs without being too extreme.
 */
function calculatePotmScore(
  player: MonthlyPlayerStats,
  allStats: MonthlyPlayerStats[]
): number {
  const maxWinRate = Math.max(...allStats.map((s) => s.winRate), 0.01);
  const maxGoalsPM = Math.max(...allStats.map((s) => s.goalsPerMatch), 0.01);
  const maxPPG = Math.max(...allStats.map((s) => s.pointsPerGame), 0.01);
  const maxMatches = Math.max(...allStats.map((s) => s.matchesPlayed), 1);
  const minConcededPM = Math.min(...allStats.map((s) => s.goalsConcededPerMatch));
  const maxConcededPM = Math.max(...allStats.map((s) => s.goalsConcededPerMatch), 0.01);
  const avgOvr = allStats.reduce((sum, s) => sum + s.playerOvr, 0) / allStats.length;

  const normWinRate = player.winRate / maxWinRate;
  const normGoals = player.goalsPerMatch / maxGoalsPM;
  const normPPG = player.pointsPerGame / maxPPG;
  const activity = player.matchesPlayed / maxMatches;
  // Inverted: fewer goals conceded = higher score (1.0 = best, 0.0 = worst)
  const concededRange = maxConcededPM - minConcededPM;
  const normDefence = concededRange > 0
    ? 1 - (player.goalsConcededPerMatch - minConcededPM) / concededRange
    : 1;

  const ovrSurprise = 1 + ((avgOvr - player.playerOvr) / 10) * 0.5;

  const rawScore =
    normWinRate * 0.30 +
    normGoals * 0.25 +
    normDefence * 0.15 +
    normPPG * 0.15 +
    activity * 0.15;

  return rawScore * ovrSurprise;
}

/**
 * DOTM (Dud of the Month) Scoring Algorithm
 *
 * Evaluates poor performance relative to peers in the same month.
 * Higher score = worse performance = more likely to "win" the award.
 *
 * Weights:
 *   Loss Rate:              25% - Primary measure of failure
 *   Goals Conceded/Match:   25% - Defensive liability
 *   Goals Scored/Match:     15% - Lack of offensive contribution (inverted - fewer = worse)
 *   Demerit Points/Game:    20% - Inverse of PPG (L=3, D=1, W=0)
 *   Activity:               15% - Must have played enough to earn it
 *
 * OVR Shame Factor:
 *   Higher-rated players performing badly are more "dud-like"
 *   because more is expected of them. Inverse of POTM surprise.
 */
function calculateDotmScore(
  player: MonthlyPlayerStats,
  allStats: MonthlyPlayerStats[]
): number {
  const maxLossRate = Math.max(...allStats.map((s) => s.lossRate), 0.01);
  const maxConcededPM = Math.max(...allStats.map((s) => s.goalsConcededPerMatch), 0.01);
  const maxGoalsPM = Math.max(...allStats.map((s) => s.goalsPerMatch), 0.01);
  const maxMatches = Math.max(...allStats.map((s) => s.matchesPlayed), 1);
  const avgOvr = allStats.reduce((sum, s) => sum + s.playerOvr, 0) / allStats.length;

  // Demerit points: losses are heavily penalized
  const demeritPPG = (player.losses * 3 + player.draws * 1) / player.matchesPlayed;
  const maxDemeritPPG = Math.max(
    ...allStats.map((s) => (s.losses * 3 + s.draws * 1) / s.matchesPlayed),
    0.01
  );

  const normLossRate = player.lossRate / maxLossRate;
  const normConceded = player.goalsConcededPerMatch / maxConcededPM;
  const normDemerit = demeritPPG / maxDemeritPPG;
  const activity = player.matchesPlayed / maxMatches;
  // Inverted: fewer goals scored = higher dud score (1.0 = worst attacker, 0.0 = best)
  const normLackOfGoals = maxGoalsPM > 0
    ? 1 - (player.goalsPerMatch / maxGoalsPM)
    : 0;

  const ovrShame = 1 + ((player.playerOvr - avgOvr) / 10) * 0.5;

  const rawScore =
    normLossRate * 0.25 +
    normConceded * 0.25 +
    normLackOfGoals * 0.15 +
    normDemerit * 0.20 +
    activity * 0.15;

  return rawScore * ovrShame;
}

/**
 * Get the current month key (YYYY-MM) to exclude incomplete months.
 */
function getCurrentMonthKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Calculate all monthly awards across all completed months.
 * Only completed months are eligible (current month is excluded).
 * No player can win the same award in consecutive months.
 * Returns the full award history plus the latest POTM and DOTM.
 */
export function calculateMonthlyAwards(
  players: Player[],
  matches: Match[]
): MonthlyAwardsResult {
  const monthlyStats = calculateMonthlyStats(matches, players);
  const awards: MonthlyAward[] = [];
  const potmCounts = new Map<string, number>();
  const dotmCounts = new Map<string, number>();
  const currentMonthKey = getCurrentMonthKey();

  // Sort months chronologically, exclude current (incomplete) month
  const sortedMonths = Array.from(monthlyStats.keys())
    .filter((key) => key < currentMonthKey)
    .sort();

  // Track previous month's winners to prevent back-to-back
  let previousPotmId: string | null = null;
  let previousDotmId: string | null = null;

  for (const monthKey of sortedMonths) {
    const stats = monthlyStats.get(monthKey)!;

    // Calculate POTM - skip previous month's winner
    let bestPotm: { player: MonthlyPlayerStats; score: number } | null = null;
    for (const playerStats of stats) {
      if (playerStats.playerId === previousPotmId) continue;
      const score = calculatePotmScore(playerStats, stats);
      if (!bestPotm || score > bestPotm.score) {
        bestPotm = { player: playerStats, score };
      }
    }

    // Calculate DOTM - skip previous month's winner, only if someone has losses
    let bestDotm: { player: MonthlyPlayerStats; score: number } | null = null;
    const hasAnyLosses = stats.some((s) => s.losses > 0 && s.playerId !== previousDotmId);
    if (hasAnyLosses) {
      for (const playerStats of stats) {
        if (playerStats.playerId === previousDotmId) continue;
        if (playerStats.losses === 0) continue;
        const score = calculateDotmScore(playerStats, stats);
        if (!bestDotm || score > bestDotm.score) {
          bestDotm = { player: playerStats, score };
        }
      }
    }

    if (bestPotm) {
      const award: MonthlyAward = {
        playerId: bestPotm.player.playerId,
        playerName: bestPotm.player.playerName,
        photoUrl: bestPotm.player.photoUrl,
        month: monthKey,
        monthLabel: getMonthLabel(monthKey),
        type: 'potm',
        score: bestPotm.score,
        stats: bestPotm.player,
      };
      awards.push(award);
      potmCounts.set(award.playerId, (potmCounts.get(award.playerId) || 0) + 1);
      previousPotmId = award.playerId;
    } else {
      previousPotmId = null;
    }

    if (bestDotm) {
      const award: MonthlyAward = {
        playerId: bestDotm.player.playerId,
        playerName: bestDotm.player.playerName,
        photoUrl: bestDotm.player.photoUrl,
        month: monthKey,
        monthLabel: getMonthLabel(monthKey),
        type: 'dotm',
        score: bestDotm.score,
        stats: bestDotm.player,
      };
      awards.push(award);
      dotmCounts.set(award.playerId, (dotmCounts.get(award.playerId) || 0) + 1);
      previousDotmId = award.playerId;
    } else {
      previousDotmId = null;
    }
  }

  // Find latest awards (from completed months only)
  const potmAwards = awards.filter((a) => a.type === 'potm');
  const dotmAwards = awards.filter((a) => a.type === 'dotm');
  const latestPotm = potmAwards.length > 0 ? potmAwards[potmAwards.length - 1] : null;
  const latestDotm = dotmAwards.length > 0 ? dotmAwards[dotmAwards.length - 1] : null;

  return { awards, latestPotm, latestDotm, potmCounts, dotmCounts };
}
