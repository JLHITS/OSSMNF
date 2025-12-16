import { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import { useData } from '../context/DataContext';
import { FootballPitch } from '../components/FootballPitch';
import type { TeamPlayer, MatchSize } from '../types';
import { generateBalancedTeams, getTeamSize, calculateTeamOVR } from '../utils/calculations';
import { createMatch } from '../services/firebase';
import placeholder from '../assets/placeholder.png';

export function Play() {
  const { players, refreshMatches } = useData();
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());
  const [matchSize, setMatchSize] = useState<MatchSize>('8v8');
  const [redTeam, setRedTeam] = useState<TeamPlayer[]>([]);
  const [whiteTeam, setWhiteTeam] = useState<TeamPlayer[]>([]);
  const [teamsGenerated, setTeamsGenerated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const pitchRef = useRef<HTMLDivElement>(null);

  const teamSize = getTeamSize(matchSize);
  const requiredPlayers = teamSize * 2;

  const togglePlayer = (playerId: string) => {
    setSelectedPlayerIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(playerId)) {
        newSet.delete(playerId);
      } else {
        newSet.add(playerId);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    setSelectedPlayerIds(new Set(players.map((p) => p.id)));
  };

  const clearSelection = () => {
    setSelectedPlayerIds(new Set());
  };

  const handleGenerateTeams = () => {
    setError(null);
    const selectedPlayers = players.filter((p) => selectedPlayerIds.has(p.id));

    if (selectedPlayers.length < requiredPlayers) {
      setError(`Need at least ${requiredPlayers} players for ${matchSize}. Selected: ${selectedPlayers.length}`);
      return;
    }

    try {
      const { redTeam: newRedTeam, whiteTeam: newWhiteTeam } = generateBalancedTeams(
        selectedPlayers,
        teamSize
      );
      setRedTeam(newRedTeam);
      setWhiteTeam(newWhiteTeam);
      setTeamsGenerated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate teams');
    }
  };

  const handleTeamsChange = (newRedTeam: TeamPlayer[], newWhiteTeam: TeamPlayer[]) => {
    setRedTeam(newRedTeam);
    setWhiteTeam(newWhiteTeam);
  };

  const handleCaptainChange = (playerId: string, team: 'red' | 'white') => {
    if (team === 'red') {
      setRedTeam((prev) =>
        prev.map((p) => ({
          ...p,
          isCaptain: p.id === playerId ? !p.isCaptain : false,
        }))
      );
    } else {
      setWhiteTeam((prev) =>
        prev.map((p) => ({
          ...p,
          isCaptain: p.id === playerId ? !p.isCaptain : false,
        }))
      );
    }
  };

  const handleSaveMatch = async () => {
    setSaving(true);
    try {
      await createMatch({
        date: new Date(),
        redTeam,
        whiteTeam,
        redTeamOvr: calculateTeamOVR(redTeam),
        whiteTeamOvr: calculateTeamOVR(whiteTeam),
        redScore: null,
        whiteScore: null,
        redScorers: [],
        whiteScorers: [],
        matchSize,
        status: 'pending',
      });
      await refreshMatches();
      alert('Match saved successfully!');
    } catch (err) {
      console.error('Error saving match:', err);
      alert('Failed to save match');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPNG = async () => {
    if (!pitchRef.current) return;

    try {
      const canvas = await html2canvas(pitchRef.current, {
        backgroundColor: '#1a472a',
        scale: 2,
      });
      const link = document.createElement('a');
      link.download = `ossmnf-teams-${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Error generating PNG:', err);
      alert('Failed to generate image');
    }
  };

  const handleShare = async () => {
    if (!pitchRef.current) return;

    try {
      const canvas = await html2canvas(pitchRef.current, {
        backgroundColor: '#1a472a',
        scale: 2,
      });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], 'ossmnf-teams.png', { type: 'image/png' });

        if (navigator.share && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'OssMNF Teams',
            text: 'Check out the teams for tonight!',
            files: [file],
          });
        } else {
          // Fallback to download
          handleDownloadPNG();
        }
      });
    } catch (err) {
      console.error('Error sharing:', err);
      handleDownloadPNG();
    }
  };

  const resetTeams = () => {
    setTeamsGenerated(false);
    setRedTeam([]);
    setWhiteTeam([]);
  };

  return (
    <div className="play-page">
      <h1>Generate Teams</h1>

      {!teamsGenerated ? (
        <div className="team-setup">
          <div className="match-size-selector">
            <label htmlFor="matchSize">Match Size:</label>
            <select
              id="matchSize"
              value={matchSize}
              onChange={(e) => setMatchSize(e.target.value as MatchSize)}
            >
              <option value="5v5">5v5</option>
              <option value="6v6">6v6</option>
              <option value="7v7">7v7</option>
              <option value="8v8">8v8</option>
              <option value="9v9">9v9</option>
            </select>
            <span className="required-info">
              Need {requiredPlayers} players | Selected: {selectedPlayerIds.size}
            </span>
          </div>

          <div className="player-selection-actions">
            <button onClick={selectAll} className="btn btn-secondary">
              Select All
            </button>
            <button onClick={clearSelection} className="btn btn-secondary">
              Clear Selection
            </button>
          </div>

          <div className="player-selection-grid">
            {players.map((player) => (
              <div
                key={player.id}
                className={`player-select-card ${selectedPlayerIds.has(player.id) ? 'selected' : ''}`}
                onClick={() => togglePlayer(player.id)}
              >
                <img
                  src={player.photoUrl || placeholder}
                  alt={player.name}
                  className="player-select-photo"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = placeholder;
                  }}
                />
                <div className="player-select-info">
                  <span className="player-select-name">{player.name}</span>
                  <span className="player-select-details">
                    {player.position} | OVR: {player.ovr}
                  </span>
                </div>
                <div className="player-select-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedPlayerIds.has(player.id)}
                    onChange={() => {}}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            ))}
          </div>

          {players.length === 0 && (
            <p className="no-players-message">
              No players found. Add players in the Configuration tab first.
            </p>
          )}

          {error && <p className="error-message">{error}</p>}

          <button
            onClick={handleGenerateTeams}
            disabled={selectedPlayerIds.size < requiredPlayers}
            className="btn btn-primary generate-btn"
          >
            Generate Teams
          </button>
        </div>
      ) : (
        <div className="teams-display">
          <div className="teams-actions">
            <button onClick={resetTeams} className="btn btn-secondary">
              Start Over
            </button>
            <button onClick={handleGenerateTeams} className="btn btn-secondary">
              Regenerate
            </button>
            <button onClick={handleSaveMatch} disabled={saving} className="btn btn-primary">
              {saving ? 'Saving...' : 'Save Match'}
            </button>
            <button onClick={handleDownloadPNG} className="btn btn-secondary">
              Download PNG
            </button>
            <button onClick={handleShare} className="btn btn-secondary">
              Share
            </button>
          </div>

          <div ref={pitchRef}>
            <FootballPitch
              redTeam={redTeam}
              whiteTeam={whiteTeam}
              onTeamsChange={handleTeamsChange}
              onCaptainChange={handleCaptainChange}
            />
          </div>

          <p className="drag-hint">
            Drag players between teams to swap. Click "Make C" to assign captain.
          </p>
        </div>
      )}
    </div>
  );
}
