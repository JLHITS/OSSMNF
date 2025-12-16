import { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { calculatePlayerStats } from '../services/firebase';
import { getCloudflareImageUrl } from '../services/cloudflare';
import type { PlayerStats } from '../types';
import placeholder from '../assets/placeholder.png';

export function Stats() {
  const { players, matches } = useData();

  const playerStats: PlayerStats[] = useMemo(() => {
    const statsMap = calculatePlayerStats(players, matches);

    return players
      .map((player) => {
        const stats = statsMap.get(player.id) || { wins: 0, losses: 0, draws: 0, goals: 0 };
        const totalMatches = stats.wins + stats.losses + stats.draws;
        const winPercentage = totalMatches > 0
          ? Math.round((stats.wins / totalMatches) * 100)
          : 0;

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
        };
      })
      .filter((stat) => stat.totalMatches > 0)
      .sort((a, b) => {
        // Sort by win percentage, then by total matches
        if (b.winPercentage !== a.winPercentage) {
          return b.winPercentage - a.winPercentage;
        }
        return b.totalMatches - a.totalMatches;
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
                          src={stat.photoUrl ? getCloudflareImageUrl(stat.photoUrl) : placeholder}
                          alt={stat.playerName}
                          className="stats-photo"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = placeholder;
                          }}
                        />
                        <span className="player-name">{stat.playerName}</span>
                      </div>
                    </td>
                    <td className="stat-col wins">{stat.wins}</td>
                    <td className="stat-col losses">{stat.losses}</td>
                    <td className="stat-col draws">{stat.draws}</td>
                    <td className="stat-col">{stat.totalMatches}</td>
                    <td className={`stat-col win-rate-col ${getWinRateColor(stat.winPercentage)}`}>
                      {stat.winPercentage}%
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
