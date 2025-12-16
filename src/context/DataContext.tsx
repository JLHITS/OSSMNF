import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Player, Match, PlayerAvailability, AvailabilityStatus } from '../types';
import { getPlayers, getMatches, getAvailability, batchUpdateAvailability } from '../services/firebase';

interface DataContextType {
  players: Player[];
  matches: Match[];
  availability: Map<string, PlayerAvailability>;
  loading: boolean;
  error: string | null;
  refreshPlayers: () => Promise<void>;
  refreshMatches: () => Promise<void>;
  refreshAvailability: () => Promise<void>;
  refreshAll: () => Promise<void>;
  updateAvailability: (updates: Array<{ playerId: string; status: AvailabilityStatus; reserveOrder: number | null }>) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [availability, setAvailability] = useState<Map<string, PlayerAvailability>>(new Map());
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

  const refreshAvailability = useCallback(async () => {
    try {
      const data = await getAvailability();
      const map = new Map<string, PlayerAvailability>();
      data.forEach((item) => map.set(item.playerId, item));
      setAvailability(map);
    } catch (err) {
      console.error('Error fetching availability:', err);
      setError('Failed to load availability');
    }
  }, []);

  const updateAvailability = useCallback(async (
    updates: Array<{ playerId: string; status: AvailabilityStatus; reserveOrder: number | null }>
  ) => {
    try {
      await batchUpdateAvailability(updates);
      // Update local state immediately
      setAvailability((prev) => {
        const newMap = new Map(prev);
        updates.forEach((update) => {
          newMap.set(update.playerId, {
            playerId: update.playerId,
            status: update.status,
            reserveOrder: update.reserveOrder,
            updatedAt: new Date(),
          });
        });
        return newMap;
      });
    } catch (err) {
      console.error('Error updating availability:', err);
      setError('Failed to update availability');
      throw err;
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([refreshPlayers(), refreshMatches(), refreshAvailability()]);
    } finally {
      setLoading(false);
    }
  }, [refreshPlayers, refreshMatches, refreshAvailability]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  return (
    <DataContext.Provider
      value={{
        players,
        matches,
        availability,
        loading,
        error,
        refreshPlayers,
        refreshMatches,
        refreshAvailability,
        refreshAll,
        updateAvailability,
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
