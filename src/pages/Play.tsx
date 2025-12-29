import { useState, useRef, useEffect, useMemo } from 'react';
import html2canvas from 'html2canvas';
import { useData } from '../context/DataContext';
import { FootballPitch } from '../components/FootballPitch';
import { Alert, Confirm } from '../components/Modal';
import { LoadingOverlay } from '../components/LoadingOverlay';
import type { TeamPlayer, MatchSize, Player, AvailabilityStatus, TeamGenerationAlgorithm } from '../types';
import { generateBalancedTeams, getTeamSize, calculateTeamOVR } from '../utils/calculations';
import { generateConstraintOptimizedTeams, generateILPOptimizedTeams } from '../utils/teamAlgorithms';
import { createMatch, resetAllAvailability } from '../services/firebase';
import { getCloudinaryImageUrl } from '../services/cloudinary';
import placeholder from '../assets/placeholder.png';

// Constants for squad management
const PLAYING_SQUAD_SIZE = 16;
const RESERVE_POOL_SIZE = 8;

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
  const { players, matches, availability, refreshMatches, updateAvailability } = useData();
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());

  // Initialize from localStorage
  const initialState = loadTeamsFromStorage();
  const [matchSize, setMatchSize] = useState<MatchSize>(initialState.matchSize);
  const [redTeam, setRedTeam] = useState<TeamPlayer[]>(initialState.redTeam);
  const [whiteTeam, setWhiteTeam] = useState<TeamPlayer[]>(initialState.whiteTeam);
  const [teamsGenerated, setTeamsGenerated] = useState(initialState.redTeam.length > 0 && initialState.whiteTeam.length > 0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showRatings, setShowRatings] = useState(false);
  const pitchRef = useRef<HTMLDivElement>(null);
  const [alertMessage, setAlertMessage] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Reserve management state
  const [selectedReserveId, setSelectedReserveId] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // Algorithm selection state
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<TeamGenerationAlgorithm>(() => {
    const saved = localStorage.getItem('ossmnf_algorithm_preference');
    return (saved as TeamGenerationAlgorithm) || 'ilp-solver';
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAlgorithmInfo, setShowAlgorithmInfo] = useState(false);

  // Save algorithm preference to localStorage
  useEffect(() => {
    localStorage.setItem('ossmnf_algorithm_preference', selectedAlgorithm);
  }, [selectedAlgorithm]);

  // Save to localStorage whenever teams or matchSize changes
  useEffect(() => {
    saveTeamsToStorage(redTeam, whiteTeam, matchSize);
  }, [redTeam, whiteTeam, matchSize]);

  const teamSize = getTeamSize(matchSize);
  const requiredPlayers = teamSize * 2;

  // Compute playing squad and reserves from availability data
  const { playingSquad, reserves } = useMemo(() => {
    const playing: Player[] = [];
    const reserve: Array<{ player: Player; order: number }> = [];

    players.forEach((player) => {
      const avail = availability.get(player.id);
      if (avail && avail.reserveOrder !== null) {
        reserve.push({ player, order: avail.reserveOrder });
      } else {
        playing.push(player);
      }
    });

    // Sort reserves by order
    reserve.sort((a, b) => a.order - b.order);

    return {
      playingSquad: playing,
      reserves: reserve.map((r) => r.player),
    };
  }, [players, availability]);

  // Get player availability status
  const getPlayerStatus = (playerId: string): AvailabilityStatus => {
    return availability.get(playerId)?.status || 'unconfirmed';
  };

  const availabilitySummary = useMemo(() => {
    // In/Out include everyone; Waiting excludes reserves
    const inPlayers: Player[] = [];
    const outPlayers: Player[] = [];
    const waitingPlayers: Player[] = [];

    const reserveIds = new Set(reserves.map((p) => p.id));

    players.forEach((player) => {
      const status = availability.get(player.id)?.status || 'unconfirmed';
      if (status === 'in') inPlayers.push(player);
      else if (status === 'out') outPlayers.push(player);
      else if (!reserveIds.has(player.id)) waitingPlayers.push(player);
    });

    return { inPlayers, outPlayers, waitingPlayers };
  }, [players, availability, reserves]);

  // Set player availability via dropdown (instead of cycling button)
  const handleStatusChange = async (playerId: string, newStatus: AvailabilityStatus) => {
    const currentAvail = availability.get(playerId);
    const currentReserveOrder = currentAvail?.reserveOrder ?? null;
    let updatedReserveOrder = currentReserveOrder;

    if (newStatus === 'out' && currentReserveOrder === null) {
      // Demote to reserves - find next available order
      const maxOrder = Math.max(0, ...Array.from(availability.values())
        .filter((a) => a.reserveOrder !== null)
        .map((a) => a.reserveOrder!));
      updatedReserveOrder = maxOrder + 1;
    } else if (newStatus === 'in' && currentReserveOrder !== null) {
      // Promote from reserves
      updatedReserveOrder = null;
      // Reorder remaining reserves
      await reorderReservesAfterPromotion(playerId);
    }

    await updateAvailability([{ playerId, status: newStatus, reserveOrder: updatedReserveOrder }]);
  };

  // Reorder reserves after a player is promoted
  const reorderReservesAfterPromotion = async (promotedPlayerId: string) => {
    const currentReserves = Array.from(availability.values())
      .filter((a) => a.reserveOrder !== null && a.playerId !== promotedPlayerId)
      .sort((a, b) => a.reserveOrder! - b.reserveOrder!);

    const updates = currentReserves.map((r, index) => ({
      playerId: r.playerId,
      status: r.status,
      reserveOrder: index + 1,
    }));

    if (updates.length > 0) {
      await updateAvailability(updates);
    }
  };

  // Handle reserve swap
  const handleReserveClick = async (playerId: string) => {
    if (selectedReserveId === null) {
      setSelectedReserveId(playerId);
    } else if (selectedReserveId === playerId) {
      setSelectedReserveId(null);
    } else {
      // Swap the two reserves
      const reserve1 = availability.get(selectedReserveId);
      const reserve2 = availability.get(playerId);

      if (reserve1 && reserve2 && reserve1.reserveOrder !== null && reserve2.reserveOrder !== null) {
        await updateAvailability([
          { playerId: selectedReserveId, status: reserve1.status, reserveOrder: reserve2.reserveOrder },
          { playerId, status: reserve2.status, reserveOrder: reserve1.reserveOrder },
        ]);
      }
      setSelectedReserveId(null);
    }
  };

  // Promote a reserve back into the squad without changing their status
  const promoteReserveToSquad = async (playerId: string) => {
    const currentAvail = availability.get(playerId);
    if (!currentAvail || currentAvail.reserveOrder === null) return;

    // Reorder remaining reserves after removing this player
    await reorderReservesAfterPromotion(playerId);
    await updateAvailability([{ playerId, status: currentAvail.status, reserveOrder: null }]);
    setSelectedReserveId((prev) => (prev === playerId ? null : prev));
  };

  // Select last 16 from most recent match
  const selectLastMatch = () => {
    if (matches.length === 0) return;

    const lastMatch = matches[0];
    const lastPlayers = [...lastMatch.redTeam, ...lastMatch.whiteTeam];
    const playerIds = new Set(lastPlayers.map((p) => p.id));
    setSelectedPlayerIds(playerIds);
  };

  // Select all players marked IN
  const selectAllIn = () => {
    const inPlayers = players.filter((p) => getPlayerStatus(p.id) === 'in');
    const playerIds = new Set(inPlayers.slice(0, requiredPlayers).map((p) => p.id));
    setSelectedPlayerIds(playerIds);
  };

  // Initialize availability for all players if not set
  useEffect(() => {
    const initializeAvailability = async () => {
      const playersWithoutAvailability = players.filter((p) => !availability.has(p.id));

      if (playersWithoutAvailability.length > 0) {
        // First 16 players go to playing squad, rest to reserves
        const updates = playersWithoutAvailability.map((player, index) => {
          const existingReserveCount = Array.from(availability.values())
            .filter((a) => a.reserveOrder !== null).length;

          if (index < PLAYING_SQUAD_SIZE - (players.length - playersWithoutAvailability.length)) {
            return { playerId: player.id, status: 'unconfirmed' as AvailabilityStatus, reserveOrder: null };
          } else {
            const reserveIndex = index - PLAYING_SQUAD_SIZE + existingReserveCount + 1;
            return { playerId: player.id, status: 'unconfirmed' as AvailabilityStatus, reserveOrder: reserveIndex };
          }
        });

        if (updates.length > 0) {
          await updateAvailability(updates);
        }
      }
    };

    if (players.length > 0) {
      initializeAvailability();
    }
  }, [players, availability, updateAvailability]);

  // Reset all availability
  const handleResetAvailability = async () => {
    try {
      await resetAllAvailability();
      setAlertMessage({ message: 'All availability reset to unconfirmed', type: 'success' });
    } catch (err) {
      console.error('Error resetting availability:', err);
      setAlertMessage({ message: 'Failed to reset availability', type: 'error' });
    }
    setConfirmReset(false);
  };

  const togglePlayer = (playerId: string) => {
    setSelectedPlayerIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(playerId)) {
        newSet.delete(playerId);
      } else {
        if (newSet.size >= requiredPlayers) {
          return newSet;
        }
        newSet.add(playerId);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    const playerIds = playingSquad.slice(0, requiredPlayers).map((p) => p.id);
    setSelectedPlayerIds(new Set(playerIds));
  };

  const clearSelection = () => {
    setSelectedPlayerIds(new Set());
  };

  const handleGenerateTeams = async () => {
    setError(null);
    const selectedPlayers = players.filter((p) => selectedPlayerIds.has(p.id));

    if (selectedPlayers.length !== requiredPlayers) {
      setError(`Need exactly ${requiredPlayers} players for ${matchSize}. Selected: ${selectedPlayers.length}`);
      return;
    }

    try {
      // Show loading for slower algorithms
      if (selectedAlgorithm !== 'snake-draft') {
        setIsGenerating(true);
        // Small delay to ensure loading overlay renders
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      let newRedTeam: TeamPlayer[];
      let newWhiteTeam: TeamPlayer[];

      if (selectedAlgorithm === 'snake-draft') {
        // Use existing fast algorithm
        const result = generateBalancedTeams(selectedPlayers, teamSize);
        newRedTeam = result.redTeam;
        newWhiteTeam = result.whiteTeam;
      } else if (selectedAlgorithm === 'constraint-opt') {
        // Use constraint optimizer with simulated annealing
        const result = generateConstraintOptimizedTeams(selectedPlayers, teamSize);
        newRedTeam = result.redTeam;
        newWhiteTeam = result.whiteTeam;
      } else {
        // Use ILP solver optimizer
        const result = generateILPOptimizedTeams(selectedPlayers, teamSize);
        newRedTeam = result.redTeam;
        newWhiteTeam = result.whiteTeam;
      }

      setRedTeam(newRedTeam);
      setWhiteTeam(newWhiteTeam);
      setTeamsGenerated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate teams');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTeamsChange = (newRedTeam: TeamPlayer[], newWhiteTeam: TeamPlayer[]) => {
    setRedTeam(newRedTeam);
    setWhiteTeam(newWhiteTeam);
  };

  const handleSwapTeams = () => {
    // Swap the teams - red becomes white and vice versa
    setRedTeam(whiteTeam);
    setWhiteTeam(redTeam);
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
        useCORS: true,
        allowTaint: false,
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
        useCORS: true,
        allowTaint: false,
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
          handleDownloadPNG();
        }
      });
    } catch (err) {
      console.error('Error sharing:', err);
      handleDownloadPNG();
    }
  };

  const generateWhatsAppLineup = (): string => {
    const today = new Date().toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const formatTeamPlayer = (player: TeamPlayer) => {
      const captain = player.isCaptain ? ' (C)' : '';
      return `${player.name}${captain}`;
    };

    const redList = redTeam.map(formatTeamPlayer).join('\n');
    const whiteList = whiteTeam.map(formatTeamPlayer).join('\n');

    return `⚽ Monday Night Football - ${matchSize}
📅 ${today}

🔴 REDS
${redList}

⚪ NON-REDS
${whiteList}`;
  };

  const generateWhatsAppAvailability = (): string => {
    const formatSection = (title: string, list: Player[], emoji: string) => {
      const lines = list.length > 0
        ? list.map((player) => `${emoji} ${player.name}`).join('\n')
        : `${emoji} None yet`;
      return `${title}\n${lines}`;
    };

    const confirmedIn = formatSection('Confirmed in:', availabilitySummary.inPlayers, '✅');
    const confirmedOut = formatSection('Confirmed out:', availabilitySummary.outPlayers, '❌');
    const pending = formatSection('Still waiting on:', availabilitySummary.waitingPlayers, '⬜️');

    return `${confirmedIn}\n\n${confirmedOut}\n\n${pending}`;
  };

  const handleCopyWhatsApp = async () => {
    const text = generateWhatsAppLineup();
    try {
      await navigator.clipboard.writeText(text);
      setAlertMessage({ message: 'Copied to clipboard!', type: 'success' });
    } catch (err) {
      console.error('Error copying to clipboard:', err);
      setAlertMessage({ message: 'Failed to copy', type: 'error' });
    }
  };

  const handleCopyAvailabilityWhatsApp = async () => {
    const text = generateWhatsAppAvailability();
    try {
      await navigator.clipboard.writeText(text);
      setAlertMessage({ message: 'Availability copied to clipboard!', type: 'success' });
    } catch (err) {
      console.error('Error copying availability message:', err);
      setAlertMessage({ message: 'Failed to copy availability', type: 'error' });
    }
  };

  const resetTeams = () => {
    setTeamsGenerated(false);
    setRedTeam([]);
    setWhiteTeam([]);
    localStorage.removeItem('ossmnf_current_teams');
  };

  // Render status dropdown for explicit selection
  const renderStatusSelect = (playerId: string) => {
    const status = getPlayerStatus(playerId);
    return (
      <select
        className={`status-select status-${status}`}
        value={status}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => handleStatusChange(playerId, e.target.value as AvailabilityStatus)}
      >
        <option value="in">In</option>
        <option value="out">Out</option>
        <option value="unconfirmed">Unconfirmed</option>
      </select>
    );
  };

  return (
    <div className="play-page">
      <h1>Generate Teams</h1>

      <div className="availability-summary">
        <div className="availability-counts">
          <div className="availability-pill in">
            <span className="pill-label">Confirmed IN</span>
            <span className="pill-value">{availabilitySummary.inPlayers.length}</span>
          </div>
          <div className="availability-pill out">
            <span className="pill-label">Confirmed OUT</span>
            <span className="pill-value">{availabilitySummary.outPlayers.length}</span>
          </div>
          <div className="availability-pill waiting">
            <span className="pill-label">Waiting</span>
            <span className="pill-value">{availabilitySummary.waitingPlayers.length}</span>
          </div>
        </div>
        <button
          onClick={handleCopyAvailabilityWhatsApp}
          className="btn btn-secondary availability-share-btn"
          data-emoji="✅❌"
        >
          Copy availability for WhatsApp
        </button>
      </div>

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
            <button
              onClick={selectLastMatch}
              className="btn btn-secondary"
              data-emoji="🕐"
              disabled={matches.length === 0}
              title={matches.length === 0 ? 'No previous matches' : 'Select players from last match'}
            >
              Select Last 16
            </button>
            <button onClick={selectAllIn} className="btn btn-secondary" data-emoji="✅">
              Select All IN
            </button>
            <button onClick={selectAll} className="btn btn-secondary" data-emoji="👥">
              Select All
            </button>
            <button onClick={clearSelection} className="btn btn-secondary" data-emoji="🧹">
              Clear
            </button>
            <button
              onClick={() => setConfirmReset(true)}
              className="btn btn-secondary"
              data-emoji="🔄"
              title="Reset all availability to unconfirmed"
            >
              Reset Week
            </button>
          </div>

          {/* Playing Squad Section */}
          <div className="squad-section">
            <h3 className="squad-section-title">
              Playing Squad ({playingSquad.length}/{PLAYING_SQUAD_SIZE})
            </h3>
            <div className="player-selection-grid">
              {playingSquad.map((player) => (
                <div
                  key={player.id}
                  className={`player-select-card ${selectedPlayerIds.has(player.id) ? 'selected' : ''} status-card-${getPlayerStatus(player.id)}`}
                  onClick={() => togglePlayer(player.id)}
                >
                  <div className="player-select-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedPlayerIds.has(player.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => togglePlayer(player.id)}
                    />
                  </div>
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
                    <span className="player-select-details">{player.position}</span>
                    <div className="player-select-status">{renderStatusSelect(player.id)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Reserves Section */}
          {reserves.length > 0 && (
            <div className="squad-section reserves-section">
              <h3 className="squad-section-title">
                Reserves ({reserves.length}/{RESERVE_POOL_SIZE})
              </h3>
              <p className="reserve-hint">Tap to select/swap order. Use + to move back into the squad without changing status.</p>
              <div className="reserves-grid">
                {reserves.map((player, index) => (
                  <div
                    key={player.id}
                    className={`reserve-card ${selectedReserveId === player.id ? 'reserve-selected' : ''} status-card-${getPlayerStatus(player.id)}`}
                    onClick={() => handleReserveClick(player.id)}
                  >
                    <button
                      className="reserve-promote-btn"
                      title="Move to squad without changing status"
                      onClick={(e) => {
                        e.stopPropagation();
                        promoteReserveToSquad(player.id);
                      }}
                    >
                      +
                    </button>
                    <div className="reserve-order">{index + 1}</div>
                    <img
                      src={player.photoUrl ? getCloudinaryImageUrl(player.photoUrl) : placeholder}
                      alt={player.name}
                      className="reserve-photo"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = placeholder;
                      }}
                    />
                    <div className="reserve-info">
                      <span className="reserve-name">{player.name}</span>
                      <span className="reserve-details">{player.position}</span>
                    </div>
                    {renderStatusSelect(player.id)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {players.length === 0 && (
            <p className="no-players-message">
              No players found. Add players in the Configuration tab first.
            </p>
          )}

          {error && <p className="error-message">{error}</p>}

          {/* Algorithm Selection */}
          <div className="algorithm-selector">
            <div className="algorithm-label-row">
              <label htmlFor="algorithm">Team Generation Method:</label>
              <button
                type="button"
                className="algorithm-info-btn"
                onClick={() => setShowAlgorithmInfo(!showAlgorithmInfo)}
                title="Compare methods"
              >
                ℹ️
              </button>
            </div>
            <select
              id="algorithm"
              value={selectedAlgorithm}
              onChange={(e) => setSelectedAlgorithm(e.target.value as TeamGenerationAlgorithm)}
              disabled={isGenerating}
            >
              <option value="snake-draft">⚡ Counter-Attack</option>
              <option value="constraint-opt">⚙️ Possession Play</option>
              <option value="ilp-solver">🏆 Total Football</option>
            </select>
            <span className="algorithm-hint">
              {selectedAlgorithm === 'snake-draft' && 'Quick and direct - balanced teams using snake draft'}
              {selectedAlgorithm === 'constraint-opt' && 'Methodical approach - optimises all attributes with intelligent swaps'}
              {selectedAlgorithm === 'ilp-solver' && 'Perfect balance - mathematical optimisation across all dimensions'}
            </span>

            {/* Comparison Tooltip */}
            {showAlgorithmInfo && (
              <div className="algorithm-comparison-tooltip">
                <div className="tooltip-header">
                  <h4>Method Comparison</h4>
                  <button
                    type="button"
                    className="tooltip-close"
                    onClick={() => setShowAlgorithmInfo(false)}
                  >
                    ✕
                  </button>
                </div>
                <table className="comparison-table">
                  <thead>
                    <tr>
                      <th>Feature</th>
                      <th>⚡ Counter-Attack</th>
                      <th>⚙️ Possession Play</th>
                      <th>🏆 Total Football</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Speed</td>
                      <td>~10ms</td>
                      <td>~200ms</td>
                      <td>~500ms</td>
                    </tr>
                    <tr>
                      <td>OVR Balance</td>
                      <td>Good</td>
                      <td>Excellent</td>
                      <td>Optimal</td>
                    </tr>
                    <tr>
                      <td>Multi-attribute</td>
                      <td>OVR only</td>
                      <td>All 5 attrs</td>
                      <td>All 5 attrs</td>
                    </tr>
                    <tr>
                      <td>Position Balance</td>
                      <td>Basic</td>
                      <td>Configurable</td>
                      <td>Hard constraint</td>
                    </tr>
                    <tr>
                      <td>Elite Distribution</td>
                      <td>No</td>
                      <td>Yes</td>
                      <td>Yes (2-2 split)</td>
                    </tr>
                    <tr>
                      <td>Guaranteed Optimal</td>
                      <td>No</td>
                      <td>No</td>
                      <td>Yes (if feasible)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <button
            onClick={handleGenerateTeams}
            disabled={selectedPlayerIds.size !== requiredPlayers || isGenerating}
            className="btn btn-primary generate-btn"
            data-emoji="🧠"
          >
            {isGenerating ? 'Generating...' : 'Generate Teams'}
          </button>
        </div>
      ) : (
        <div className="teams-display">
          <div className="teams-actions">
            <button onClick={resetTeams} className="btn btn-secondary" data-emoji="🔁">
              Start Over
            </button>
            <button onClick={handleGenerateTeams} className="btn btn-secondary" data-emoji="🔄">
              Regenerate
            </button>
            <label className="toggle-control">
              <input
                type="checkbox"
                className="toggle-input"
                checked={showRatings}
                onChange={() => setShowRatings(!showRatings)}
              />
              <span className="toggle-switch">
                <span className="toggle-thumb" />
              </span>
              <span>{showRatings ? 'Hide ratings' : 'Show ratings'}</span>
            </label>
            <button onClick={handleSaveMatch} disabled={saving} className="btn btn-primary" data-emoji="💾">
              {saving ? 'Saving...' : 'Save Match'}
            </button>
            <button onClick={handleDownloadPNG} className="btn btn-secondary" data-emoji="📥">
              Download PNG
            </button>
            <button onClick={handleShare} className="btn btn-secondary" data-emoji="📤">
              Share
            </button>
            <button onClick={handleCopyWhatsApp} className="btn btn-secondary" data-emoji="📋">
              Copy for WhatsApp
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
              onSwapTeams={handleSwapTeams}
              showRatings={showRatings}
            />
          </div>

          <p className="drag-hint">
            Tap/click a player, then another to swap them. Tap again to deselect.
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

      {confirmReset && (
        <Confirm
          isOpen={true}
          onClose={() => setConfirmReset(false)}
          onConfirm={handleResetAvailability}
          title="Reset Availability"
          message="Are you sure you want to reset all player availability to unconfirmed? This will clear all IN/OUT statuses for the week."
          confirmText="Reset"
          type="confirm"
        />
      )}

      {/* Loading Overlay for slower algorithms */}
      <LoadingOverlay
        isVisible={isGenerating}
        message="Teams are being generated..."
      />
    </div>
  );
}
