export function getGraduationYearOptions(now: Date = new Date()): number[] {
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  const years: number[] = [];
  if (month > 6) {
    // After June: next 5 years, excluding current
    for (let i = 1; i <= 5; i++) years.push(year + i);
  } else {
    // Before/including June: include current year + next 5
    for (let i = 0; i <= 5; i++) years.push(year + i);
  }
  return years;
}

export function computeCurrentGrade(graduationYear?: number | string, now: Date = new Date()): number | null {
  if (graduationYear === undefined || graduationYear === null || graduationYear === '') return null;
  const gy = Number(graduationYear);
  if (!isFinite(gy)) return null;
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  const base = 12 - (gy - year);
  const grade = month > 6 ? base + 1 : base; // after June, increment by 1
  return grade;
}


