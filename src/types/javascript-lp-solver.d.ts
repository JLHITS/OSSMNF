declare module 'javascript-lp-solver' {
  interface Model {
    optimize: string;
    opType: 'min' | 'max';
    constraints: Record<string, { min?: number; max?: number; equal?: number }>;
    variables: Record<string, Record<string, number>>;
    ints?: Record<string, number>;
    binaries?: Record<string, number>;
  }

  interface SolverResult {
    feasible: boolean;
    result: number;
    bounded: boolean;
    isIntegral?: boolean;
    [key: string]: number | boolean | undefined;
  }

  interface Solver {
    Solve(model: Model): SolverResult;
  }

  const solver: Solver;
  export default solver;
}
