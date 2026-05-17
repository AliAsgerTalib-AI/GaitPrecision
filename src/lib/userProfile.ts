export type AgeGroup = 'under40' | '40-59' | '60-74' | '75plus';

export const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
  'under40': 'Under 40',
  '40-59':   '40 – 59',
  '60-74':   '60 – 74',
  '75plus':  '75 and over',
};

// Published community-dwelling adult norms (step cadence spm, wellness score baseline)
export const BENCHMARKS: Record<AgeGroup, { cadence: number; score: number; stancePercent: number }> = {
  'under40': { cadence: 117, score: 88, stancePercent: 60 },
  '40-59':   { cadence: 115, score: 85, stancePercent: 61 },
  '60-74':   { cadence: 110, score: 80, stancePercent: 62 },
  '75plus':  { cadence: 100, score: 74, stancePercent: 64 },
};

const AGE_GROUP_KEY = 'gp_age_group';

export function getAgeGroup(): AgeGroup | null {
  try {
    return (localStorage.getItem(AGE_GROUP_KEY) as AgeGroup) ?? null;
  } catch {
    return null;
  }
}

export function saveAgeGroup(group: AgeGroup): void {
  try {
    localStorage.setItem(AGE_GROUP_KEY, group);
  } catch {
    // storage unavailable — ignore
  }
}

// ── Full user profile ──────────────────────────────────────────────────────

export interface UserProfile {
  name: string;
  age: string;
  gender: string;
  heightCm: string;
  weightKg: string;
  notes: string;
}

const PROFILE_KEY = 'gp_user_profile';

export function getProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

export function saveProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    // Keep age group in sync for benchmark comparisons
    const age = parseInt(profile.age, 10);
    if (!isNaN(age)) {
      const group: AgeGroup =
        age < 40 ? 'under40' : age < 60 ? '40-59' : age < 75 ? '60-74' : '75plus';
      saveAgeGroup(group);
    }
  } catch {
    // storage unavailable — ignore
  }
}
