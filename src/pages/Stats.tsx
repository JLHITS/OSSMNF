import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { calculatePlayerStats } from '../services/firebase';
import { calculatePlayerForm } from '../utils/calculations';
import { calculatePlayerAchievements } from '../utils/achievements';
import { getCloudinaryImageUrl } from '../services/cloudinary';
import { createPlayerSlug } from './PlayerProfile';
import type { PlayerStats, Achievement } from '../types';
import placeholder from '../assets/placeholder.png';

interface ExtendedPlayerStats extends PlayerStats {
  achievements: Achievement[];
}

export function Stats() {
  const { players, matches } = useData();

  const playerStats: ExtendedPlayerStats[] = useMemo(() => {
    const statsMap = calculatePlayerStats(players, matches);

    return players
      .map((player) => {
        const stats = statsMap.get(player.id) || { wins: 0, losses: 0, draws: 0, goals: 0 };
        const totalMatches = stats.wins + stats.losses + stats.draws;
        const winPercentage = totalMatches > 0
          ? Math.round((stats.wins / totalMatches) * 100)
          : 0;

        // Calculate form and streak
        const { form, streak, captainCount } = calculatePlayerForm(player.id, matches);

        // Calculate achievements
        const achievements = calculatePlayerAchievements(player.id, stats, matches, captainCount);

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
          achievements,
        };
      })
      .filter((stat) => stat.totalMatches > 0)
      .sort((a, b) => {
        // Sort by: 1) Win %, 2) Wins, 3) Games played, 4) Goals
        if (b.winPercentage !== a.winPercentage) {
          return b.winPercentage - a.winPercentage;
        }
        if (b.wins !== a.wins) {
          return b.wins - a.wins;
        }
        if (b.totalMatches !== a.totalMatches) {
          return b.totalMatches - a.totalMatches;
        }
        return b.goals - a.goals;
      });
  }, [players, matches]);

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
