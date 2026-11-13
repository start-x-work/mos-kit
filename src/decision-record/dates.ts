/** 照合までに必要な最短の日数。 */
export const MIN_REVIEW_DAYS = 28;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** YYYY-MM-DD の形で、暦の上で実在する日付か。 */
export function isRealDate(value: string): boolean {
  const m = DATE_PATTERN.exec(value);
  if (!m) return false;
  const [, y, mo, d] = m;
  const dt = new Date(0);
  dt.setUTCFullYear(Number(y), Number(mo) - 1, Number(d));
  return (
    dt.getUTCFullYear() === Number(y) &&
    dt.getUTCMonth() === Number(mo) - 1 &&
    dt.getUTCDate() === Number(d)
  );
}

/** 実在する日付に日数を足した日付（YYYY-MM-DD）。 */
export function addDays(date: string, days: number): string {
  const [y, mo, d] = date.split("-").map(Number);
  const dt = new Date(0);
  dt.setUTCFullYear(y, mo - 1, d + days);
  const yyyy = String(dt.getUTCFullYear()).padStart(4, "0");
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** later が written の MIN_REVIEW_DAYS 日後以降か。どちらも実在する日付である前提。 */
export function isAtLeastReviewDaysAfter(
  written: string,
  later: string,
): boolean {
  return later >= addDays(written, MIN_REVIEW_DAYS);
}
