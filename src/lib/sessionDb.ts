export interface LegStrideMetrics {
  stancePercent: number;
  swingPercent: number;
  strideTime: number;  // seconds
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
  score: number;                             // 0–100
  status: 'Stable' | 'Improved' | 'Critical';
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

export function scoreFromAngles(angles: { left: number[]; right: number[] }): number {
  if (!angles.left.length) return 0;
  const diffs = angles.left.map((l, i) => Math.abs(l - (angles.right[i] ?? l)));
  return Math.round(Math.max(0, Math.min(100, 100 - mean(diffs) * 2)));
}

export function statusFromScore(score: number): GaitSession['status'] {
  return score >= 85 ? 'Stable' : score >= 70 ? 'Improved' : 'Critical';
}

export function labelFromScore(score: number): string {
  return score >= 85
    ? 'Standard Gait Protocol'
    : score >= 70
    ? 'Monitoring Protocol'
    : 'Critical Alert Protocol';
}
