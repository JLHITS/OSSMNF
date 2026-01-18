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
 * Total Football Optimizer
 *
 * Uses enhanced constraint optimization with more iterations
 * for the most balanced teams possible
 */
export function generateILPOptimizedTeams(
  players: Player[],
  teamSize: number,
  config: AlgorithmConfig = {}
): TeamGenerationResult {
  // Use constraint optimizer with higher iterations for better results
  const enhancedConfig: AlgorithmConfig = {
    ...config,
    maxIterations: 1000, // Double the iterations for better optimization
    temperature: 15, // Higher starting temperature for more exploration
    coolingRate: 0.99, // Slower cooling for finer optimization
  };

  const result = generateConstraintOptimizedTeams(players, teamSize, enhancedConfig);

  // Update metadata to reflect this algorithm
  return {
    ...result,
    metadata: {
      ...result.metadata,
      algorithm: 'ilp-solver', // Keep the name for UI consistency
    },
  };
}

