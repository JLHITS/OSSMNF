import type { Achievement, Match } from '../types';
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

  // Performance badges
  { id: 'hot-streak-5', name: 'Hot Streak', description: 'Win 5 matches in a row', icon: '🔥' },
  { id: 'undefeated', name: 'Undefeated', description: '10+ matches with no losses', icon: '🛡️' },
  { id: 'consistent', name: 'Consistent', description: '70%+ win rate (min 10 matches)', icon: '📊' },

  // Captain badges
  { id: 'leader-5', name: 'Leader', description: 'Be captain 5 times', icon: '©️' },
  { id: 'captain-marvel-15', name: 'Captain Marvel', description: 'Be captain 15 times', icon: '🦸' },
];

export function calculatePlayerAchievements(
  playerId: string,
  stats: { wins: number; losses: number; draws: number; goals: number },
  matches: Match[],
  captainCount: number
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

  // Performance badges
  const longestStreak = calculateLongestWinStreak(playerId, matches);
  if (longestStreak >= 5) achievements.push(BADGES.find((b) => b.id === 'hot-streak-5')!);

  if (totalMatches >= 10 && stats.losses === 0) {
    achievements.push(BADGES.find((b) => b.id === 'undefeated')!);
  }

  if (totalMatches >= 10 && winPercentage >= 70) {
    achievements.push(BADGES.find((b) => b.id === 'consistent')!);
  }

  // Captain badges
  if (captainCount >= 5) achievements.push(BADGES.find((b) => b.id === 'leader-5')!);
  if (captainCount >= 15) achievements.push(BADGES.find((b) => b.id === 'captain-marvel-15')!);

  return achievements.filter(Boolean);
}

export function getBadgeById(id: string): Achievement | undefined {
  return BADGES.find((b) => b.id === id);
}

export function getAllBadges(): Achievement[] {
  return [...BADGES];
}
