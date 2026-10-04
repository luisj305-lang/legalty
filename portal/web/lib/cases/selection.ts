// Pure selection helpers for the participant multi-select. They are UI-agnostic
// and never mutate their inputs so React state updates stay predictable.
import type { Candidate } from './directory.ts';

// Single source of truth for the human label, shared by the chips, the option
// rows and the search filter. Inactive profiles stay visible with a neutral
// suffix instead of an alarming one.
export function candidateLabel(candidate: Candidate): string {
  const base = candidate.name ? `${candidate.name} — ${candidate.email}` : candidate.email;
  return candidate.active ? base : `${base} (inactivo)`;
}

// Case-insensitive substring match on the composed label or the email. A blank
// query returns every candidate in its original order as a fresh array.
export function filterCandidates(candidates: Candidate[], query: string): Candidate[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return candidates.slice();
  return candidates.filter(candidate => {
    const label = candidateLabel(candidate).toLowerCase();
    return label.includes(needle) || candidate.email.toLowerCase().includes(needle);
  });
}

// Toggle one value by identity, preserving insertion order. Returns a new array
// and keeps the value unique.
export function toggleSelection(selected: string[], value: string): string[] {
  return selected.includes(value)
    ? selected.filter(item => item !== value)
    : [...selected, value];
}
