import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { calculatePlayerStats } from '../services/firebase';
import {
  calculatePlayerForm,
  calculateOpponentRecords,
  calculateTeammateRecords,
  findBiggestResults,
  calculateTeamColorRecord,
} from '../utils/calculations';
import { calculateAchievementDates } from '../utils/achievements';
import { getCloudinaryImageUrl } from '../services/cloudinary';
import type { Match, Player } from '../types';
import placeholder from '../assets/placeholder.png';

// Helper to create URL slug from player name
export function createPlayerSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
}

// Helper to find player by slug
function findPlayerBySlug(players: Player[], slug: string): Player | undefined {
  return players.find((p) => createPlayerSlug(p.name) === slug.toLowerCase());
}

// Format date for display
function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// Format short date
function formatShortDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

export function PlayerProfile() {
  const { playerSlug } = useParams<{ playerSlug: string }>();
  const { players, matches, loading } = useData();
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

  const player = useMemo(() => {
    if (!playerSlug) return undefined;
    return findPlayerBySlug(players, playerSlug);
  }, [players, playerSlug]);

  // Calculate all stats for this player
  const profileData = useMemo(() => {
    if (!player) return null;

    const statsMap = calculatePlayerStats(players, matches);
    const stats = statsMap.get(player.id) || { wins: 0, losses: 0, draws: 0, goals: 0 };
    const totalMatches = stats.wins + stats.losses + stats.draws;
    const winPercentage = totalMatches > 0 ? Math.round((stats.wins / totalMatches) * 100) : 0;

    const { form, streak, captainCount } = calculatePlayerForm(player.id, matches);
    const opponentRecords = calculateOpponentRecords(player.id, matches, players);
    const teammateRecords = calculateTeammateRecords(player.id, matches, players);
    const { biggestWin, biggestLoss } = findBiggestResults(player.id, matches);
    const teamColorRecord = calculateTeamColorRecord(player.id, matches);
    const achievementsWithDates = calculateAchievementDates(player.id, matches);

    // Find nemesis (opponent they lose to most, must have at least 1 loss against them)
    const nemesis = opponentRecords
      .filter((r) => r.lossesAgainst >= 1)
      .sort((a, b) => b.lossesAgainst - a.lossesAgainst || b.totalMatches - a.totalMatches)[0] || null;

    // Find victim (opponent they beat most, must have at least 1 win against them)
    const victim = opponentRecords
      .filter((r) => r.winsAgainst >= 1)
      .sort((a, b) => b.winsAgainst - a.winsAgainst || b.totalMatches - a.totalMatches)[0] || null;

    // Find best teammate (highest win% with, min 1 match together)
    const bestTeammate = teammateRecords
      .filter((r) => r.totalMatches >= 1)
      .sort((a, b) => b.winPercentage - a.winPercentage || b.totalMatches - a.totalMatches)[0] || null;

    // Get player's matches for history
    const playerMatches = matches
      .filter((match) => {
        const inRed = match.redTeam.some((p) => p.id === player.id);
        const inWhite = match.whiteTeam.some((p) => p.id === player.id);
        return inRed || inWhite;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Goals per game
    const goalsPerGame = totalMatches > 0 ? (stats.goals / totalMatches).toFixed(2) : '0.00';

    return {
      stats,
      totalMatches,
      winPercentage,
      form,
      streak,
      captainCount,
      nemesis,
      victim,
      bestTeammate,
      biggestWin,
      biggestLoss,
      teamColorRecord,
      achievementsWithDates,
      playerMatches,
      goalsPerGame,
    };
  }, [player, players, matches]);

  // Get match result for this player
  const getMatchResult = (match: Match): 'W' | 'L' | 'D' | null => {
    if (!player || match.redScore === null || match.whiteScore === null) return null;
    const inRed = match.redTeam.some((p) => p.id === player.id);
    const myScore = inRed ? match.redScore : match.whiteScore;
    const opponentScore = inRed ? match.whiteScore : match.redScore;
    if (myScore > opponentScore) return 'W';
    if (myScore < opponentScore) return 'L';
    return 'D';
  };

  // Get goals scored in a match
  const getMatchGoals = (match: Match): number => {
    if (!player) return 0;
    const inRed = match.redTeam.some((p) => p.id === player.id);
    const scorers = inRed ? match.redScorers : match.whiteScorers;
    return scorers.filter((id) => id === player.id).length;
  };

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-loading">Loading player profile...</div>
      </div>
    );
  }

  if (!player || !profileData) {
    return (
      <div className="profile-page">
        <div className="profile-not-found">
          <h1>Player Not Found</h1>
          <p>The player "{playerSlug}" could not be found.</p>
          <Link to="/login" className="back-link">Go to Login</Link>
        </div>
      </div>
    );
  }

  const {
    stats,
    totalMatches,
    winPercentage,
    form,
    streak,
    captainCount,
    nemesis,
    victim,
    bestTeammate,
    biggestWin,
    biggestLoss,
    teamColorRecord,
    achievementsWithDates,
    playerMatches,
    goalsPerGame,
  } = profileData;

  return (
    <div className="profile-page">
      {/* Header */}
      <div className="profile-header">
        <img
          src={player.photoUrl ? getCloudinaryImageUrl(player.photoUrl) : placeholder}
          alt={player.name}
          className="profile-photo-large"
          onError={(e) => {
            (e.target as HTMLImageElement).src = placeholder;
          }}
        />
        <div className="profile-header-info">
          <h1 className="profile-name">{player.name}</h1>
          {captainCount > 0 && (
            <div className="profile-badges">
              <span className="captain-count-badge" title={`Captain ${captainCount} times`}>
                Captain x{captainCount}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="profile-section">
        <h2>Statistics</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{totalMatches}</div>
            <div className="stat-label">Played</div>
          </div>
          <div className="stat-card stat-wins">
            <div className="stat-value">{stats.wins}</div>
            <div className="stat-label">Won</div>
          </div>
          <div className="stat-card stat-losses">
            <div className="stat-value">{stats.losses}</div>
            <div className="stat-label">Lost</div>
          </div>
          <div className="stat-card stat-draws">
            <div className="stat-value">{stats.draws}</div>
            <div className="stat-label">Drawn</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.goals}</div>
            <div className="stat-label">Goals</div>
          </div>
          <div className={`stat-card ${winPercentage >= 50 ? 'stat-wins' : 'stat-losses'}`}>
            <div className="stat-value">{winPercentage}%</div>
            <div className="stat-label">Win Rate</div>
          </div>
        </div>
      </div>

      {/* Form */}
      {form.length > 0 && (
        <div className="profile-section">
          <h2>Recent Form</h2>
          <div className="profile-form-display">
            {form.map((result, i) => (
              <span
                key={i}
                className={`form-block form-${result.toLowerCase()}`}
              >
                {result}
              </span>
            ))}
            {streak.type !== 'none' && streak.count >= 2 && (
              <span className={`streak-indicator streak-${streak.type === 'W' ? 'hot' : streak.type === 'L' ? 'cold' : 'neutral'}`}>
                {streak.type === 'W' && '🔥'}
                {streak.type === 'L' && '❄️'}
                {streak.count} in a row
              </span>
            )}
          </div>
        </div>
      )}

      {/* Rivalries */}
      {(nemesis || victim || bestTeammate) && (
        <div className="profile-section">
          <h2>Rivalries & Partnerships</h2>
          <div className="rivalry-grid">
            {nemesis && (
              <Link to={`/player/${createPlayerSlug(nemesis.opponentName)}`} className="rivalry-card nemesis-card">
                <div className="rivalry-label">Nemesis</div>
                <img
                  src={nemesis.opponentPhotoUrl ? getCloudinaryImageUrl(nemesis.opponentPhotoUrl) : placeholder}
                  alt={nemesis.opponentName}
                  className="rivalry-photo"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = placeholder;
                  }}
                />
                <div className="rivalry-name">{nemesis.opponentName}</div>
                <div className="rivalry-record">
                  {nemesis.lossesAgainst}L - {nemesis.winsAgainst}W
                </div>
              </Link>
            )}
            {victim && (
              <Link to={`/player/${createPlayerSlug(victim.opponentName)}`} className="rivalry-card victim-card">
                <div className="rivalry-label">Victim</div>
                <img
                  src={victim.opponentPhotoUrl ? getCloudinaryImageUrl(victim.opponentPhotoUrl) : placeholder}
                  alt={victim.opponentName}
                  className="rivalry-photo"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = placeholder;
                  }}
                />
                <div className="rivalry-name">{victim.opponentName}</div>
                <div className="rivalry-record">
                  {victim.winsAgainst}W - {victim.lossesAgainst}L
                </div>
              </Link>
            )}
            {bestTeammate && (
              <Link to={`/player/${createPlayerSlug(bestTeammate.teammateName)}`} className="rivalry-card teammate-card">
                <div className="rivalry-label">Best Teammate</div>
                <img
                  src={bestTeammate.teammatePhotoUrl ? getCloudinaryImageUrl(bestTeammate.teammatePhotoUrl) : placeholder}
                  alt={bestTeammate.teammateName}
                  className="rivalry-photo"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = placeholder;
                  }}
                />
                <div className="rivalry-name">{bestTeammate.teammateName}</div>
                <div className="rivalry-record">
                  {bestTeammate.winPercentage}% win rate ({bestTeammate.totalMatches} games)
                </div>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Extra Stats */}
      <div className="profile-section">
        <h2>More Stats</h2>
        <div className="extra-stats-grid">
          <div className="extra-stat">
            <span className="extra-stat-label">Goals per Game</span>
            <span className="extra-stat-value">{goalsPerGame}</span>
          </div>
          <div className="extra-stat">
            <span className="extra-stat-label">Red Team Record</span>
            <span className="extra-stat-value">
              {teamColorRecord.redWins}W-{teamColorRecord.redLosses}L-{teamColorRecord.redDraws}D
            </span>
          </div>
          <div className="extra-stat">
            <span className="extra-stat-label">White Team Record</span>
            <span className="extra-stat-value">
              {teamColorRecord.whiteWins}W-{teamColorRecord.whiteLosses}L-{teamColorRecord.whiteDraws}D
            </span>
          </div>
          {biggestWin && (
            <div className="extra-stat">
              <span className="extra-stat-label">Biggest Win</span>
              <span className="extra-stat-value extra-stat-positive">
                {biggestWin.myScore}-{biggestWin.opponentScore} (+{biggestWin.margin})
              </span>
            </div>
          )}
          {biggestLoss && (
            <div className="extra-stat">
              <span className="extra-stat-label">Worst Loss</span>
              <span className="extra-stat-value extra-stat-negative">
                {biggestLoss.myScore}-{biggestLoss.opponentScore} (-{biggestLoss.margin})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Achievements */}
      {achievementsWithDates.length > 0 && (
        <div className="profile-section">
          <h2>Achievements</h2>
          <div className="achievements-grid">
            {achievementsWithDates.map((achievement) => (
              <div key={achievement.id} className="achievement-card">
                <span className="achievement-icon">{achievement.icon}</span>
                <div className="achievement-info">
                  <div className="achievement-name">{achievement.name}</div>
                  <div className="achievement-desc">{achievement.description}</div>
                  <div className="achievement-date">
                    Unlocked {formatShortDate(achievement.unlockedAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Match History */}
      {playerMatches.length > 0 && (
        <div className="profile-section">
          <h2>Match History</h2>
          <div className="match-history">
            {playerMatches.map((match) => {
              const result = getMatchResult(match);
              const goals = getMatchGoals(match);
              const inRed = match.redTeam.some((p) => p.id === player.id);
              const isExpanded = expandedMatchId === match.id;

              return (
                <div key={match.id} className="match-history-item">
                  <div
                    className={`match-history-header ${result ? `match-${result.toLowerCase()}` : ''}`}
                    onClick={() => setExpandedMatchId(isExpanded ? null : match.id)}
                  >
                    <span className="match-date">{formatDate(match.date)}</span>
                    <span className={`match-result-badge result-${result?.toLowerCase() || 'pending'}`}>
                      {result || '?'}
                    </span>
                    <span className="match-score">
                      {match.redScore ?? '-'} - {match.whiteScore ?? '-'}
                    </span>
                    <span className={`match-team-indicator ${inRed ? 'team-red' : 'team-white'}`}>
                      {inRed ? 'RED' : 'WHITE'}
                    </span>
                    {goals > 0 && <span className="match-goals-badge">{goals} goal{goals > 1 ? 's' : ''}</span>}
                    <span className="match-expand-icon">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                  {isExpanded && (
                    <div className="match-history-details">
                      <div className="match-teams-row">
                        <div className="match-team-list">
                          <div className="team-label-small red">Red Team</div>
                          {match.redTeam.map((p) => (
                            <Link
                              key={p.id}
                              to={`/player/${createPlayerSlug(p.name)}`}
                              className={`team-player-link ${p.id === player.id ? 'current-player' : ''}`}
                            >
                              {p.name}{p.isCaptain && ' (C)'}
                            </Link>
                          ))}
                        </div>
                        <div className="match-team-list">
                          <div className="team-label-small white">White Team</div>
                          {match.whiteTeam.map((p) => (
                            <Link
                              key={p.id}
                              to={`/player/${createPlayerSlug(p.name)}`}
                              className={`team-player-link ${p.id === player.id ? 'current-player' : ''}`}
                            >
                              {p.name}{p.isCaptain && ' (C)'}
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer link */}
      <div className="profile-footer">
        <Link to="/login" className="profile-home-link">OSSMNF Home</Link>
      </div>
    </div>
  );
}
