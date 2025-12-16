import type { Player, Position, TeamPlayer, MatchSize, Match } from '../types';

export function calculateOVR(
  fitness: number,
  defence: number,
  attack: number,
  ballUse: number,
  position: Position
): number {
  let adjustedDefence = defence;
  let adjustedAttack = attack;

  // Modifiers: 15% bonus/penalty to make position choice meaningful
  switch (position) {
    case 'DEF':
      adjustedDefence = defence * 1.15;
      adjustedAttack = attack * 0.85;
      break;
    case 'ATT':
      adjustedAttack = attack * 1.15;
      adjustedDefence = defence * 0.85;
      break;
    case 'ALR':
      // No modifier - balanced player
      break;
  }

  const ovr =
    fitness * 0.35 +
    adjustedDefence * 0.25 +
    adjustedAttack * 0.2 +
    ballUse * 0.2;

  return Math.round(ovr * 10) / 10;
}

export function getTeamSize(matchSize: MatchSize): number {
  const sizes: Record<MatchSize, number> = {
    '5v5': 5,
    '6v6': 6,
    '7v7': 7,
    '8v8': 8,
    '9v9': 9,
  };
  return sizes[matchSize];
}

export function calculateTeamOVR(players: TeamPlayer[]): number {
  if (players.length === 0) return 0;
  const totalOvr = players.reduce((sum, player) => sum + player.ovr, 0);
  return Math.round((totalOvr / players.length) * 10) / 10;
}

/**
 * Team Generation Algorithm
 *
 * This algorithm creates the fairest possible teams by:
 * 1. Sorting players by OVR (highest to lowest)
 * 2. Using a "snake draft" approach where teams alternate picks
 * 3. Trying to balance positions across teams
 * 4. Fine-tuning by swapping players to minimize OVR difference
 */
export function generateBalancedTeams(
  players: Player[],
  teamSize: number
): { redTeam: TeamPlayer[]; whiteTeam: TeamPlayer[] } {
  if (players.length < teamSize * 2) {
    throw new Error(`Need at least ${teamSize * 2} players for ${teamSize}v${teamSize}`);
  }

  // Take only the required number of players (prioritize by OVR)
  const sortedPlayers = [...players].sort((a, b) => b.ovr - a.ovr);
  const selectedPlayers = sortedPlayers.slice(0, teamSize * 2);

  // Group by position for balanced distribution
  const defenders = selectedPlayers.filter((p) => p.position === 'DEF');
  const attackers = selectedPlayers.filter((p) => p.position === 'ATT');
  const allRounders = selectedPlayers.filter((p) => p.position === 'ALR');

  // Initial team assignment using snake draft
  let redTeam: TeamPlayer[] = [];
  let whiteTeam: TeamPlayer[] = [];

  // Distribute positions evenly first
  const distributePosition = (positionPlayers: Player[]) => {
    positionPlayers.sort((a, b) => b.ovr - a.ovr);
    positionPlayers.forEach((player, index) => {
      const teamPlayer: TeamPlayer = { ...player, isCaptain: false };
      if (index % 2 === 0) {
        if (redTeam.length < teamSize) {
          redTeam.push(teamPlayer);
        } else {
          whiteTeam.push(teamPlayer);
        }
      } else {
        if (whiteTeam.length < teamSize) {
          whiteTeam.push(teamPlayer);
        } else {
          redTeam.push(teamPlayer);
        }
      }
    });
  };

  distributePosition(defenders);
  distributePosition(attackers);
  distributePosition(allRounders);

  // Balance team sizes if needed
  while (redTeam.length > teamSize) {
    const player = redTeam.pop()!;
    whiteTeam.push(player);
  }
  while (whiteTeam.length > teamSize) {
    const player = whiteTeam.pop()!;
    redTeam.push(player);
  }

  // Fine-tune: Try swapping players to minimize OVR difference
  let improved = true;
  let iterations = 0;
  const maxIterations = 100;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    const redOvr = redTeam.reduce((sum, p) => sum + p.ovr, 0);
    const whiteOvr = whiteTeam.reduce((sum, p) => sum + p.ovr, 0);
    const currentDiff = Math.abs(redOvr - whiteOvr);

    for (let i = 0; i < redTeam.length && !improved; i++) {
      for (let j = 0; j < whiteTeam.length && !improved; j++) {
        // Calculate new difference if we swap these players
        const newRedOvr = redOvr - redTeam[i].ovr + whiteTeam[j].ovr;
        const newWhiteOvr = whiteOvr - whiteTeam[j].ovr + redTeam[i].ovr;
        const newDiff = Math.abs(newRedOvr - newWhiteOvr);

        if (newDiff < currentDiff) {
          // Swap players
          const temp = redTeam[i];
          redTeam[i] = whiteTeam[j];
          whiteTeam[j] = temp;
          improved = true;
        }
      }
    }
  }

  // Assign random captains
  const redCaptainIndex = Math.floor(Math.random() * redTeam.length);
  const whiteCaptainIndex = Math.floor(Math.random() * whiteTeam.length);
  redTeam[redCaptainIndex].isCaptain = true;
  whiteTeam[whiteCaptainIndex].isCaptain = true;

  return { redTeam, whiteTeam };
}

/**
 * Calculate player form (last 5 matches) and current streak
 */
export function calculatePlayerForm(
  playerId: string,
  matches: Match[]
): { form: ('W' | 'L' | 'D')[]; streak: { type: 'W' | 'L' | 'D' | 'none'; count: number }; captainCount: number } {
  // Filter completed matches where player participated, sorted by date descending
  const playerMatches = matches
    .filter((match) => {
      if (match.status !== 'completed') return false;
      const inRed = match.redTeam.some((p) => p.id === playerId);
      const inWhite = match.whiteTeam.some((p) => p.id === playerId);
      return inRed || inWhite;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Count captain appearances
  let captainCount = 0;
  matches.forEach((match) => {
    const redPlayer = match.redTeam.find((p) => p.id === playerId);
    const whitePlayer = match.whiteTeam.find((p) => p.id === playerId);
    if (redPlayer?.isCaptain || whitePlayer?.isCaptain) {
      captainCount++;
    }
  });

  // Calculate form for last 5 matches
  const form: ('W' | 'L' | 'D')[] = [];
  for (let i = 0; i < Math.min(5, playerMatches.length); i++) {
    const match = playerMatches[i];
    const inRed = match.redTeam.some((p) => p.id === playerId);

    if (match.redScore === null || match.whiteScore === null) continue;

    if (match.redScore === match.whiteScore) {
      form.push('D');
    } else if (inRed) {
      form.push(match.redScore > match.whiteScore ? 'W' : 'L');
    } else {
      form.push(match.whiteScore > match.redScore ? 'W' : 'L');
    }
  }

  // Calculate current streak
  let streak: { type: 'W' | 'L' | 'D' | 'none'; count: number } = { type: 'none', count: 0 };
  if (form.length > 0) {
    const streakType = form[0];
    let count = 0;
    for (const result of form) {
      if (result === streakType) {
        count++;
      } else {
        break;
      }
    }
    streak = { type: streakType, count };
  }

  return { form, streak, captainCount };
}

/**
 * Calculate the longest win streak a player has ever had
 */
export function calculateLongestWinStreak(playerId: string, matches: Match[]): number {
  // Get all completed matches for this player, sorted by date
  const playerMatches = matches
    .filter((match) => {
      if (match.status !== 'completed') return false;
      const inRed = match.redTeam.some((p) => p.id === playerId);
      const inWhite = match.whiteTeam.some((p) => p.id === playerId);
      return inRed || inWhite;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let longestStreak = 0;
  let currentStreak = 0;

  for (const match of playerMatches) {
    if (match.redScore === null || match.whiteScore === null) continue;

    const inRed = match.redTeam.some((p) => p.id === playerId);
    const won = inRed
      ? match.redScore > match.whiteScore
      : match.whiteScore > match.redScore;

    if (won) {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }

  return longestStreak;
}
