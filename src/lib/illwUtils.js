// ILLW (International Lighthouse/Lightship Weekend) utilities.
// ILLW is held on the 3rd full weekend in August (Saturday + Sunday both in August).
// 2026: August 15-16, 2027: August 21-22

// Calculate the 3rd full weekend in August for a given year.
// "Full weekend" = both Saturday and Sunday fall in August.
export function getIllwWeekend(year) {
  let count = 0;
  for (let day = 1; day <= 31; day++) {
    const date = new Date(year, 7, day); // August = month 7 (0-indexed)
    if (date.getDay() === 6) { // Saturday
      const sunday = new Date(year, 7, day + 1);
      if (sunday.getMonth() === 7) { // Sunday also in August
        count++;
        if (count === 3) {
          return {
            start: new Date(year, 7, day, 0, 0, 1), // 00:01 UTC
            end: new Date(year, 7, day + 1, 23, 59, 59),
            year,
          };
        }
      }
    }
  }
  return null;
}

// Check if the ILLW weekend is happening right now
export function isIllwWeekendNow() {
  const now = new Date();
  const year = now.getFullYear();
  const weekend = getIllwWeekend(year);
  if (!weekend) return false;
  return now >= weekend.start && now <= weekend.end;
}

// Get the next upcoming ILLW weekend (this year or next year)
export function getNextIllwWeekend() {
  const now = new Date();
  const year = now.getFullYear();
  let weekend = getIllwWeekend(year);
  if (!weekend || now > weekend.end) {
    weekend = getIllwWeekend(year + 1);
  }
  return weekend;
}

// Format ILLW weekend date range for display
export function formatIllwDate(weekend) {
  if (!weekend) return '';
  const opts = { day: 'numeric', month: 'long', year: 'numeric' };
  const start = weekend.start.toLocaleDateString('de-CH', opts);
  const end = weekend.end.toLocaleDateString('de-CH', opts);
  return `${start}. – ${end}`;
}

// Days until the next ILLW weekend
export function daysUntilIllw() {
  const next = getNextIllwWeekend();
  if (!next) return null;
  return Math.ceil((next.start - new Date()) / (1000 * 60 * 60 * 24));
}