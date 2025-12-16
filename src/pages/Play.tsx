import { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { useData } from '../context/DataContext';
import { FootballPitch } from '../components/FootballPitch';
import { Alert } from '../components/Modal';
import type { TeamPlayer, MatchSize } from '../types';
import { generateBalancedTeams, getTeamSize, calculateTeamOVR } from '../utils/calculations';
import { createMatch } from '../services/firebase';
import { getCloudinaryImageUrl } from '../services/cloudinary';
import placeholder from '../assets/placeholder.png';

// Helper functions for localStorage
const loadTeamsFromStorage = (): { redTeam: TeamPlayer[]; whiteTeam: TeamPlayer[]; matchSize: MatchSize } => {
  try {
    const saved = localStorage.getItem('ossmnf_current_teams');
    if (saved) {
      const data = JSON.parse(saved);
      return {
        redTeam: data.redTeam || [],
        whiteTeam: data.whiteTeam || [],
        matchSize: data.matchSize || '8v8',
      };
    }
  } catch (err) {
    console.error('Error loading teams from storage:', err);
  }
  return { redTeam: [], whiteTeam: [], matchSize: '8v8' };
};

const saveTeamsToStorage = (redTeam: TeamPlayer[], whiteTeam: TeamPlayer[], matchSize: MatchSize) => {
  try {
    localStorage.setItem('ossmnf_current_teams', JSON.stringify({ redTeam, whiteTeam, matchSize }));
  } catch (err) {
    console.error('Error saving teams to storage:', err);
  }
};

export function Play() {
  const { players, refreshMatches } = useData();
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());

  // Initialize from localStorage
  const initialState = loadTeamsFromStorage();
  const [matchSize, setMatchSize] = useState<MatchSize>(initialState.matchSize);
  const [redTeam, setRedTeam] = useState<TeamPlayer[]>(initialState.redTeam);
  const [whiteTeam, setWhiteTeam] = useState<TeamPlayer[]>(initialState.whiteTeam);
  const [teamsGenerated, setTeamsGenerated] = useState(initialState.redTeam.length > 0 && initialState.whiteTeam.length > 0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showRatings, setShowRatings] = useState(false); // Default hidden
  const pitchRef = useRef<HTMLDivElement>(null);
  const [alertMessage, setAlertMessage] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Save to localStorage whenever teams or matchSize changes
  useEffect(() => {
    saveTeamsToStorage(redTeam, whiteTeam, matchSize);
  }, [redTeam, whiteTeam, matchSize]);

  const teamSize = getTeamSize(matchSize);
  const requiredPlayers = teamSize * 2;

  const togglePlayer = (playerId: string) => {
    setSelectedPlayerIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(playerId)) {
        newSet.delete(playerId);
      } else {
        // Don't allow selecting more than required players
        if (newSet.size >= requiredPlayers) {
          return newSet;
        }
        newSet.add(playerId);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    // Only select up to the required number of players
    const playerIds = players.slice(0, requiredPlayers).map((p) => p.id);
    setSelectedPlayerIds(new Set(playerIds));
  };

  const clearSelection = () => {
    setSelectedPlayerIds(new Set());
  };

  const handleGenerateTeams = () => {
    setError(null);
    const selectedPlayers = players.filter((p) => selectedPlayerIds.has(p.id));

    if (selectedPlayers.length !== requiredPlayers) {
      setError(`Need exactly ${requiredPlayers} players for ${matchSize}. Selected: ${selectedPlayers.length}`);
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

  const handleRedCaptainChange = (playerId: string) => {
    setRedTeam((prev) =>
      prev.map((p) => ({
        ...p,
        isCaptain: p.id === playerId,
      }))
    );
  };

  const handleWhiteCaptainChange = (playerId: string) => {
    setWhiteTeam((prev) =>
      prev.map((p) => ({
        ...p,
        isCaptain: p.id === playerId,
      }))
    );
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
      setAlertMessage({ message: 'Match saved successfully!', type: 'success' });
    } catch (err) {
      console.error('Error saving match:', err);
      setAlertMessage({ message: 'Failed to save match', type: 'error' });
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
      setAlertMessage({ message: 'Failed to generate image', type: 'error' });
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
    localStorage.removeItem('ossmnf_current_teams');
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
                  src={player.photoUrl ? getCloudinaryImageUrl(player.photoUrl) : placeholder}
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
                    onChange={() => togglePlayer(player.id)}
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
            disabled={selectedPlayerIds.size !== requiredPlayers}
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
            <button onClick={() => setShowRatings(!showRatings)} className="btn btn-secondary">
              {showRatings ? 'Hide Ratings' : 'Show Ratings'}
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

          <div className="teams-controls-row">
            <div className="captain-selector">
              <label htmlFor="red-captain">Reds Captain:</label>
              <select
                id="red-captain"
                value={redTeam.find(p => p.isCaptain)?.id || ''}
                onChange={(e) => handleRedCaptainChange(e.target.value)}
              >
                {redTeam.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="captain-selector">
              <label htmlFor="white-captain">Non-Reds Captain:</label>
              <select
                id="white-captain"
                value={whiteTeam.find(p => p.isCaptain)?.id || ''}
                onChange={(e) => handleWhiteCaptainChange(e.target.value)}
              >
                {whiteTeam.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div ref={pitchRef}>
            <FootballPitch
              redTeam={redTeam}
              whiteTeam={whiteTeam}
              onTeamsChange={handleTeamsChange}
              showRatings={showRatings}
            />
          </div>

          <p className="drag-hint">
            Drag players between teams to swap positions.
          </p>
        </div>
      )}

      {/* Modals */}
      {alertMessage && (
        <Alert
          isOpen={true}
          onClose={() => setAlertMessage(null)}
          message={alertMessage.message}
          type={alertMessage.type}
        />
      )}
    </div>
  );
}
