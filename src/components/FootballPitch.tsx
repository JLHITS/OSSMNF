import { useRef, type ReactNode } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core';
import type { TeamPlayer } from '../types';
import placeholder from '../assets/placeholder.png';

interface FootballPitchProps {
  redTeam: TeamPlayer[];
  whiteTeam: TeamPlayer[];
  onTeamsChange: (redTeam: TeamPlayer[], whiteTeam: TeamPlayer[]) => void;
  onCaptainChange: (playerId: string, team: 'red' | 'white') => void;
}

interface PlayerCardProps {
  player: TeamPlayer;
  team: 'red' | 'white';
  onCaptainClick: () => void;
}

function DraggablePlayerCard({ player, team, onCaptainClick }: PlayerCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: player.id,
    data: { player, team },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`player-card ${team}-team ${isDragging ? 'dragging' : ''}`}
    >
      <div className="player-photo-container">
        <img
          src={player.photoUrl || placeholder}
          alt={player.name}
          className="player-photo"
          onError={(e) => {
            (e.target as HTMLImageElement).src = placeholder;
          }}
        />
        {player.isCaptain && (
          <span className="captain-badge" title="Captain">C</span>
        )}
      </div>
      <span className="player-name">{player.name}</span>
      <span className="player-ovr">{player.ovr}</span>
      <button
        className="captain-toggle"
        onClick={(e) => {
          e.stopPropagation();
          onCaptainClick();
        }}
        title={player.isCaptain ? 'Remove captain' : 'Make captain'}
      >
        {player.isCaptain ? 'Remove C' : 'Make C'}
      </button>
    </div>
  );
}

function DroppableZone({
  id,
  children,
  className,
}: {
  id: string;
  children: ReactNode;
  className: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div ref={setNodeRef} className={`${className} ${isOver ? 'drop-active' : ''}`}>
      {children}
    </div>
  );
}

export function FootballPitch({
  redTeam,
  whiteTeam,
  onTeamsChange,
  onCaptainChange,
}: FootballPitchProps) {
  const pitchRef = useRef<HTMLDivElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8,
    },
  }));

  // 2-3-3 formation positions (relative to team half)
  const getFormationPositions = (teamSize: number): { row: number; col: number }[] => {
    // For 2-3-3 formation
    if (teamSize >= 8) {
      return [
        { row: 0, col: 1 }, { row: 0, col: 2 }, // 2 defenders
        { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 }, // 3 midfielders
        { row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 2 }, // 3 attackers
        { row: 0, col: 0 }, // extra if 9
      ];
    }
    if (teamSize === 7) {
      return [
        { row: 0, col: 0 }, { row: 0, col: 2 },
        { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 },
        { row: 2, col: 0 }, { row: 2, col: 2 },
      ];
    }
    if (teamSize === 6) {
      return [
        { row: 0, col: 0 }, { row: 0, col: 2 },
        { row: 1, col: 0 }, { row: 1, col: 2 },
        { row: 2, col: 0 }, { row: 2, col: 2 },
      ];
    }
    if (teamSize === 5) {
      return [
        { row: 0, col: 1 },
        { row: 1, col: 0 }, { row: 1, col: 2 },
        { row: 2, col: 0 }, { row: 2, col: 2 },
      ];
    }
    return [];
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const draggedPlayerId = active.id as string;
    const sourceTeam = (active.data.current as { team: 'red' | 'white' }).team;
    const targetTeam = over.id as 'red' | 'white';

    if (sourceTeam === targetTeam) return;

    // Find the dragged player
    const sourceArray = sourceTeam === 'red' ? [...redTeam] : [...whiteTeam];
    const targetArray = targetTeam === 'red' ? [...redTeam] : [...whiteTeam];

    const playerIndex = sourceArray.findIndex((p) => p.id === draggedPlayerId);
    if (playerIndex === -1) return;

    const [player] = sourceArray.splice(playerIndex, 1);
    player.isCaptain = false; // Reset captain when moving
    targetArray.push(player);

    if (sourceTeam === 'red') {
      onTeamsChange(sourceArray, targetArray);
    } else {
      onTeamsChange(targetArray, sourceArray);
    }
  };

  const positions = getFormationPositions(Math.max(redTeam.length, whiteTeam.length));

  const calculateRedOvr = () => {
    if (redTeam.length === 0) return 0;
    return (redTeam.reduce((sum, p) => sum + p.ovr, 0) / redTeam.length).toFixed(1);
  };

  const calculateWhiteOvr = () => {
    if (whiteTeam.length === 0) return 0;
    return (whiteTeam.reduce((sum, p) => sum + p.ovr, 0) / whiteTeam.length).toFixed(1);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="pitch-container" ref={pitchRef}>
        <div className="team-stats red-stats">
          <h3>Red Team</h3>
          <p className="team-ovr">AVG OVR: {calculateRedOvr()}</p>
          <p className="team-total">Total: {redTeam.reduce((sum, p) => sum + p.ovr, 0).toFixed(1)}</p>
        </div>

        <div className="football-pitch">
          <div className="pitch-markings">
            <div className="center-circle"></div>
            <div className="center-line"></div>
            <div className="penalty-area top"></div>
            <div className="penalty-area bottom"></div>
            <div className="goal-area top"></div>
            <div className="goal-area bottom"></div>
          </div>

          <DroppableZone id="white" className="team-half white-half">
            <div className="formation-grid">
              {whiteTeam.map((player, index) => {
                const pos = positions[index] || { row: 2, col: 1 };
                return (
                  <div
                    key={player.id}
                    className="formation-slot"
                    style={{
                      gridRow: pos.row + 1,
                      gridColumn: pos.col + 1,
                    }}
                  >
                    <DraggablePlayerCard
                      player={player}
                      team="white"
                      onCaptainClick={() => onCaptainChange(player.id, 'white')}
                    />
                  </div>
                );
              })}
            </div>
          </DroppableZone>

          <DroppableZone id="red" className="team-half red-half">
            <div className="formation-grid">
              {redTeam.map((player, index) => {
                const pos = positions[index] || { row: 2, col: 1 };
                return (
                  <div
                    key={player.id}
                    className="formation-slot"
                    style={{
                      gridRow: 3 - pos.row,
                      gridColumn: pos.col + 1,
                    }}
                  >
                    <DraggablePlayerCard
                      player={player}
                      team="red"
                      onCaptainClick={() => onCaptainChange(player.id, 'red')}
                    />
                  </div>
                );
              })}
            </div>
          </DroppableZone>
        </div>

        <div className="team-stats white-stats">
          <h3>White Team</h3>
          <p className="team-ovr">AVG OVR: {calculateWhiteOvr()}</p>
          <p className="team-total">Total: {whiteTeam.reduce((sum, p) => sum + p.ovr, 0).toFixed(1)}</p>
        </div>
      </div>
    </DndContext>
  );
}
