import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { calculatePlayerStats } from '../services/firebase';
import { calculatePlayerForm } from '../utils/calculations';
import { calculatePlayerAchievements, type DynamicBadgeContext } from '../utils/achievements';
import { calculateMonthlyAwards, type MonthlyAward } from '../utils/monthlyAwards';
import { getCloudinaryImageUrl } from '../services/cloudinary';
import { createPlayerSlug } from './PlayerProfile';
import type { PlayerStats, Achievement } from '../types';
import placeholder from '../assets/placeholder.png';

interface ExtendedPlayerStats extends PlayerStats {
  achievements: Achievement[];
}

export function Stats() {
  const { players, matches } = useData();

  // Calculate monthly awards
  const monthlyAwardsResult = useMemo(() => {
    return calculateMonthlyAwards(players, matches);
  }, [players, matches]);

  const playerStats: ExtendedPlayerStats[] = useMemo(() => {
    const statsMap = calculatePlayerStats(players, matches);

    // First pass: calculate base stats without achievements
    const baseStats = players
      .map((player) => {
        const stats = statsMap.get(player.id) || { wins: 0, losses: 0, draws: 0, goals: 0 };
        const totalMatches = stats.wins + stats.losses + stats.draws;
        const winPercentage = totalMatches > 0
          ? Math.round((stats.wins / totalMatches) * 100)
          : 0;

        // Calculate form and streak
        const { form, streak, captainCount } = calculatePlayerForm(player.id, matches);

        return {
          playerId: player.id,
          playerName: player.name,
          photoUrl: player.photoUrl,
          wins: stats.wins,
          losses: stats.losses,
          draws: stats.draws,
          totalMatches,
          winPercentage,
          goals: stats.goals,
          form,
          currentStreak: streak,
          captainCount,
          stats, // Keep for achievement calculation
        };
      })
      .filter((stat) => stat.totalMatches > 0)
      .sort((a, b) => {
        // Sort by: 1) Wins, 2) Win %, 3) Games played, 4) Goals
        if (b.wins !== a.wins) {
          return b.wins - a.wins;
        }
        if (b.winPercentage !== a.winPercentage) {
          return b.winPercentage - a.winPercentage;
        }
        if (b.totalMatches !== a.totalMatches) {
          return b.totalMatches - a.totalMatches;
        }
        return b.goals - a.goals;
      });

    // Find top scorer
    const topScorerGoals = Math.max(...baseStats.map(s => s.goals), 0);
    const topScorerId = baseStats.find(s => s.goals === topScorerGoals && s.goals > 0)?.playerId;

    // Second pass: add achievements with dynamic context (including monthly awards)
    return baseStats.map((stat, index) => {
      const dynamicContext: DynamicBadgeContext = {
        leaderboardPosition: index < 3 ? (index + 1) as 1 | 2 | 3 : undefined,
        isTopScorer: stat.playerId === topScorerId && topScorerGoals > 0,
        potmCount: monthlyAwardsResult.potmCounts.get(stat.playerId) || 0,
        dotmCount: monthlyAwardsResult.dotmCounts.get(stat.playerId) || 0,
      };

      const achievements = calculatePlayerAchievements(
        stat.playerId,
        stat.stats,
        matches,
        stat.captainCount,
        dynamicContext
      );

      // Remove the stats property before returning
      const { stats: _, ...statWithoutStats } = stat;
      return {
        ...statWithoutStats,
        achievements,
      };
    });
  }, [players, matches, monthlyAwardsResult]);

  const getRankBadge = (index: number) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `#${index + 1}`;
  };

  const getWinRateColor = (winPercentage: number) => {
    if (winPercentage >= 60) return 'win-rate-high';
    if (winPercentage >= 40) return 'win-rate-medium';
    return 'win-rate-low';
  };

  const getFormIndicator = (result: 'W' | 'L' | 'D') => {
    switch (result) {
      case 'W':
        return <span className="form-indicator form-win">W</span>;
      case 'L':
        return <span className="form-indicator form-loss">L</span>;
      case 'D':
        return <span className="form-indicator form-draw">D</span>;
    }
  };

  const getStreakDisplay = (streak: { type: 'W' | 'L' | 'D' | 'none'; count: number }) => {
    if (streak.type === 'none' || streak.count < 2) return null;

    if (streak.type === 'W' && streak.count >= 3) {
      return <span className="streak-badge streak-hot" title={`${streak.count} wins in a row`}>🔥{streak.count}</span>;
    }
    if (streak.type === 'L' && streak.count >= 3) {
      return <span className="streak-badge streak-cold" title={`${streak.count} losses in a row`}>❄️{streak.count}</span>;
    }
    return null;
  };

  const renderAwardCard = (award: MonthlyAward, type: 'potm' | 'dotm') => {
    const isPotm = type === 'potm';
    const totalCount = isPotm
      ? monthlyAwardsResult.potmCounts.get(award.playerId) || 1
      : monthlyAwardsResult.dotmCounts.get(award.playerId) || 1;

    return (
      <div className={`award-card ${isPotm ? 'award-card-potm' : 'award-card-dotm'}`}>
        <div className="award-card-header">
          <span className="award-card-icon">{isPotm ? '🌟' : '🤡'}</span>
          <span className="award-card-title">
            {isPotm ? 'Player of the Month' : 'Dud of the Month'}
          </span>
        </div>
        <div className="award-card-body">
          <Link to={`/player/${createPlayerSlug(award.playerName)}`} className="award-card-link">
            <img
              src={award.photoUrl ? getCloudinaryImageUrl(award.photoUrl) : placeholder}
              alt={award.playerName}
              className="award-card-photo"
              onError={(e) => {
                (e.target as HTMLImageElement).src = placeholder;
              }}
            />
          </Link>
          <div className="award-card-info">
            <Link
              to={`/player/${createPlayerSlug(award.playerName)}`}
              className="award-card-name"
            >
              {award.playerName}
            </Link>
            <span className="award-card-month">{award.monthLabel}</span>
            <div className="award-card-stats">
              {isPotm ? (
                <>
                  <span className="award-stat award-stat-good">{award.stats.wins}W</span>
                  <span className="award-stat">{award.stats.draws}D</span>
                  <span className="award-stat">{award.stats.losses}L</span>
                  <span className="award-stat award-stat-good">{award.stats.goals} goals</span>
                </>
              ) : (
                <>
                  <span className="award-stat award-stat-bad">{award.stats.losses}L</span>
                  <span className="award-stat">{award.stats.draws}D</span>
                  <span className="award-stat">{award.stats.wins}W</span>
                  <span className="award-stat award-stat-bad">{award.stats.goalsConceded} conceded</span>
                </>
              )}
            </div>
            {totalCount > 1 && (
              <span className="award-card-count">
                {isPotm ? '🌟' : '🤡'} x{totalCount} all time
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="stats-page">
      <h1>Player Statistics</h1>

      {playerStats.length === 0 ? (
        <p className="no-stats-message">
          No statistics yet. Complete some matches to see player stats.
        </p>
      ) : (
        <>
          <div className="stats-summary">
            <p>
              Showing stats for {playerStats.length} player{playerStats.length !== 1 ? 's' : ''} from{' '}
              {matches.filter((m) => m.status === 'completed').length} completed match
              {matches.filter((m) => m.status === 'completed').length !== 1 ? 'es' : ''}
            </p>
          </div>

          {(monthlyAwardsResult.latestPotm || monthlyAwardsResult.latestDotm) && (
            <div className="monthly-awards-showcase">
              {monthlyAwardsResult.latestPotm && renderAwardCard(monthlyAwardsResult.latestPotm, 'potm')}
              {monthlyAwardsResult.latestDotm && renderAwardCard(monthlyAwardsResult.latestDotm, 'dotm')}
            </div>
          )}

          <div className="stats-table-container">
            <table className="stats-table">
              <thead>
                <tr>
                  <th className="rank-col">Rank</th>
                  <th className="player-col">Player</th>
                  <th className="stat-col">W</th>
                  <th className="stat-col">L</th>
                  <th className="stat-col">D</th>
                  <th className="stat-col">Played</th>
                  <th className="stat-col win-rate-col">Win %</th>
                  <th className="form-col">Form</th>
                  <th className="stat-col goals-col">Goals*</th>
                </tr>
              </thead>
              <tbody>
                {playerStats.map((stat, index) => (
                  <tr key={stat.playerId} className={index < 3 ? 'top-three' : ''}>
                    <td className="rank-col">{getRankBadge(index)}</td>
                    <td className="player-col">
                      <div className="player-info">
                        <img
                          src={stat.photoUrl ? getCloudinaryImageUrl(stat.photoUrl) : placeholder}
                          alt={stat.playerName}
                          className="stats-photo"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = placeholder;
                          }}
                        />
                        <div className="player-name-badges">
                          <Link
                            to={`/player/${createPlayerSlug(stat.playerName)}`}
                            className="player-name player-name-link"
                          >
                            {stat.playerName}
                          </Link>
                          {stat.achievements.length > 0 && (
                            <div className="badges-row">
                              {stat.achievements.slice(0, 5).map((badge) => (
                                <span
                                  key={badge.id}
                                  className="achievement-badge"
                                  title={`${badge.name}: ${badge.description}`}
                                >
                                  {badge.icon}
                                </span>
                              ))}
                              {stat.achievements.length > 5 && (
                                <span className="more-badges" title={stat.achievements.slice(5).map(b => b.name).join(', ')}>
                                  +{stat.achievements.length - 5}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="stat-col wins">{stat.wins}</td>
                    <td className="stat-col losses">{stat.losses}</td>
                    <td className="stat-col draws">{stat.draws}</td>
                    <td className="stat-col">{stat.totalMatches}</td>
                    <td className={`stat-col win-rate-col ${getWinRateColor(stat.winPercentage)}`}>
                      {stat.winPercentage}%
                    </td>
                    <td className="form-col">
                      <div className="form-display">
                        {stat.form.length > 0 ? (
                          <>
                            {stat.form.map((result, i) => (
                              <span key={i}>{getFormIndicator(result)}</span>
                            ))}
                            {getStreakDisplay(stat.currentStreak)}
                          </>
                        ) : (
                          <span className="no-form">-</span>
                        )}
                      </div>
                    </td>
                    <td className="stat-col goals-col">{stat.goals}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="stats-disclaimer">
            * Goals may be inaccurate as they are optionally recorded
          </p>
        </>
      )}
    </div>
  );
}
