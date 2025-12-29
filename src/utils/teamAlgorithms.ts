import solver from 'javascript-lp-solver';
import type {
  Player,
  TeamPlayer,
  Position,
  AlgorithmConfig,
  FairnessMetrics,
  TeamGenerationResult,
} from '../types';
import { generateBalancedTeams } from './calculations';

// Default configuration for algorithms
const DEFAULT_CONFIG: Required<AlgorithmConfig> = {
  maxIterations: 500,
  temperature: 10,
  coolingRate: 0.98,
  minPositions: { DEF: 1, ATT: 1, ALR: 0 },
  weights: {
    ovr: 1.0,
    fitness: 0.8,
    attack: 0.6,
    defence: 0.6,
    ballUse: 0.5,
    topHeaviness: 0.7,
    positionViolation: 10.0,
  },
};

/**
 * Calculate fairness score for a team split
 * Lower score = more balanced teams
 */
export function calculateFairnessScore(
  redTeam: TeamPlayer[],
  whiteTeam: TeamPlayer[],
  config: AlgorithmConfig = {}
): { score: number; metrics: FairnessMetrics } {
  const weights = { ...DEFAULT_CONFIG.weights, ...config.weights };
  const minPositions = { ...DEFAULT_CONFIG.minPositions, ...config.minPositions };

  // Sum attributes for each team
  const sumAttr = (team: TeamPlayer[], attr: keyof Player) =>
    team.reduce((sum, p) => sum + (p[attr] as number), 0);

  const metrics: FairnessMetrics = {
    ovrDiff: Math.abs(sumAttr(redTeam, 'ovr') - sumAttr(whiteTeam, 'ovr')),
    fitnessDiff: Math.abs(sumAttr(redTeam, 'fitness') - sumAttr(whiteTeam, 'fitness')),
    attackDiff: Math.abs(sumAttr(redTeam, 'attack') - sumAttr(whiteTeam, 'attack')),
    defenceDiff: Math.abs(sumAttr(redTeam, 'defence') - sumAttr(whiteTeam, 'defence')),
    ballUseDiff: Math.abs(sumAttr(redTeam, 'ballUse') - sumAttr(whiteTeam, 'ballUse')),
    topHeavinessDiff: calculateTopHeaviness(redTeam, whiteTeam),
    positionViolations: countPositionViolations(redTeam, whiteTeam, minPositions),
  };

  const score =
    metrics.ovrDiff * weights.ovr +
    metrics.fitnessDiff * weights.fitness +
    metrics.attackDiff * weights.attack +
    metrics.defenceDiff * weights.defence +
    metrics.ballUseDiff * weights.ballUse +
    metrics.topHeavinessDiff * weights.topHeaviness +
    metrics.positionViolations * weights.positionViolation;

  return { score, metrics };
}

/**
 * Calculate top-heaviness difference (sum of top 3 OVRs per team)
 */
function calculateTopHeaviness(redTeam: TeamPlayer[], whiteTeam: TeamPlayer[]): number {
  const topCount = Math.min(3, Math.floor(redTeam.length / 2));

  const getTopSum = (team: TeamPlayer[]) =>
    [...team]
      .sort((a, b) => b.ovr - a.ovr)
      .slice(0, topCount)
      .reduce((sum, p) => sum + p.ovr, 0);

  return Math.abs(getTopSum(redTeam) - getTopSum(whiteTeam));
}

/**
 * Count position constraint violations
 */
function countPositionViolations(
  redTeam: TeamPlayer[],
  whiteTeam: TeamPlayer[],
  minPositions: { DEF: number; ATT: number; ALR: number }
): number {
  let violations = 0;

  for (const team of [redTeam, whiteTeam]) {
    const counts: Record<Position, number> = { DEF: 0, ATT: 0, ALR: 0 };
    team.forEach((p) => counts[p.position]++);

    for (const pos of ['DEF', 'ATT', 'ALR'] as const) {
      if (counts[pos] < minPositions[pos]) {
        violations += minPositions[pos] - counts[pos];
      }
    }
  }

  return violations;
}

/**
 * Generate a swap neighbor for simulated annealing
 */
function generateSwap(
  red: TeamPlayer[],
  white: TeamPlayer[],
  type: '1-for-1' | '2-for-2'
): { newRed: TeamPlayer[]; newWhite: TeamPlayer[] } {
  const newRed = [...red];
  const newWhite = [...white];

  if (type === '1-for-1') {
    const redIdx = Math.floor(Math.random() * newRed.length);
    const whiteIdx = Math.floor(Math.random() * newWhite.length);
    [newRed[redIdx], newWhite[whiteIdx]] = [newWhite[whiteIdx], newRed[redIdx]];
  } else {
    // 2-for-2 swap
    const redIdx1 = Math.floor(Math.random() * newRed.length);
    let redIdx2 = Math.floor(Math.random() * newRed.length);
    while (redIdx2 === redIdx1 && newRed.length > 1) {
      redIdx2 = Math.floor(Math.random() * newRed.length);
    }

    const whiteIdx1 = Math.floor(Math.random() * newWhite.length);
    let whiteIdx2 = Math.floor(Math.random() * newWhite.length);
    while (whiteIdx2 === whiteIdx1 && newWhite.length > 1) {
      whiteIdx2 = Math.floor(Math.random() * newWhite.length);
    }

    [newRed[redIdx1], newWhite[whiteIdx1]] = [newWhite[whiteIdx1], newRed[redIdx1]];
    [newRed[redIdx2], newWhite[whiteIdx2]] = [newWhite[whiteIdx2], newRed[redIdx2]];
  }

  return { newRed, newWhite };
}

/**
 * Assign random captains to both teams
 */
function assignRandomCaptains(red: TeamPlayer[], white: TeamPlayer[]): void {
  red.forEach((p) => (p.isCaptain = false));
  white.forEach((p) => (p.isCaptain = false));
  red[Math.floor(Math.random() * red.length)].isCaptain = true;
  white[Math.floor(Math.random() * white.length)].isCaptain = true;
}

/**
 * Constraint Optimizer using Simulated Annealing
 *
 * 1. Seeds with snake draft result
 * 2. Uses simulated annealing to optimize fairness score
 * 3. Considers all attributes, not just OVR
 * 4. Tries 1-for-1 and occasionally 2-for-2 swaps
 */
export function generateConstraintOptimizedTeams(
  players: Player[],
  teamSize: number,
  config: AlgorithmConfig = {}
): TeamGenerationResult {
  const startTime = performance.now();
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  // Seed with snake draft result
  const { redTeam, whiteTeam } = generateBalancedTeams(players, teamSize);

  // Simulated annealing parameters
  const maxIterations = mergedConfig.maxIterations;
  let temperature = mergedConfig.temperature;
  const coolingRate = mergedConfig.coolingRate;
  const minTemperature = 0.01;

  let currentRed = [...redTeam];
  let currentWhite = [...whiteTeam];
  let currentScore = calculateFairnessScore(currentRed, currentWhite, mergedConfig).score;

  let bestRed = currentRed.map((p) => ({ ...p }));
  let bestWhite = currentWhite.map((p) => ({ ...p }));
  let bestScore = currentScore;

  let iterations = 0;

  while (iterations < maxIterations && temperature > minTemperature) {
    iterations++;

    // Generate neighbor solution (80% 1-for-1, 20% 2-for-2)
    const swapType = Math.random() < 0.8 ? '1-for-1' : '2-for-2';
    const { newRed, newWhite } = generateSwap(currentRed, currentWhite, swapType);

    const newScore = calculateFairnessScore(newRed, newWhite, mergedConfig).score;
    const delta = newScore - currentScore;

    // Accept if better, or probabilistically if worse (simulated annealing)
    if (delta < 0 || Math.random() < Math.exp(-delta / temperature)) {
      currentRed = newRed;
      currentWhite = newWhite;
      currentScore = newScore;

      if (currentScore < bestScore) {
        bestRed = currentRed.map((p) => ({ ...p }));
        bestWhite = currentWhite.map((p) => ({ ...p }));
        bestScore = currentScore;
      }
    }

    temperature *= coolingRate;
  }

  // Assign random captains
  assignRandomCaptains(bestRed, bestWhite);

  return {
    redTeam: bestRed,
    whiteTeam: bestWhite,
    metadata: {
      algorithm: 'constraint-opt',
      fairnessScore: bestScore,
      iterations,
      timeMs: Math.round(performance.now() - startTime),
    },
  };
}

/**
 * ILP Solver Optimizer
 *
 * Uses Integer Linear Programming to find the optimal team split
 * Minimizes weighted attribute differences while respecting constraints
 */
export function generateILPOptimizedTeams(
  players: Player[],
  teamSize: number,
  config: AlgorithmConfig = {}
): TeamGenerationResult {
  const startTime = performance.now();
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  // Take top players by OVR
  const sortedPlayers = [...players].sort((a, b) => b.ovr - a.ovr);
  const selectedPlayers = sortedPlayers.slice(0, teamSize * 2);

  // Check if we have enough players for each position
  const posCounts: Record<Position, number> = { DEF: 0, ATT: 0, ALR: 0 };
  selectedPlayers.forEach((p) => posCounts[p.position]++);

  // Adjust minPositions if we don't have enough of a position
  const adjustedMinPos = { ...mergedConfig.minPositions };
  for (const pos of ['DEF', 'ATT', 'ALR'] as const) {
    // Each team needs minPositions[pos], so total needed is minPositions[pos] * 2
    const totalNeeded = adjustedMinPos[pos] * 2;
    if (posCounts[pos] < totalNeeded) {
      adjustedMinPos[pos] = Math.floor(posCounts[pos] / 2);
    }
  }

  try {
    const model = buildILPModel(selectedPlayers, teamSize, adjustedMinPos, mergedConfig.weights);
    const results = solver.Solve(model);

    if (!results.feasible) {
      console.warn('ILP solver found no feasible solution, falling back to constraint optimizer');
      return generateConstraintOptimizedTeams(players, teamSize, config);
    }

    // Extract teams from solution
    // Sort players by their assignment value and take top teamSize for Red
    // This guarantees equal team sizes regardless of solver precision
    const playerScores: Array<{ player: Player; score: number }> = selectedPlayers.map((player, i) => {
      const rawScore = results[`x${i}`];
      return {
        player,
        score: typeof rawScore === 'number' ? rawScore : 0,
      };
    });

    // Sort by score descending - players with higher scores go to Red
    playerScores.sort((a, b) => b.score - a.score);

    const redTeam: TeamPlayer[] = playerScores
      .slice(0, teamSize)
      .map(({ player }) => ({ ...player, isCaptain: false }));
    const whiteTeam: TeamPlayer[] = playerScores
      .slice(teamSize)
      .map(({ player }) => ({ ...player, isCaptain: false }));

    assignRandomCaptains(redTeam, whiteTeam);

    const { score } = calculateFairnessScore(redTeam, whiteTeam, mergedConfig);

    return {
      redTeam,
      whiteTeam,
      metadata: {
        algorithm: 'ilp-solver',
        fairnessScore: score,
        timeMs: Math.round(performance.now() - startTime),
      },
    };
  } catch (error) {
    console.error('ILP solver error:', error);
    return generateConstraintOptimizedTeams(players, teamSize, config);
  }
}

/**
 * Build the ILP model for team optimization
 */
function buildILPModel(
  players: Player[],
  teamSize: number,
  minPositions: { DEF: number; ATT: number; ALR: number },
  weights: Required<AlgorithmConfig>['weights']
): {
  optimize: string;
  opType: 'min' | 'max';
  constraints: Record<string, { min?: number; max?: number; equal?: number }>;
  variables: Record<string, Record<string, number>>;
  ints: Record<string, number>;
} {
  // Calculate totals for centering
  const totals = {
    ovr: players.reduce((s, p) => s + p.ovr, 0),
    fitness: players.reduce((s, p) => s + p.fitness, 0),
    attack: players.reduce((s, p) => s + p.attack, 0),
    defence: players.reduce((s, p) => s + p.defence, 0),
    ballUse: players.reduce((s, p) => s + p.ballUse, 0),
  };

  // The model structure for javascript-lp-solver
  const model: {
    optimize: string;
    opType: 'min' | 'max';
    constraints: Record<string, { min?: number; max?: number; equal?: number }>;
    variables: Record<string, Record<string, number>>;
    ints: Record<string, number>;
  } = {
    optimize: 'cost',
    opType: 'min' as const,
    constraints: {
      // Team size: exactly teamSize players on Red
      teamSize: { equal: teamSize },
      // Position constraints for Red team
      redDEF: { min: minPositions.DEF },
      redATT: { min: minPositions.ATT },
      redALR: { min: minPositions.ALR },
    },
    variables: {},
    ints: {},
  };

  // Add player variables
  players.forEach((player, i) => {
    const varName = `x${i}`;
    model.variables[varName] = {
      teamSize: 1,
      // Position tracking
      redDEF: player.position === 'DEF' ? 1 : 0,
      redATT: player.position === 'ATT' ? 1 : 0,
      redALR: player.position === 'ALR' ? 1 : 0,
    };
    model.ints[varName] = 1; // Binary variable
  });

  // For each attribute, we want to minimize |Red_sum - White_sum|
  // Since White_sum = Total - Red_sum, we want to minimize |2*Red_sum - Total|
  // We use slack variables to linearize the absolute value
  const attributes = ['ovr', 'fitness', 'attack', 'defence', 'ballUse'] as const;

  attributes.forEach((attr) => {
    const halfTotal = totals[attr] / 2;
    const constraintName = `${attr}Balance`;

    // Constraint: Red_sum - slack_plus + slack_minus = halfTotal
    // We want Red_sum close to halfTotal
    model.constraints[constraintName] = { equal: halfTotal };

    // Add attribute contribution to each player variable
    players.forEach((player, i) => {
      const varName = `x${i}`;
      model.variables[varName][constraintName] = player[attr];
    });

    // Slack variables for absolute value linearization
    const plusVar = `slack_${attr}_plus`;
    const minusVar = `slack_${attr}_minus`;

    model.variables[plusVar] = {
      [constraintName]: 1,
      cost: weights[attr],
    };
    model.variables[minusVar] = {
      [constraintName]: -1,
      cost: weights[attr],
    };
  });

  // Elite player balance: try to split top players evenly
  // Scale elite count based on team size (for 8v8 use top 4, for smaller teams use fewer)
  const eliteCount = Math.min(4, Math.floor(teamSize / 2) * 2); // 2 for 5-6, 4 for 7+
  const elitePerTeam = eliteCount / 2;

  if (eliteCount >= 2 && teamSize >= 5) {
    const sortedByOvr = [...players].sort((a, b) => b.ovr - a.ovr);
    const eliteIndices = sortedByOvr.slice(0, eliteCount).map((p) => players.indexOf(p));

    if (eliteIndices.length >= eliteCount) {
      model.constraints['eliteBalance'] = { min: elitePerTeam, max: elitePerTeam };
      eliteIndices.forEach((i) => {
        model.variables[`x${i}`].eliteBalance = 1;
      });
    }
  }

  return model;
}
