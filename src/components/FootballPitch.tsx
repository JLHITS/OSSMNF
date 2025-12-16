import { useEffect, useState } from 'react';
import type { TeamPlayer } from '../types';
import { getCloudinaryImageUrl } from '../services/cloudinary';
import placeholder from '../assets/placeholder.png';

interface FootballPitchProps {
  redTeam: TeamPlayer[];
  whiteTeam: TeamPlayer[];
  onTeamsChange: (redTeam: TeamPlayer[], whiteTeam: TeamPlayer[]) => void;
  showRatings: boolean;
}

interface PlayerCardProps {
  player: TeamPlayer;
  team: 'red' | 'white';
  showRatings: boolean;
  isSelected: boolean;
  onSelect: (player: TeamPlayer, team: 'red' | 'white') => void;
}

// Formation configurations: [back row, middle row, front row]
const FORMATIONS: Record<number, number[]> = {
  5: [2, 2, 1], // 5v5: 2-2-1
  6: [2, 2, 2], // 6v6: 2-2-2
  7: [2, 3, 2], // 7v7: 2-3-2
  8: [3, 3, 2], // 8v8: 3-3-2
  9: [3, 3, 3], // 9v9: 3-3-3
};

function PlayerCard({ player, team, showRatings, isSelected, onSelect }: PlayerCardProps) {
  return (
    <div
      onClick={() => onSelect(player, team)}
      className={`player-card ${team}-team ${isSelected ? 'swap-selected' : ''}`}
    >
      <div className={`player-photo-container ${player.isCaptain ? 'has-captain' : ''}`}>
        <img
          src={player.photoUrl ? getCloudinaryImageUrl(player.photoUrl) : placeholder}
          alt={player.name}
          className="player-photo"
          crossOrigin="anonymous"
          onError={(e) => {
            (e.target as HTMLImageElement).src = placeholder;
          }}
        />
        {player.isCaptain && (
          <span className="captain-badge" title="Captain">
            C
          </span>
        )}
        {isSelected && (
          <span className="swap-indicator" title="Selected to swap">
            ↺
          </span>
        )}
      </div>
      <span className="player-name">{player.name}</span>
      {showRatings && <span className="player-ovr">{player.ovr}</span>}
    </div>
  );
}

export function FootballPitch({
  redTeam,
  whiteTeam,
  onTeamsChange,
  showRatings,
}: FootballPitchProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  useEffect(() => {
    // Reset selection whenever teams change to avoid stale references
    setSelectedPlayerId(null);
  }, [redTeam, whiteTeam]);

  const handlePlayerSelect = (player: TeamPlayer, team: 'red' | 'white') => {
    // First tap selects, second tap on another player swaps
    if (!selectedPlayerId) {
      setSelectedPlayerId(player.id);
      return;
    }

    // Deselect if the same player is tapped again
    if (selectedPlayerId === player.id) {
      setSelectedPlayerId(null);
      return;
    }

    const selectedTeam = redTeam.some((p) => p.id === selectedPlayerId) ? 'red' : 'white';
    const selectedPlayer =
      selectedTeam === 'red'
        ? redTeam.find((p) => p.id === selectedPlayerId)
        : whiteTeam.find((p) => p.id === selectedPlayerId);

    if (!selectedPlayer) {
      setSelectedPlayerId(null);
      return;
    }

    let newRedTeam = [...redTeam];
    let newWhiteTeam = [...whiteTeam];

    if (team === selectedTeam) {
      // Swap within the same team (keeps formation order intact)
      if (team === 'red') {
        const fromIndex = newRedTeam.findIndex((p) => p.id === selectedPlayerId);
        const toIndex = newRedTeam.findIndex((p) => p.id === player.id);
        [newRedTeam[fromIndex], newRedTeam[toIndex]] = [newRedTeam[toIndex], newRedTeam[fromIndex]];
      } else {
        const fromIndex = newWhiteTeam.findIndex((p) => p.id === selectedPlayerId);
        const toIndex = newWhiteTeam.findIndex((p) => p.id === player.id);
        [newWhiteTeam[fromIndex], newWhiteTeam[toIndex]] = [
          newWhiteTeam[toIndex],
          newWhiteTeam[fromIndex],
        ];
      }
    } else {
      // Swap between teams
      if (selectedTeam === 'red') {
        const redIndex = newRedTeam.findIndex((p) => p.id === selectedPlayerId);
        const whiteIndex = newWhiteTeam.findIndex((p) => p.id === player.id);
        newRedTeam[redIndex] = player;
        newWhiteTeam[whiteIndex] = selectedPlayer;
      } else {
        const redIndex = newRedTeam.findIndex((p) => p.id === player.id);
        const whiteIndex = newWhiteTeam.findIndex((p) => p.id === selectedPlayerId);
        newRedTeam[redIndex] = selectedPlayer;
        newWhiteTeam[whiteIndex] = player;
      }
    }

    setSelectedPlayerId(null);
    onTeamsChange(newRedTeam, newWhiteTeam);
  };

  const renderTeamFormation = (
    team: TeamPlayer[],
    teamName: 'red' | 'white',
    flipRows = false
  ) => {
    const baseFormation = FORMATIONS[team.length] || [3, 3, 3];
    const formation = flipRows ? [...baseFormation].reverse() : baseFormation;
    const rows: TeamPlayer[][] = [];
    let playerIndex = 0;

    // Build rows based on formation
    formation.forEach((count) => {
      rows.push(team.slice(playerIndex, playerIndex + count));
      playerIndex += count;
    });

    return (
      <div className="team-formation">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="formation-row" style={{ gridTemplateColumns: `repeat(${row.length}, 1fr)` }}>
            {row.map((player) => (
              <div key={player.id} className="formation-slot">
                <PlayerCard
                  player={player}
                  team={teamName}
                  showRatings={showRatings}
                  isSelected={selectedPlayerId === player.id}
                  onSelect={handlePlayerSelect}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  const calculateTeamOvr = (team: TeamPlayer[]) => {
    if (team.length === 0) return 0;
    const total = team.reduce((sum, player) => sum + player.ovr, 0);
    return (total / team.length).toFixed(1);
  };

  const calculateTeamAverages = (team: TeamPlayer[]) => {
    if (team.length === 0) {
      return { fitness: '0.0', defence: '0.0', attack: '0.0', ballUse: '0.0', ovr: '0.0' };
    }
    const totals = team.reduce(
      (acc, player) => ({
        fitness: acc.fitness + player.fitness,
        defence: acc.defence + player.defence,
        attack: acc.attack + player.attack,
        ballUse: acc.ballUse + player.ballUse,
        ovr: acc.ovr + player.ovr,
      }),
      { fitness: 0, defence: 0, attack: 0, ballUse: 0, ovr: 0 }
    );

    const divisor = team.length;
    return {
      fitness: (totals.fitness / divisor).toFixed(1),
      defence: (totals.defence / divisor).toFixed(1),
      attack: (totals.attack / divisor).toFixed(1),
      ballUse: (totals.ballUse / divisor).toFixed(1),
      ovr: (totals.ovr / divisor).toFixed(1),
    };
  };

  const redAverages = calculateTeamAverages(redTeam);
  const whiteAverages = calculateTeamAverages(whiteTeam);

  return (
    <div className="pitch-container-wrapper">
      <div className="football-pitch">
        <div className="pitch-markings">
          <div className="center-line" />
          <div className="center-circle" />
          <div className="penalty-area top" />
          <div className="penalty-area bottom" />
          <div className="goal-area top" />
          <div className="goal-area bottom" />
        </div>

        <div className="team-half white-half">
          {renderTeamFormation(whiteTeam, 'white')}
        </div>

        <div className="team-half red-half">
          {renderTeamFormation(redTeam, 'red', true)}
        </div>
      </div>

      {showRatings && (
        <div className="teams-stats-row">
          <div className="team-stats red-stats">
            <h3>Reds</h3>
            <p className="team-ovr">AVG OVR: {calculateTeamOvr(redTeam)}</p>
            <p className="team-total">
              Total: {redTeam.reduce((sum, p) => sum + p.ovr, 0).toFixed(1)}
            </p>
            <div className="team-attribute-averages">
              <div><span>WR</span><strong>{redAverages.fitness}</strong></div>
              <div><span>DEF</span><strong>{redAverages.defence}</strong></div>
              <div><span>ATT</span><strong>{redAverages.attack}</strong></div>
              <div><span>BU</span><strong>{redAverages.ballUse}</strong></div>
            </div>
          </div>

          <div className="team-stats white-stats">
            <h3>Non-Reds</h3>
            <p className="team-ovr">AVG OVR: {calculateTeamOvr(whiteTeam)}</p>
            <p className="team-total">
              Total: {whiteTeam.reduce((sum, p) => sum + p.ovr, 0).toFixed(1)}
            </p>
            <div className="team-attribute-averages">
              <div><span>WR</span><strong>{whiteAverages.fitness}</strong></div>
              <div><span>DEF</span><strong>{whiteAverages.defence}</strong></div>
              <div><span>ATT</span><strong>{whiteAverages.attack}</strong></div>
              <div><span>BU</span><strong>{whiteAverages.ballUse}</strong></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
