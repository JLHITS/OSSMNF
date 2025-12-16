import { useState, type Dispatch, type SetStateAction } from 'react';
import { useData } from '../context/DataContext';
import type { Match } from '../types';
import { updateMatch, deleteMatch } from '../services/firebase';
import { getCloudinaryImageUrl } from '../services/cloudinary';
import { Alert, Confirm } from '../components/Modal';
import placeholder from '../assets/placeholder.png';

export function Results() {
  const { matches, refreshMatches } = useData();
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [editRedScore, setEditRedScore] = useState<string>('');
  const [editWhiteScore, setEditWhiteScore] = useState<string>('');
  const [editRedScorers, setEditRedScorers] = useState<string[]>([]);
  const [editWhiteScorers, setEditWhiteScorers] = useState<string[]>([]);
  const [alertMessage, setAlertMessage] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const toggleExpand = (matchId: string) => {
    setExpandedMatchId(expandedMatchId === matchId ? null : matchId);
  };

  const startEditing = (match: Match) => {
    setEditingMatchId(match.id);
    setEditRedScore(match.redScore?.toString() || '');
    setEditWhiteScore(match.whiteScore?.toString() || '');
    setEditRedScorers(match.redScorers || []);
    setEditWhiteScorers(match.whiteScorers || []);
  };

  const cancelEditing = () => {
    setEditingMatchId(null);
    setEditRedScore('');
    setEditWhiteScore('');
    setEditRedScorers([]);
    setEditWhiteScorers([]);
  };

  const saveResult = async (matchId: string) => {
    const redScore = editRedScore ? parseInt(editRedScore, 10) : null;
    const whiteScore = editWhiteScore ? parseInt(editWhiteScore, 10) : null;

    try {
      await updateMatch(matchId, {
        redScore,
        whiteScore,
        redScorers: editRedScorers,
        whiteScorers: editWhiteScorers,
        status: redScore !== null && whiteScore !== null ? 'completed' : 'pending',
      });
      await refreshMatches();
      cancelEditing();
    } catch (err) {
      console.error('Error saving result:', err);
      setAlertMessage({ message: 'Failed to save result', type: 'error' });
    }
  };

  const handleDeleteMatch = (matchId: string) => {
    setConfirmDelete(matchId);
  };

  const confirmDeleteMatch = async () => {
    if (!confirmDelete) return;

    try {
      await deleteMatch(confirmDelete);
      await refreshMatches();
    } catch (err) {
      console.error('Error deleting match:', err);
      setAlertMessage({ message: 'Failed to delete match', type: 'error' });
    } finally {
      setConfirmDelete(null);
    }
  };

  const toggleScorer = (
    playerId: string,
    _team: 'red' | 'white',
    scorers: string[],
    setScorers: Dispatch<SetStateAction<string[]>>
  ) => {
    if (scorers.includes(playerId)) {
      setScorers(scorers.filter((id) => id !== playerId));
    } else {
      setScorers([...scorers, playerId]);
    }
  };

  const addMultipleGoals = (
    playerId: string,
    scorers: string[],
    setScorers: Dispatch<SetStateAction<string[]>>
  ) => {
    setScorers([...scorers, playerId]);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getResultClass = (match: Match) => {
    if (match.status === 'pending') return 'result-pending';
    if (match.redScore === match.whiteScore) return 'result-draw';
    return '';
  };

  const countGoals = (playerId: string, scorers: string[]) => {
    return scorers.filter((id) => id === playerId).length;
  };

  return (
    <div className="results-page">
      <h1>Match Results</h1>

      {matches.length === 0 ? (
        <p className="no-results-message">
          No matches yet. Generate teams in the Play tab to create a match.
        </p>
      ) : (
        <div className="results-list">
          {matches.map((match) => (
            <div key={match.id} className={`result-card ${getResultClass(match)}`}>
              <div className="result-header" onClick={() => toggleExpand(match.id)}>
                <span className="result-date">{formatDate(match.date)}</span>
                <div className="result-score">
                  <span className="team-label red">RED</span>
                  <span className="score">
                    {match.redScore ?? '-'} - {match.whiteScore ?? '-'}
                  </span>
                  <span className="team-label white">WHITE</span>
                </div>
                <span className="result-size">{match.matchSize}</span>
                <span className={`result-status ${match.status}`}>
                  {match.status === 'pending' ? 'Pending' : 'Completed'}
                </span>
                <span className="expand-icon">{expandedMatchId === match.id ? '▼' : '▶'}</span>
              </div>

              {expandedMatchId === match.id && (
                <div className="result-details">
                  {editingMatchId === match.id ? (
                    <div className="result-editor">
                      <div className="score-inputs">
                        <div className="score-input-group">
                          <label>Red Score:</label>
                          <input
                            type="number"
                            min="0"
                            value={editRedScore}
                            onChange={(e) => setEditRedScore(e.target.value)}
                          />
                        </div>
                        <div className="score-input-group">
                          <label>White Score:</label>
                          <input
                            type="number"
                            min="0"
                            value={editWhiteScore}
                            onChange={(e) => setEditWhiteScore(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="scorers-section">
                        <div className="team-scorers">
                          <h4>Red Team Scorers (optional)</h4>
                          <div className="scorer-buttons">
                            {match.redTeam.map((player) => {
                              const goals = countGoals(player.id, editRedScorers);
                              return (
                                <div key={player.id} className="scorer-button-group">
                                  <button
                                    className={`scorer-btn ${goals > 0 ? 'has-goals' : ''}`}
                                    onClick={() =>
                                      toggleScorer(
                                        player.id,
                                        'red',
                                        editRedScorers,
                                        setEditRedScorers
                                      )
                                    }
                                  >
                                    {player.name} {goals > 0 && `(${goals})`}
                                  </button>
                                  {goals > 0 && (
                                    <button
                                      className="add-goal-btn"
                                      onClick={() =>
                                        addMultipleGoals(
                                          player.id,
                                          editRedScorers,
                                          setEditRedScorers
                                        )
                                      }
                                    >
                                      +
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="team-scorers">
                          <h4>White Team Scorers (optional)</h4>
                          <div className="scorer-buttons">
                            {match.whiteTeam.map((player) => {
                              const goals = countGoals(player.id, editWhiteScorers);
                              return (
                                <div key={player.id} className="scorer-button-group">
                                  <button
                                    className={`scorer-btn ${goals > 0 ? 'has-goals' : ''}`}
                                    onClick={() =>
                                      toggleScorer(
                                        player.id,
                                        'white',
                                        editWhiteScorers,
                                        setEditWhiteScorers
                                      )
                                    }
                                  >
                                    {player.name} {goals > 0 && `(${goals})`}
                                  </button>
                                  {goals > 0 && (
                                    <button
                                      className="add-goal-btn"
                                      onClick={() =>
                                        addMultipleGoals(
                                          player.id,
                                          editWhiteScorers,
                                          setEditWhiteScorers
                                        )
                                      }
                                    >
                                      +
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="editor-actions">
                        <button onClick={() => saveResult(match.id)} className="btn btn-primary">
                          Save Result
                        </button>
                        <button onClick={cancelEditing} className="btn btn-secondary">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="teams-overview">
                        <div className="team-list red-team-list">
                          <h4>Red Team (OVR: {match.redTeamOvr})</h4>
                          <ul>
                            {match.redTeam.map((player) => (
                              <li key={player.id}>
                                <img
                                  src={player.photoUrl ? getCloudinaryImageUrl(player.photoUrl) : placeholder}
                                  alt={player.name}
                                  className="mini-photo"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = placeholder;
                                  }}
                                />
                                {player.name}
                                {player.isCaptain && <span className="captain-badge-small">C</span>}
                                {match.redScorers.includes(player.id) && (
                                  <span className="goal-icon">
                                    ⚽ x{countGoals(player.id, match.redScorers)}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="team-list white-team-list">
                          <h4>White Team (OVR: {match.whiteTeamOvr})</h4>
                          <ul>
                            {match.whiteTeam.map((player) => (
                              <li key={player.id}>
                                <img
                                  src={player.photoUrl ? getCloudinaryImageUrl(player.photoUrl) : placeholder}
                                  alt={player.name}
                                  className="mini-photo"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = placeholder;
                                  }}
                                />
                                {player.name}
                                {player.isCaptain && <span className="captain-badge-small">C</span>}
                                {match.whiteScorers.includes(player.id) && (
                                  <span className="goal-icon">
                                    ⚽ x{countGoals(player.id, match.whiteScorers)}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="result-actions">
                        <button onClick={() => startEditing(match)} className="btn btn-primary">
                          {match.status === 'pending' ? 'Add Result' : 'Edit Result'}
                        </button>
                        <button
                          onClick={() => handleDeleteMatch(match.id)}
                          className="btn btn-danger"
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
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

      {confirmDelete && (
        <Confirm
          isOpen={true}
          onClose={() => setConfirmDelete(null)}
          onConfirm={confirmDeleteMatch}
          title="Delete Match"
          message="Are you sure you want to delete this match? This action cannot be undone."
          confirmText="Delete"
          type="error"
        />
      )}
    </div>
  );
}
