import type { Achievement, AchievementWithDate, Match } from '../types';
import { calculateLongestWinStreak } from './calculations';

// Badge definitions
const BADGES: Achievement[] = [
  // Win milestones
  { id: 'first-win', name: 'First Win', description: 'Win your first match', icon: '🎉' },
  { id: 'winner-10', name: 'Winner', description: 'Win 10 matches', icon: '🏆' },
  { id: 'champion-25', name: 'Champion', description: 'Win 25 matches', icon: '👑' },
  { id: 'legend-50', name: 'Legend', description: 'Win 50 matches', icon: '⭐' },

  // Match milestones
  { id: 'debut', name: 'Debut', description: 'Play your first match', icon: '👋' },
  { id: 'regular-10', name: 'Regular', description: 'Play 10 matches', icon: '📅' },
  { id: 'veteran-25', name: 'Veteran', description: 'Play 25 matches', icon: '🎖️' },
  { id: 'centurion-100', name: 'Centurion', description: 'Play 100 matches', icon: '💯' },

  // Goal milestones
  { id: 'off-the-mark', name: 'Off the Mark', description: 'Score your first goal', icon: '⚽' },
  { id: 'scorer-10', name: 'Scorer', description: 'Score 10 goals', icon: '🎯' },
  { id: 'sharpshooter-25', name: 'Sharpshooter', description: 'Score 25 goals', icon: '🔥' },
  { id: 'prolific-50', name: 'Prolific', description: 'Score 50 goals', icon: '💎' },
  { id: 'hatrick', name: 'Hat-trick Hero', description: 'Score 3 goals in one match', icon: '🎩' },

  // Performance badges
  { id: 'hot-streak-5', name: 'Hot Streak', description: 'Win 5 matches in a row', icon: '🔥' },
  { id: 'serial-winner', name: 'Serial Winner', description: '5 wins in a row at any point', icon: '🏅' },
  { id: 'serial-loser', name: 'Serial Loser', description: '5 losses in a row at any point', icon: '😢' },
  { id: 'undefeated', name: 'Undefeated', description: '10+ matches with no losses', icon: '🛡️' },
  { id: 'consistent', name: 'Consistent', description: '70%+ win rate (min 10 matches)', icon: '📊' },

  // Captain badges
  { id: 'leader-5', name: 'Leader', description: 'Be captain 5 times', icon: '©️' },
  { id: 'captain-marvel-15', name: 'Captain Marvel', description: 'Be captain 15 times', icon: '🦸' },

  // Dynamic/current badges (calculated separately)
  { id: 'current-1', name: 'Current #1', description: 'Currently top of the leaderboard', icon: '🥇' },
  { id: 'current-2', name: 'Current #2', description: 'Currently 2nd on the leaderboard', icon: '🥈' },
  { id: 'current-3', name: 'Current #3', description: 'Currently 3rd on the leaderboard', icon: '🥉' },
  { id: 'top-scorer', name: 'Top Scorer', description: 'Current leading goalscorer', icon: '👟' },

  // Monthly awards
  { id: 'potm', name: 'Player of the Month', description: 'Awarded Player of the Month', icon: '🌟' },
  { id: 'dotm', name: 'Dud of the Month', description: 'Awarded Dud of the Month', icon: '🤡' },
];

export interface DynamicBadgeContext {
  leaderboardPosition?: number; // 1, 2, or 3 for top 3
  isTopScorer?: boolean;
  potmCount?: number; // Number of POTM awards
  dotmCount?: number; // Number of DOTM awards
}

export function calculatePlayerAchievements(
  playerId: string,
  stats: { wins: number; losses: number; draws: number; goals: number },
  matches: Match[],
  captainCount: number,
  dynamicContext?: DynamicBadgeContext
): Achievement[] {
  const achievements: Achievement[] = [];
  const totalMatches = stats.wins + stats.losses + stats.draws;
  const winPercentage = totalMatches > 0 ? (stats.wins / totalMatches) * 100 : 0;

  // Win milestones
  if (stats.wins >= 1) achievements.push(BADGES.find((b) => b.id === 'first-win')!);
  if (stats.wins >= 10) achievements.push(BADGES.find((b) => b.id === 'winner-10')!);
  if (stats.wins >= 25) achievements.push(BADGES.find((b) => b.id === 'champion-25')!);
  if (stats.wins >= 50) achievements.push(BADGES.find((b) => b.id === 'legend-50')!);

  // Match milestones
  if (totalMatches >= 1) achievements.push(BADGES.find((b) => b.id === 'debut')!);
  if (totalMatches >= 10) achievements.push(BADGES.find((b) => b.id === 'regular-10')!);
  if (totalMatches >= 25) achievements.push(BADGES.find((b) => b.id === 'veteran-25')!);
  if (totalMatches >= 100) achievements.push(BADGES.find((b) => b.id === 'centurion-100')!);

  // Goal milestones
  if (stats.goals >= 1) achievements.push(BADGES.find((b) => b.id === 'off-the-mark')!);
  if (stats.goals >= 10) achievements.push(BADGES.find((b) => b.id === 'scorer-10')!);
  if (stats.goals >= 25) achievements.push(BADGES.find((b) => b.id === 'sharpshooter-25')!);
  if (stats.goals >= 50) achievements.push(BADGES.find((b) => b.id === 'prolific-50')!);

  // Hat-trick check
  if (hasHatTrick(playerId, matches)) {
    achievements.push(BADGES.find((b) => b.id === 'hatrick')!);
  }

  // Performance badges
  const longestWinStreak = calculateLongestWinStreak(playerId, matches);
  const longestLossStreak = calculateLongestLossStreak(playerId, matches);

  if (longestWinStreak >= 5) {
    achievements.push(BADGES.find((b) => b.id === 'hot-streak-5')!);
    achievements.push(BADGES.find((b) => b.id === 'serial-winner')!);
  }

  if (longestLossStreak >= 5) {
    achievements.push(BADGES.find((b) => b.id === 'serial-loser')!);
  }

  if (totalMatches >= 10 && stats.losses === 0) {
    achievements.push(BADGES.find((b) => b.id === 'undefeated')!);
  }

  if (totalMatches >= 10 && winPercentage >= 70) {
    achievements.push(BADGES.find((b) => b.id === 'consistent')!);
  }

  // Captain badges
  if (captainCount >= 5) achievements.push(BADGES.find((b) => b.id === 'leader-5')!);
  if (captainCount >= 15) achievements.push(BADGES.find((b) => b.id === 'captain-marvel-15')!);

  // Dynamic/current badges
  if (dynamicContext) {
    if (dynamicContext.leaderboardPosition === 1) {
      achievements.push(BADGES.find((b) => b.id === 'current-1')!);
    } else if (dynamicContext.leaderboardPosition === 2) {
      achievements.push(BADGES.find((b) => b.id === 'current-2')!);
    } else if (dynamicContext.leaderboardPosition === 3) {
      achievements.push(BADGES.find((b) => b.id === 'current-3')!);
    }
    if (dynamicContext.isTopScorer) {
      achievements.push(BADGES.find((b) => b.id === 'top-scorer')!);
    }
    if (dynamicContext.potmCount && dynamicContext.potmCount > 0) {
      achievements.push(BADGES.find((b) => b.id === 'potm')!);
    }
    if (dynamicContext.dotmCount && dynamicContext.dotmCount > 0) {
      achievements.push(BADGES.find((b) => b.id === 'dotm')!);
    }
  }

  return achievements.filter(Boolean);
}

/**
 * Check if player has scored a hat-trick in any match
 */
function hasHatTrick(playerId: string, matches: Match[]): boolean {
  return matches.some((match) => {
    if (match.status !== 'completed') return false;
    const inRed = match.redTeam.some((p) => p.id === playerId);
    const inWhite = match.whiteTeam.some((p) => p.id === playerId);
    if (!inRed && !inWhite) return false;

    const scorers = inRed ? match.redScorers : match.whiteScorers;
    const goalsInMatch = scorers.filter((id) => id === playerId).length;
    return goalsInMatch >= 3;
  });
}

/**
 * Calculate longest loss streak for a player
 */
function calculateLongestLossStreak(playerId: string, matches: Match[]): number {
  const sortedMatches = [...matches]
    .filter((m) => m.status === 'completed')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let longestStreak = 0;
  let currentStreak = 0;

  for (const match of sortedMatches) {
    const inRed = match.redTeam.some((p) => p.id === playerId);
    const inWhite = match.whiteTeam.some((p) => p.id === playerId);
    if (!inRed && !inWhite) continue;
    if (match.redScore === null || match.whiteScore === null) continue;

    const myScore = inRed ? match.redScore : match.whiteScore;
    const opponentScore = inRed ? match.whiteScore : match.redScore;

    if (myScore < opponentScore) {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }

  return longestStreak;
}

export function getBadgeById(id: string): Achievement | undefined {
  return BADGES.find((b) => b.id === id);
}

export function getAllBadges(): Achievement[] {
  return [...BADGES];
}

/**
 * Calculate achievement dates by processing matches chronologically
 * Returns achievements with the date they were unlocked
 */
export function calculateAchievementDates(
  playerId: string,
  matches: Match[]
): AchievementWithDate[] {
  const achievementsWithDates: AchievementWithDate[] = [];
  const unlockedIds = new Set<string>();

  // Sort matches by date ascending
  const sortedMatches = [...matches]
    .filter((m) => m.status === 'completed')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Running totals
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let goals = 0;
  let captainCount = 0;
  let currentWinStreak = 0;
  let longestWinStreak = 0;
  let currentLossStreak = 0;
  let longestLossStreak = 0;
  let hasHatTrickAchieved = false;

  const addAchievement = (id: string, date: Date) => {
    if (unlockedIds.has(id)) return;
    const badge = BADGES.find((b) => b.id === id);
    if (badge) {
      achievementsWithDates.push({ ...badge, unlockedAt: date });
      unlockedIds.add(id);
    }
  };

  for (const match of sortedMatches) {
    const inRed = match.redTeam.some((p) => p.id === playerId);
    const inWhite = match.whiteTeam.some((p) => p.id === playerId);
    if (!inRed && !inWhite) continue;

    if (match.redScore === null || match.whiteScore === null) continue;

    const myScore = inRed ? match.redScore : match.whiteScore;
    const opponentScore = inRed ? match.whiteScore : match.redScore;
    const matchDate = new Date(match.date);

    // Check captain status
    const playerInTeam = inRed
      ? match.redTeam.find((p) => p.id === playerId)
      : match.whiteTeam.find((p) => p.id === playerId);
    if (playerInTeam?.isCaptain) {
      captainCount++;
    }

    // Count goals
    const scorers = inRed ? match.redScorers : match.whiteScorers;
    const matchGoals = scorers.filter((id) => id === playerId).length;
    goals += matchGoals;

    // Check for hat-trick
    if (matchGoals >= 3 && !hasHatTrickAchieved) {
      hasHatTrickAchieved = true;
      addAchievement('hatrick', matchDate);
    }

    // Determine result
    if (myScore > opponentScore) {
      wins++;
      currentWinStreak++;
      longestWinStreak = Math.max(longestWinStreak, currentWinStreak);
      currentLossStreak = 0;
    } else if (myScore < opponentScore) {
      losses++;
      currentLossStreak++;
      longestLossStreak = Math.max(longestLossStreak, currentLossStreak);
      currentWinStreak = 0;
    } else {
      draws++;
      currentWinStreak = 0;
      currentLossStreak = 0;
    }

    const totalMatches = wins + losses + draws;
    const winPercentage = totalMatches > 0 ? (wins / totalMatches) * 100 : 0;

    // Check for unlocked achievements after this match

    // Match milestones
    if (totalMatches >= 1) addAchievement('debut', matchDate);
    if (totalMatches >= 10) addAchievement('regular-10', matchDate);
    if (totalMatches >= 25) addAchievement('veteran-25', matchDate);
    if (totalMatches >= 100) addAchievement('centurion-100', matchDate);

    // Win milestones
    if (wins >= 1) addAchievement('first-win', matchDate);
    if (wins >= 10) addAchievement('winner-10', matchDate);
    if (wins >= 25) addAchievement('champion-25', matchDate);
    if (wins >= 50) addAchievement('legend-50', matchDate);

    // Goal milestones
    if (goals >= 1) addAchievement('off-the-mark', matchDate);
    if (goals >= 10) addAchievement('scorer-10', matchDate);
    if (goals >= 25) addAchievement('sharpshooter-25', matchDate);
    if (goals >= 50) addAchievement('prolific-50', matchDate);

    // Streak achievements
    if (longestWinStreak >= 5) {
      addAchievement('hot-streak-5', matchDate);
      addAchievement('serial-winner', matchDate);
    }
    if (longestLossStreak >= 5) addAchievement('serial-loser', matchDate);

    // Undefeated
    if (totalMatches >= 10 && losses === 0) addAchievement('undefeated', matchDate);

    // Consistent
    if (totalMatches >= 10 && winPercentage >= 70) addAchievement('consistent', matchDate);

    // Captain badges
    if (captainCount >= 5) addAchievement('leader-5', matchDate);
    if (captainCount >= 15) addAchievement('captain-marvel-15', matchDate);
  }

  // Sort by date unlocked
  achievementsWithDates.sort((a, b) => new Date(a.unlockedAt).getTime() - new Date(b.unlockedAt).getTime());

  return achievementsWithDates;
}
