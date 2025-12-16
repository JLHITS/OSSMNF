import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { db, storage } from '../config/firebase';
import type { Player, Match, TeamPlayer, PlayerAvailability, AvailabilityStatus } from '../types';
import { v4 as uuidv4 } from 'uuid';

// Collections
const PLAYERS_COLLECTION = 'players';
const MATCHES_COLLECTION = 'matches';
const AVAILABILITY_COLLECTION = 'availability';

export async function getPlayers(): Promise<Player[]> {
  const q = query(collection(db, PLAYERS_COLLECTION), orderBy('name'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name,
      photoUrl: data.photoUrl,
      fitness: data.fitness,
      defence: data.defence,
      attack: data.attack,
      ballUse: data.ballUse,
      position: data.position,
      ovr: data.ovr,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as Player;
  });
}

export async function getPlayer(id: string): Promise<Player | null> {
  const docRef = doc(db, PLAYERS_COLLECTION, id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  const data = docSnap.data();
  return {
    id: docSnap.id,
    name: data.name,
    photoUrl: data.photoUrl,
    fitness: data.fitness,
    defence: data.defence,
    attack: data.attack,
    ballUse: data.ballUse,
    position: data.position,
    ovr: data.ovr,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  } as Player;
}

export async function createPlayer(
  player: Omit<Player, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const docRef = await addDoc(collection(db, PLAYERS_COLLECTION), {
    ...player,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function updatePlayer(
  id: string,
  player: Partial<Player>
): Promise<void> {
  const docRef = doc(db, PLAYERS_COLLECTION, id);
  await updateDoc(docRef, {
    ...player,
    updatedAt: Timestamp.now(),
  });
}

export async function deletePlayer(id: string): Promise<void> {
  const docRef = doc(db, PLAYERS_COLLECTION, id);
  await deleteDoc(docRef);
}

export async function uploadPlayerPhoto(
  playerId: string,
  file: File
): Promise<string> {
  const fileExtension = file.name.split('.').pop();
  const fileName = `players/${playerId}_${uuidv4()}.${fileExtension}`;
  const storageRef = ref(storage, fileName);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function deletePlayerPhoto(photoUrl: string): Promise<void> {
  try {
    const storageRef = ref(storage, photoUrl);
    await deleteObject(storageRef);
  } catch (error) {
    console.error('Error deleting photo:', error);
  }
}

// Matches Collection
export async function getMatches(): Promise<Match[]> {
  const q = query(collection(db, MATCHES_COLLECTION), orderBy('date', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      date: data.date?.toDate() || new Date(),
      redTeam: data.redTeam,
      whiteTeam: data.whiteTeam,
      redTeamOvr: data.redTeamOvr,
      whiteTeamOvr: data.whiteTeamOvr,
      redScore: data.redScore,
      whiteScore: data.whiteScore,
      redScorers: data.redScorers || [],
      whiteScorers: data.whiteScorers || [],
      matchSize: data.matchSize,
      status: data.status,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as Match;
  });
}

export async function createMatch(
  match: Omit<Match, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const docRef = await addDoc(collection(db, MATCHES_COLLECTION), {
    ...match,
    date: Timestamp.fromDate(match.date),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function updateMatch(
  id: string,
  match: Partial<Match>
): Promise<void> {
  const docRef = doc(db, MATCHES_COLLECTION, id);
  const updateData: Record<string, unknown> = {
    ...match,
    updatedAt: Timestamp.now(),
  };
  if (match.date) {
    updateData.date = Timestamp.fromDate(match.date);
  }
  await updateDoc(docRef, updateData);
}

export async function deleteMatch(id: string): Promise<void> {
  const docRef = doc(db, MATCHES_COLLECTION, id);
  await deleteDoc(docRef);
}

// Calculate player stats from matches
export function calculatePlayerStats(
  players: Player[],
  matches: Match[]
): Map<string, { wins: number; losses: number; draws: number; goals: number }> {
  const stats = new Map<
    string,
    { wins: number; losses: number; draws: number; goals: number }
  >();

  // Initialize all players
  players.forEach((player) => {
    stats.set(player.id, { wins: 0, losses: 0, draws: 0, goals: 0 });
  });

  // Calculate from completed matches
  matches
    .filter((match) => match.status === 'completed')
    .forEach((match) => {
      const redWon =
        match.redScore !== null &&
        match.whiteScore !== null &&
        match.redScore > match.whiteScore;
      const whiteWon =
        match.redScore !== null &&
        match.whiteScore !== null &&
        match.whiteScore > match.redScore;
      const isDraw =
        match.redScore !== null &&
        match.whiteScore !== null &&
        match.redScore === match.whiteScore;

      // Red team stats
      match.redTeam.forEach((player: TeamPlayer) => {
        const playerStats = stats.get(player.id);
        if (playerStats) {
          if (redWon) playerStats.wins++;
          else if (whiteWon) playerStats.losses++;
          else if (isDraw) playerStats.draws++;
        }
      });

      // White team stats
      match.whiteTeam.forEach((player: TeamPlayer) => {
        const playerStats = stats.get(player.id);
        if (playerStats) {
          if (whiteWon) playerStats.wins++;
          else if (redWon) playerStats.losses++;
          else if (isDraw) playerStats.draws++;
        }
      });

      // Goals
      match.redScorers.forEach((playerId) => {
        const playerStats = stats.get(playerId);
        if (playerStats) playerStats.goals++;
      });

      match.whiteScorers.forEach((playerId) => {
        const playerStats = stats.get(playerId);
        if (playerStats) playerStats.goals++;
      });
    });

  return stats;
}

// Availability Collection
export async function getAvailability(): Promise<PlayerAvailability[]> {
  const snapshot = await getDocs(collection(db, AVAILABILITY_COLLECTION));
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      playerId: doc.id,
      status: data.status || 'unconfirmed',
      reserveOrder: data.reserveOrder ?? null,
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as PlayerAvailability;
  });
}

export async function updatePlayerAvailability(
  playerId: string,
  status: AvailabilityStatus,
  reserveOrder: number | null = null
): Promise<void> {
  const docRef = doc(db, AVAILABILITY_COLLECTION, playerId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    await updateDoc(docRef, {
      status,
      reserveOrder,
      updatedAt: Timestamp.now(),
    });
  } else {
    // Use setDoc with merge to create if doesn't exist
    const { setDoc } = await import('firebase/firestore');
    await setDoc(docRef, {
      status,
      reserveOrder,
      updatedAt: Timestamp.now(),
    });
  }
}

export async function batchUpdateAvailability(
  updates: Array<{ playerId: string; status: AvailabilityStatus; reserveOrder: number | null }>
): Promise<void> {
  const { writeBatch } = await import('firebase/firestore');
  const batch = writeBatch(db);

  for (const update of updates) {
    const docRef = doc(db, AVAILABILITY_COLLECTION, update.playerId);
    batch.set(docRef, {
      status: update.status,
      reserveOrder: update.reserveOrder,
      updatedAt: Timestamp.now(),
    });
  }

  await batch.commit();
}

export async function resetAllAvailability(): Promise<void> {
  const snapshot = await getDocs(collection(db, AVAILABILITY_COLLECTION));
  const { writeBatch } = await import('firebase/firestore');
  const batch = writeBatch(db);

  snapshot.docs.forEach((docSnapshot) => {
    batch.update(docSnapshot.ref, {
      status: 'unconfirmed',
      updatedAt: Timestamp.now(),
    });
  });

  await batch.commit();
}
