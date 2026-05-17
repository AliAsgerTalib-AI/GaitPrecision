export interface LegStrideMetrics {
  stancePercent: number;
  swingPercent: number;
  strideTime: number;       // seconds
  stanceEstimated?: boolean; // true when no toe-off events were detected; value is population default
}

// One complete gait cycle (heel-strike → heel-strike), resampled to exactly 100 points.
export interface NormalizedCycle {
  angles: number[];    // knee flexion at 0–100% of the gait cycle
  peakAngle: number;   // maximum flexion during swing (degrees)
  peakAt: number;      // % of cycle where peak occurs (0–100)
  stancePct: number;   // stance phase as % of cycle (0 if toe-off not detected)
}

export interface StrideMetrics {
  cadence: number;     // steps / min
  left: LegStrideMetrics;
  right: LegStrideMetrics;
}

export interface GaitSession {
  id: string;
  date: number;                              // Unix ms
  duration: number;                          // seconds
  label: string;                             // human-readable session name
  kneeAngles: { left: number[]; right: number[] };
  hipAngles?: { left: number[]; right: number[] };
  ankleAngles?: { left: number[]; right: number[] };
  frameCount: number;
  score: number;                             // 0–100 symmetry index
  stride?: StrideMetrics;
}

import { mean } from './utils';

const DB_NAME = 'gaitprecision';
const STORE = 'sessions';
const VERSION = 1;

let _db: Promise<IDBDatabase> | null = null;
function openDb(): Promise<IDBDatabase> {
  return (_db ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { _db = null; reject(req.error); };
  }));
}

export async function saveSession(session: GaitSession): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(session);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteSession(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAllSessions(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadSessions(): Promise<GaitSession[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () =>
      resolve((req.result as GaitSession[]).sort((a, b) => b.date - a.date));
    req.onerror = () => reject(req.error);
  });
}

// Symmetry score using the Robinson (1987) Symmetry Index applied to two
// clinically meaningful features: Range of Motion and Mean Flexion.
// SI = |left − right| / ((left + right) / 2) × 100 → 0% = perfect symmetry.
// Each feature contributes 50% of the final score.
export function scoreFromAngles(angles: { left: number[]; right: number[] }): number {
  const { left, right } = angles;
  if (!left.length || !right.length) return 0;

  const romLeft  = Math.max(...left)  - Math.min(...left);
  const romRight = Math.max(...right) - Math.min(...right);
  const romAvg   = (romLeft + romRight) / 2;

  const meanLeft  = mean(left);
  const meanRight = mean(right);
  const meanAvg   = (meanLeft + meanRight) / 2;

  // SI as % asymmetry (0 = identical, 100 = completely different)
  const romSI  = romAvg  > 0 ? (Math.abs(romLeft  - romRight)  / romAvg)  * 100 : 0;
  const meanSI = meanAvg > 0 ? (Math.abs(meanLeft - meanRight) / meanAvg) * 100 : 0;

  // Each 1% SI asymmetry deducts 3 points; 33% asymmetry → 0 score
  const romScore  = Math.max(0, 100 - romSI  * 3);
  const meanScore = Math.max(0, 100 - meanSI * 3);

  return Math.round((romScore + meanScore) / 2);
}
