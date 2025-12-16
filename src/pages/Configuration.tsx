import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useData } from '../context/DataContext';
import type { Player, Position } from '../types';
import { createPlayer, updatePlayer, deletePlayer, uploadPlayerPhoto } from '../services/firebase';
import { calculateOVR } from '../utils/calculations';
import placeholder from '../assets/placeholder.png';

interface PlayerFormData {
  name: string;
  fitness: number;
  defence: number;
  attack: number;
  ballUse: number;
  position: Position;
  photoUrl: string;
}

const initialFormData: PlayerFormData = {
  name: '',
  fitness: 5,
  defence: 5,
  attack: 5,
  ballUse: 5,
  position: 'ALR',
  photoUrl: '',
};

export function Configuration() {
  const { players, refreshPlayers } = useData();
  const [showForm, setShowForm] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [formData, setFormData] = useState<PlayerFormData>(initialFormData);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculatedOVR = calculateOVR(
    formData.fitness,
    formData.defence,
    formData.attack,
    formData.ballUse,
    formData.position
  );

  const resetForm = () => {
    setFormData(initialFormData);
    setPhotoFile(null);
    setPhotoPreview(null);
    setEditingPlayerId(null);
    setShowForm(false);
    setError(null);
  };

  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'position' ? value : name === 'name' ? value : parseInt(value, 10),
    }));
  };

  const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditPlayer = (player: Player) => {
    setEditingPlayerId(player.id);
    setFormData({
      name: player.name,
      fitness: player.fitness,
      defence: player.defence,
      attack: player.attack,
      ballUse: player.ballUse,
      position: player.position,
      photoUrl: player.photoUrl,
    });
    setPhotoPreview(player.photoUrl || null);
    setShowForm(true);
  };

  const handleDeletePlayer = async (playerId: string) => {
    if (!confirm('Are you sure you want to delete this player?')) return;

    try {
      await deletePlayer(playerId);
      await refreshPlayers();
    } catch (err) {
      console.error('Error deleting player:', err);
      alert('Failed to delete player');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Player name is required');
      return;
    }

    setSaving(true);

    try {
      let photoUrl = formData.photoUrl;

      // Upload photo if a new one was selected
      if (photoFile) {
        const tempId = editingPlayerId || 'new';
        photoUrl = await uploadPlayerPhoto(tempId, photoFile);
      }

      const playerData = {
        name: formData.name.trim(),
        fitness: formData.fitness,
        defence: formData.defence,
        attack: formData.attack,
        ballUse: formData.ballUse,
        position: formData.position,
        photoUrl,
        ovr: calculatedOVR,
      };

      if (editingPlayerId) {
        await updatePlayer(editingPlayerId, playerData);
      } else {
        await createPlayer(playerData);
      }

      await refreshPlayers();
      resetForm();
    } catch (err) {
      console.error('Error saving player:', err);
      setError('Failed to save player');
    } finally {
      setSaving(false);
    }
  };

  const getPositionLabel = (position: Position) => {
    const labels: Record<Position, string> = {
      DEF: 'Defender',
      ATT: 'Attacker',
      ALR: 'All Rounder',
    };
    return labels[position];
  };

  return (
    <div className="config-page">
      <div className="config-header">
        <h1>Player Configuration</h1>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="btn btn-primary">
            Add New Player
          </button>
        )}
      </div>

      {showForm && (
        <div className="player-form-container">
          <h2>{editingPlayerId ? 'Edit Player' : 'Add New Player'}</h2>
          <form onSubmit={handleSubmit} className="player-form">
            <div className="form-row">
              <div className="photo-upload">
                <div className="photo-preview">
                  <img
                    src={photoPreview || placeholder}
                    alt="Player"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = placeholder;
                    }}
                  />
                </div>
                <label className="photo-upload-btn">
                  Upload Photo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    hidden
                  />
                </label>
              </div>

              <div className="form-fields">
                <div className="form-group">
                  <label htmlFor="name">Name</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Player name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="position">Position</label>
                  <select
                    id="position"
                    name="position"
                    value={formData.position}
                    onChange={handleInputChange}
                  >
                    <option value="DEF">Defender (DEF)</option>
                    <option value="ATT">Attacker (ATT)</option>
                    <option value="ALR">All Rounder (ALR)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="ratings-section">
              <h3>Ratings (1-10)</h3>
              <div className="ratings-grid">
                <div className="rating-input">
                  <label htmlFor="fitness">
                    Fitness <span className="weight">(35%)</span>
                  </label>
                  <input
                    type="range"
                    id="fitness"
                    name="fitness"
                    min="1"
                    max="10"
                    value={formData.fitness}
                    onChange={handleInputChange}
                  />
                  <span className="rating-value">{formData.fitness}</span>
                </div>

                <div className="rating-input">
                  <label htmlFor="defence">
                    Defence <span className="weight">(25%)</span>
                    {formData.position === 'DEF' && <span className="modifier">x1.15</span>}
                    {formData.position === 'ATT' && <span className="modifier red">x0.85</span>}
                  </label>
                  <input
                    type="range"
                    id="defence"
                    name="defence"
                    min="1"
                    max="10"
                    value={formData.defence}
                    onChange={handleInputChange}
                  />
                  <span className="rating-value">{formData.defence}</span>
                </div>

                <div className="rating-input">
                  <label htmlFor="attack">
                    Attack <span className="weight">(20%)</span>
                    {formData.position === 'ATT' && <span className="modifier">x1.15</span>}
                    {formData.position === 'DEF' && <span className="modifier red">x0.85</span>}
                  </label>
                  <input
                    type="range"
                    id="attack"
                    name="attack"
                    min="1"
                    max="10"
                    value={formData.attack}
                    onChange={handleInputChange}
                  />
                  <span className="rating-value">{formData.attack}</span>
                </div>

                <div className="rating-input">
                  <label htmlFor="ballUse">
                    Ball Use <span className="weight">(20%)</span>
                  </label>
                  <input
                    type="range"
                    id="ballUse"
                    name="ballUse"
                    min="1"
                    max="10"
                    value={formData.ballUse}
                    onChange={handleInputChange}
                  />
                  <span className="rating-value">{formData.ballUse}</span>
                </div>
              </div>
            </div>

            <div className="ovr-display">
              <span className="ovr-label">Calculated OVR:</span>
              <span className="ovr-value">{calculatedOVR}</span>
            </div>

            {error && <p className="error-message">{error}</p>}

            <div className="form-actions">
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? 'Saving...' : editingPlayerId ? 'Update Player' : 'Add Player'}
              </button>
              <button type="button" onClick={resetForm} className="btn btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="players-list">
        <h2>Players ({players.length})</h2>
        {players.length === 0 ? (
          <p className="no-players">No players added yet. Add your first player above.</p>
        ) : (
          <div className="players-grid">
            {players.map((player) => (
              <div key={player.id} className="player-card-config">
                <img
                  src={player.photoUrl || placeholder}
                  alt={player.name}
                  className="player-config-photo"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = placeholder;
                  }}
                />
                <div className="player-config-info">
                  <h3>{player.name}</h3>
                  <p className="player-position">{getPositionLabel(player.position)}</p>
                  <div className="player-ratings">
                    <span>FIT: {player.fitness}</span>
                    <span>DEF: {player.defence}</span>
                    <span>ATT: {player.attack}</span>
                    <span>BU: {player.ballUse}</span>
                  </div>
                  <p className="player-ovr">OVR: {player.ovr}</p>
                </div>
                <div className="player-config-actions">
                  <button onClick={() => handleEditPlayer(player)} className="btn btn-small">
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeletePlayer(player.id)}
                    className="btn btn-small btn-danger"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
