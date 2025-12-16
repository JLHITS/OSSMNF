import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Player, Match } from '../types';
import { getPlayers, getMatches } from '../services/firebase';

interface DataContextType {
  players: Player[];
  matches: Match[];
  loading: boolean;
  error: string | null;
  refreshPlayers: () => Promise<void>;
  refreshMatches: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshPlayers = useCallback(async () => {
    try {
      const data = await getPlayers();
      setPlayers(data);
    } catch (err) {
      console.error('Error fetching players:', err);
      setError('Failed to load players');
    }
  }, []);

  const refreshMatches = useCallback(async () => {
    try {
      const data = await getMatches();
      setMatches(data);
    } catch (err) {
      console.error('Error fetching matches:', err);
      setError('Failed to load matches');
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([refreshPlayers(), refreshMatches()]);
    } finally {
      setLoading(false);
    }
  }, [refreshPlayers, refreshMatches]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  return (
    <DataContext.Provider
      value={{
        players,
        matches,
        loading,
        error,
        refreshPlayers,
        refreshMatches,
        refreshAll,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
