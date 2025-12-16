import { type ReactNode } from 'react';
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
import { getCloudflareImageUrl } from '../services/cloudflare';
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
}

// Formation configurations: [back row, middle row, front row]
const FORMATIONS: Record<number, number[]> = {
  5: [2, 2, 1], // 5v5: 2-2-1
  6: [2, 2, 2], // 6v6: 2-2-2
  7: [2, 3, 2], // 7v7: 2-3-2
  8: [3, 3, 2], // 8v8: 3-3-2
  9: [3, 3, 3], // 9v9: 3-3-3
};

function DraggablePlayerCard({ player, team, showRatings }: PlayerCardProps) {
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
          src={player.photoUrl ? getCloudflareImageUrl(player.photoUrl) : placeholder}
          alt={player.name}
          className="player-photo"
          onError={(e) => {
            (e.target as HTMLImageElement).src = placeholder;
          }}
        />
        {player.isCaptain && (
          <span className="captain-badge" title="Captain">
            C
          </span>
        )}
      </div>
      <span className="player-name">{player.name}</span>
      {showRatings && <span className="player-ovr">{player.ovr}</span>}
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
  showRatings,
}: FootballPitchProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const sourceTeam = active.data.current?.team as 'red' | 'white';
    const destTeam = over.id as 'red' | 'white';

    if (sourceTeam === destTeam) return;

    const draggedPlayer = active.data.current?.player as TeamPlayer;
    const allPlayers = [...redTeam, ...whiteTeam];
    const targetPlayer = allPlayers.find(
      (p) => p.id === over.data.current?.player?.id
    );

    if (!targetPlayer) return;

    let newRedTeam = [...redTeam];
    let newWhiteTeam = [...whiteTeam];

    if (sourceTeam === 'red') {
      newRedTeam = newRedTeam.filter((p) => p.id !== draggedPlayer.id);
      newWhiteTeam = newWhiteTeam.map((p) =>
        p.id === targetPlayer.id ? draggedPlayer : p
      );
      newRedTeam.push(targetPlayer);
    } else {
      newWhiteTeam = newWhiteTeam.filter((p) => p.id !== draggedPlayer.id);
      newRedTeam = newRedTeam.map((p) =>
        p.id === targetPlayer.id ? draggedPlayer : p
      );
      newWhiteTeam.push(targetPlayer);
    }

    onTeamsChange(newRedTeam, newWhiteTeam);
  };

  const renderTeamFormation = (team: TeamPlayer[], teamName: 'red' | 'white') => {
    const formation = FORMATIONS[team.length] || [3, 3, 3];
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
                <DraggablePlayerCard
                  player={player}
                  team={teamName}
                  showRatings={showRatings}
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

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
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

          <DroppableZone id="white" className="team-half white-half">
            {renderTeamFormation(whiteTeam, 'white')}
          </DroppableZone>

          <DroppableZone id="red" className="team-half red-half">
            {renderTeamFormation(redTeam, 'red')}
          </DroppableZone>
        </div>

        {showRatings && (
          <div className="teams-stats-row">
            <div className="team-stats red-stats">
              <h3>Reds</h3>
              <p className="team-ovr">AVG OVR: {calculateTeamOvr(redTeam)}</p>
              <p className="team-total">
                Total: {redTeam.reduce((sum, p) => sum + p.ovr, 0).toFixed(1)}
              </p>
            </div>

            <div className="team-stats white-stats">
              <h3>Non-Reds</h3>
              <p className="team-ovr">AVG OVR: {calculateTeamOvr(whiteTeam)}</p>
              <p className="team-total">
                Total: {whiteTeam.reduce((sum, p) => sum + p.ovr, 0).toFixed(1)}
              </p>
            </div>
          </div>
        )}
      </div>
    </DndContext>
  );
}
