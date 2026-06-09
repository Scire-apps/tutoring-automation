/**
 * Master subject list (previously read from the repo-root `subjects.txt`).
 * Source of truth for the registration/request subject pickers and admin tools.
 */
export const SUBJECTS: string[] = [
  "math",
  "functions",
  "advanced_functions",
  "calculus",
  "data_management",
  "english",
  "science",
  "chemistry",
  "physics",
  "biology",
  "civics",
  "careers",
  "history",
  "geography",
  "business",
  "french",
  "spanish",
  "computer_science",
  "accounting",
];

export const SUBJECT_TYPES = ["Academic", "ALP", "IB"] as const;
export type SubjectType = (typeof SUBJECT_TYPES)[number];

export const GRADES = ["9", "10", "11", "12"] as const;
export type Grade = (typeof GRADES)[number];

/** Fallback subject names used by the old backend when the list was unreadable. */
export const FALLBACK_SUBJECTS = ["math", "english", "history"];

/**
 * Shape returned by `/api/public/subjects` and `/api/admin/subjects`:
 * `{ subjects: [{ name }], types, grades }`.
 */
export function subjectOptions() {
  return {
    // Capitalize the first letter for display (matches the old Flask `n[0].upper()+n[1:]`).
    subjects: SUBJECTS.map((name) => ({ name: name.charAt(0).toUpperCase() + name.slice(1) })),
    types: [...SUBJECT_TYPES],
    grades: [...GRADES],
  };
}
