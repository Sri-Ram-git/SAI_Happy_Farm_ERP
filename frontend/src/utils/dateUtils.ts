export function getIstDate(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const y = parts.find((p) => p.type === 'year')?.value ?? '';
  const m = parts.find((p) => p.type === 'month')?.value ?? '';
  const d = parts.find((p) => p.type === 'day')?.value ?? '';
  return `${y}-${m}-${d}`;
}

export function formatDisplayDate(isoDate: any): string {
  if (!isoDate) return '';
  const str = typeof isoDate === 'string' ? isoDate : (isoDate.toDate ? isoDate.toDate().toISOString() : String(isoDate));
  try {
    const clean = str.split('T')[0];
    const parts = clean.split('-');
    if (parts.length < 3) return clean;
    const [y, m, d] = parts;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const idx = parseInt(m, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx > 11) return clean;
    return `${d} ${months[idx]} ${y}`;
  } catch {
    return String(isoDate);
  }
}

export function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
  } catch {
    return '--';
  }
}

export function getDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value ?? '';
  const m = parts.find((p) => p.type === 'month')?.value ?? '';
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  return `${y}-${m}-${day}`;
}

export function getDateRangeLabel(days: number): string {
  if (days === 1) return 'Today';
  if (days === 7) return 'Last 7 Days';
  if (days === 30) return 'Last 30 Days';
  return `Last ${days} Days`;
}

export function generateDateArray(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  while (current <= end) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(current);
    const y = parts.find((p) => p.type === 'year')?.value ?? '';
    const m = parts.find((p) => p.type === 'month')?.value ?? '';
    const d = parts.find((p) => p.type === 'day')?.value ?? '';
    dates.push(`${y}-${m}-${d}`);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

export function getShortDate(isoDate: any): string {
  if (!isoDate) return '';
  const str = typeof isoDate === 'string' ? isoDate : (isoDate.toDate ? isoDate.toDate().toISOString() : String(isoDate));
  try {
    const clean = str.split('T')[0];
    const parts = clean.split('-');
    if (parts.length < 3) return clean;
    const [, m, d] = parts;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const idx = parseInt(m, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx > 11) return clean;
    return `${parseInt(d, 10)} ${months[idx]}`;
  } catch {
    return String(isoDate);
  }
}
