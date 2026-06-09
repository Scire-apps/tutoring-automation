/**
 * Domain business rules shared across API routes. The session scheduling
 * validators below are kept verbatim from the prior implementation so the
 * availability / duration / ISO time arithmetic stays bit-for-bit identical.
 */

/** Tutee desired duration: an integer multiple of 30, between 60 and 180 inclusive. */
export function isValidDesiredDuration(n: unknown): boolean {
  const v = Number(n);
  return Number.isInteger(v) && v >= 60 && v <= 180 && v % 30 === 0;
}

/** Tutor schedule duration must be 60..180. */
export function isValidScheduleDuration(n: unknown): boolean {
  const v = Number(n);
  return Number.isInteger(v) && v >= 60 && v <= 180;
}

/**
 * When the tutee set a specific desired duration in {60,90,120,150,180}, the
 * tutor's chosen duration must equal it exactly.
 */
export function durationMismatchesDesired(durationMinutes: number, desired: unknown): boolean {
  const d = Number(desired);
  if (Number.isInteger(d) && [60, 90, 120, 150, 180].includes(d)) {
    return durationMinutes !== d;
  }
  return false;
}

/** Basic ISO-8601 validation (accepts trailing 'Z'). */
export function isValidIso(value: string): boolean {
  if (typeof value !== "string" || !value) return false;
  const d = new Date(value.replace("Z", "+00:00"));
  return !Number.isNaN(d.getTime());
}

/**
 * Derive a date key (YYYY-MM-DD) and start time (HH:MM) from an ISO timestamp,
 * in UTC. The frontend normally passes explicit local date/start to avoid drift;
 * this is the fallback used when it does not.
 */
export function deriveDateAndStart(scheduledTimeIso: string): { dateKey: string; startHHMM: string } {
  const d = new Date(scheduledTimeIso.replace("Z", "+00:00"));
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  return { dateKey: `${yyyy}-${mm}-${dd}`, startHHMM: `${hh}:${min}` };
}

/** True if a single "HH:MM-HH:MM" range fully contains [start, start+duration]. */
export function rangeFits(range: string, startHHMM: string, durationMinutes: number): boolean {
  const parts = range.split("-");
  if (parts.length !== 2) return false;
  const [s, e] = parts;
  const sp = startHHMM.split(":");
  if (sp.length !== 2) return false;
  const sh = Number(sp[0]);
  const sm = Number(sp[1]);
  if (Number.isNaN(sh) || Number.isNaN(sm)) return false;
  let eh = sh;
  let em = sm + Number(durationMinutes);
  eh += Math.floor(em / 60);
  em = em % 60;
  const endHHMM = `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
  return s <= startHHMM && endHHMM <= e;
}

/**
 * Validate that a chosen start+duration fits within the tutee's availability
 * for the given date. Only enforced when availability exists for that exact date
 * (mirrors the Flask behavior of silently allowing when no ranges are present).
 */
export function timeFitsAvailability(
  availability: Record<string, unknown> | null | undefined,
  dateKey: string,
  startHHMM: string,
  durationMinutes: number
): boolean {
  if (!availability || typeof availability !== "object") return true;
  const ranges = (availability as Record<string, unknown>)[dateKey];
  if (!Array.isArray(ranges) || ranges.length === 0) return true; // no constraint for this date
  return ranges.some((r) => typeof r === "string" && rangeFits(r, startHHMM, durationMinutes));
}

/** Validate the tutee availability map structure: { "YYYY-MM-DD": ["HH:MM-HH:MM", ...] }. */
export function validateAvailabilityShape(availability: unknown): { ok: true } | { ok: false; error: string } {
  if (!availability || typeof availability !== "object" || Array.isArray(availability)) {
    return { ok: false, error: "availability must be an object of date->time ranges" };
  }
  for (const [dateStr, ranges] of Object.entries(availability as Record<string, unknown>)) {
    const dparts = dateStr.split("-").map((x) => Number(x));
    if (dparts.length !== 3 || dparts.some((n) => Number.isNaN(n))) {
      return { ok: false, error: `Invalid date key: ${dateStr}` };
    }
    if (!Array.isArray(ranges)) {
      return { ok: false, error: `Ranges for ${dateStr} must be a list` };
    }
    for (const r of ranges) {
      if (typeof r !== "string" || !r.includes("-")) {
        return { ok: false, error: `Invalid time range format for ${dateStr}: ${r}` };
      }
      const [startS, endS] = r.split("-");
      const sp = startS.split(":").map((x) => Number(x));
      const ep = endS.split(":").map((x) => Number(x));
      if (sp.length !== 2 || ep.length !== 2 || [...sp, ...ep].some((n) => Number.isNaN(n))) {
        return { ok: false, error: `Invalid HH:MM in range for ${dateStr}: ${r}` };
      }
      const [sh, sm] = sp;
      const [eh, em] = ep;
      if (eh * 60 + em <= sh * 60 + sm) {
        return { ok: false, error: `End must be after start for ${dateStr}: ${r}` };
      }
    }
  }
  return { ok: true };
}
