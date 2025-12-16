import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useData } from '../context/DataContext';
import type { Player, Position } from '../types';
import { createPlayer, updatePlayer, deletePlayer } from '../services/firebase';
import { uploadImageToCloudflare, getCloudflareImageUrl } from '../services/cloudflare';
import { calculateOVR } from '../utils/calculations';
import { Alert, Confirm } from '../components/Modal';
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

type SortField = 'ovr' | 'workRate' | 'attack' | 'defence' | 'ballUse' | 'name';
type SortOrder = 'asc' | 'desc';

export function Configuration() {
  const { players, refreshPlayers } = useData();
  const [showForm, setShowForm] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [formData, setFormData] = useState<PlayerFormData>(initialFormData);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('ovr');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [groupByPosition, setGroupByPosition] = useState(false);
  const [alertMessage, setAlertMessage] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ playerId: string; playerName: string } | null>(null);

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
    // Convert Cloudflare image ID to full URL for preview
    const imageUrl = player.photoUrl ? getCloudflareImageUrl(player.photoUrl) : null;
    setPhotoPreview(imageUrl);
    setShowForm(true);
  };

  const handleDeletePlayer = (player: Player) => {
    setConfirmDelete({ playerId: player.id, playerName: player.name });
  };

  const confirmDeletePlayer = async () => {
    if (!confirmDelete) return;

    try {
      await deletePlayer(confirmDelete.playerId);
      await refreshPlayers();
    } catch (err) {
      console.error('Error deleting player:', err);
      setAlertMessage({ message: 'Failed to delete player', type: 'error' });
    } finally {
      setConfirmDelete(null);
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
      let photoImageId = formData.photoUrl; // Now stores Cloudflare image ID

      // Upload photo if a new one was selected
      if (photoFile) {
        try {
          const tempId = editingPlayerId || 'temp-' + Date.now();
          photoImageId = await uploadImageToCloudflare(photoFile, tempId);
        } catch (uploadErr) {
          console.error('Cloudflare upload failed:', uploadErr);
          // Continue without photo - will use placeholder
          photoImageId = '';
          setAlertMessage({
            message: 'Photo upload failed. Player saved with placeholder image.',
            type: 'info'
          });
        }
      }

      const playerData = {
        name: formData.name.trim(),
        fitness: formData.fitness,
        defence: formData.defence,
        attack: formData.attack,
        ballUse: formData.ballUse,
        position: formData.position,
        photoUrl: photoImageId, // Store Cloudflare image ID
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

  // Sort and group players
  const getSortedPlayers = () => {
    let sortedPlayers = [...players];

    // Sort by selected field
    sortedPlayers.sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;

      switch (sortField) {
        case 'ovr':
          aValue = a.ovr;
          bValue = b.ovr;
          break;
        case 'workRate':
          aValue = a.fitness;
          bValue = b.fitness;
          break;
        case 'attack':
          aValue = a.attack;
          bValue = b.attack;
          break;
        case 'defence':
          aValue = a.defence;
          bValue = b.defence;
          break;
        case 'ballUse':
          aValue = a.ballUse;
          bValue = b.ballUse;
          break;
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        default:
          aValue = a.ovr;
          bValue = b.ovr;
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });

    if (groupByPosition) {
      // Group by position: DEF, ATT, ALR
      const defenders = sortedPlayers.filter(p => p.position === 'DEF');
      const attackers = sortedPlayers.filter(p => p.position === 'ATT');
      const allRounders = sortedPlayers.filter(p => p.position === 'ALR');
      return [...defenders, ...attackers, ...allRounders];
    }

    return sortedPlayers;
  };

  const displayedPlayers = getSortedPlayers();

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
                    Work Rate <span className="weight">(35%)</span>
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

        {players.length > 0 && (
          <div className="players-sort-controls">
            <div className="sort-control-group">
              <label htmlFor="sortField">Sort by:</label>
              <select
                id="sortField"
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
              >
                <option value="ovr">OVR</option>
                <option value="workRate">Work Rate</option>
                <option value="attack">Attack</option>
                <option value="defence">Defence</option>
                <option value="ballUse">Ball Use</option>
                <option value="name">Name</option>
              </select>
            </div>

            <div className="sort-control-group">
              <label htmlFor="sortOrder">Order:</label>
              <select
                id="sortOrder"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              >
                <option value="desc">Highest to Lowest</option>
                <option value="asc">Lowest to Highest</option>
              </select>
            </div>

            <div className="sort-control-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={groupByPosition}
                  onChange={(e) => setGroupByPosition(e.target.checked)}
                />
                <span>Group by Position</span>
              </label>
            </div>
          </div>
        )}

        {players.length === 0 ? (
          <p className="no-players">No players added yet. Add your first player above.</p>
        ) : (
          <div className="players-grid">
            {displayedPlayers.map((player) => (
              <div key={player.id} className="player-card-config">
                <img
                  src={player.photoUrl ? getCloudflareImageUrl(player.photoUrl) : placeholder}
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
                    <span>WR: {player.fitness}</span>
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
                    onClick={() => handleDeletePlayer(player)}
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
          onConfirm={confirmDeletePlayer}
          title="Delete Player"
          message={`Are you sure you want to delete ${confirmDelete.playerName}? This action cannot be undone.`}
          confirmText="Delete"
          type="error"
        />
      )}
    </div>
  );
}
