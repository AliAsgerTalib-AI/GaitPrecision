// Normative gait reference data from published biomechanics literature:
//   Winter DA (2009). Biomechanics and Motor Control of Human Movement, 4th ed., Wiley.
//   Oberg T et al. (1993). Basic gait parameters: reference data for normal subjects. J Rehab Res Dev 30(2):210-223.
//   Sadeghi H et al. (2000). Symmetry and limb dominance in able-bodied gait. Gait Posture 12(1):34-45.
//   Robinson RO et al. (1987). Use of force platform variables to quantify the effects of chiropractic manipulation. Physiother Can 39(1):45-52.
//   Perry J & Burnfield JM (2010). Gait Analysis: Normal and Pathological Function, 2nd ed., SLACK Inc.

import { getProfile, getAgeGroup, type AgeGroup } from './userProfile';

export type Sex = 'male' | 'female' | 'unknown';

export interface NormativeRange {
  mean: number;
  sd: number;
  unit: string;
  source: string;
}

export interface NormativeProfile {
  cadence: NormativeRange;
  kneeFlexionPeak: NormativeRange;
  stancePct: NormativeRange;
  swingPct: NormativeRange;
  symmetryIndex: NormativeRange;
  hipAngleMean: NormativeRange;
  dorsiflexionPeak: NormativeRange;
}

// Cadence (steps/min): Oberg et al. 1993, corroborated by Winter 2009 Table 1.2
const CADENCE: Record<AgeGroup, Record<Sex, NormativeRange>> = {
  'under40': {
    male:    { mean: 107, sd: 8,  unit: 'spm', source: 'Oberg 1993' },
    female:  { mean: 117, sd: 9,  unit: 'spm', source: 'Oberg 1993' },
    unknown: { mean: 112, sd: 9,  unit: 'spm', source: 'Oberg 1993' },
  },
  '40-59': {
    male:    { mean: 105, sd: 9,  unit: 'spm', source: 'Oberg 1993' },
    female:  { mean: 112, sd: 10, unit: 'spm', source: 'Oberg 1993' },
    unknown: { mean: 108, sd: 10, unit: 'spm', source: 'Oberg 1993' },
  },
  '60-74': {
    male:    { mean: 100, sd: 10, unit: 'spm', source: 'Oberg 1993' },
    female:  { mean: 105, sd: 11, unit: 'spm', source: 'Oberg 1993' },
    unknown: { mean: 103, sd: 11, unit: 'spm', source: 'Oberg 1993' },
  },
  '75plus': {
    male:    { mean: 90, sd: 12, unit: 'spm', source: 'Oberg 1993' },
    female:  { mean: 95, sd: 13, unit: 'spm', source: 'Oberg 1993' },
    unknown: { mean: 93, sd: 13, unit: 'spm', source: 'Oberg 1993' },
  },
};

// Swing-phase peak knee flexion (°): Winter 2009, Table 4.1 — age-stratified
const KNEE_FLEXION: Record<AgeGroup, NormativeRange> = {
  'under40': { mean: 67, sd: 5, unit: '°', source: 'Winter 2009' },
  '40-59':   { mean: 65, sd: 6, unit: '°', source: 'Winter 2009' },
  '60-74':   { mean: 62, sd: 7, unit: '°', source: 'Winter 2009' },
  '75plus':  { mean: 58, sd: 8, unit: '°', source: 'Winter 2009' },
};

// Stance phase (% of gait cycle): Winter 2009, Ch.1 — increases modestly with age
const STANCE_PCT: Record<AgeGroup, NormativeRange> = {
  'under40': { mean: 62, sd: 2,   unit: '%', source: 'Winter 2009' },
  '40-59':   { mean: 62, sd: 2,   unit: '%', source: 'Winter 2009' },
  '60-74':   { mean: 63, sd: 2.5, unit: '%', source: 'Winter 2009' },
  '75plus':  { mean: 65, sd: 3,   unit: '%', source: 'Winter 2009' },
};

// Mean hip angle during walking (°): Winter 2009, Table 4.2 (flexion positive)
const HIP_ANGLE_MEAN: NormativeRange = { mean: 10, sd: 5, unit: '°', source: 'Winter 2009' };

// Peak dorsiflexion during loading response (°): Perry & Burnfield 2010
const DORSIFLEXION_PEAK: NormativeRange = { mean: 15, sd: 3, unit: '°', source: 'Perry 2010' };

// Bilateral symmetry index — healthy community-dwelling adults ≤ 5%: Robinson 1987; Sadeghi 2000
const SYMMETRY_INDEX: NormativeRange = { mean: 2, sd: 2, unit: '%', source: 'Robinson 1987' };

export function parseSex(gender: string | undefined): Sex {
  const g = (gender ?? '').toLowerCase().trim();
  if (g.startsWith('m')) return 'male';
  if (g.startsWith('f')) return 'female';
  return 'unknown';
}

export function getNorms(ageGroup: AgeGroup | null, sex: Sex): NormativeProfile {
  const ag = ageGroup ?? 'under40';
  const stPct = STANCE_PCT[ag];
  return {
    cadence:          CADENCE[ag][sex],
    kneeFlexionPeak:  KNEE_FLEXION[ag],
    stancePct:        stPct,
    swingPct:         { ...stPct, mean: 100 - stPct.mean },
    symmetryIndex:    SYMMETRY_INDEX,
    hipAngleMean:     HIP_ANGLE_MEAN,
    dorsiflexionPeak: DORSIFLEXION_PEAK,
  };
}

export function getNormsFromProfile(): NormativeProfile {
  const profile = getProfile();
  const ageGroup = getAgeGroup();
  return getNorms(ageGroup, parseSex(profile?.gender));
}

// Format as "mean ± SD unit"
export function fmtNorm(r: NormativeRange): string {
  return `${r.mean} ± ${r.sd} ${r.unit}`;
}

// How many SDs away is value from the norm? Positive = above mean.
export function zScore(value: number, r: NormativeRange): number {
  return r.sd > 0 ? (value - r.mean) / r.sd : 0;
}
