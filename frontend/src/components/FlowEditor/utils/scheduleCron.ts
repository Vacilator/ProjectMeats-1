export type ScheduleFrequency = 'hourly' | 'daily' | 'weekly' | 'monthly';

const clampInt = (value: unknown, min: number, max: number, fallback: number) => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
};

export const parseTimeOfDay = (raw: unknown): { hour: number; minute: number } => {
  const s = String(raw ?? '').trim();
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(s);
  if (!match) return { hour: 9, minute: 0 };
  return { hour: Number(match[1]), minute: Number(match[2]) };
};

const DOW_TO_CRON: Record<string, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
};

const DOW_LABEL: Record<string, string> = {
  SUN: 'Sun',
  MON: 'Mon',
  TUE: 'Tue',
  WED: 'Wed',
  THU: 'Thu',
  FRI: 'Fri',
  SAT: 'Sat',
};

export type FriendlyScheduleConfig = {
  scheduleMode?: 'friendly' | 'cron';
  frequency?: ScheduleFrequency;
  atTime?: string;
  daysOfWeek?: string[];
  dayOfMonth?: number;
  timezone?: string;
};

export function buildCronExpressionFromFriendlySchedule(config: FriendlyScheduleConfig): string {
  const frequency: ScheduleFrequency =
    (config.frequency as ScheduleFrequency) || 'daily';

  const { hour, minute } = parseTimeOfDay(config.atTime ?? '09:00');
  const dom = clampInt(config.dayOfMonth, 1, 31, 1);

  if (frequency === 'hourly') {
    // Every hour at the selected minute
    return `${minute} * * * *`;
  }

  if (frequency === 'weekly') {
    const rawDays = Array.isArray(config.daysOfWeek) ? config.daysOfWeek : [];
    const cronDays = rawDays
      .map((d) => DOW_TO_CRON[String(d).toUpperCase()])
      .filter((n) => Number.isFinite(n));

    const uniqSorted = Array.from(new Set(cronDays)).sort((a, b) => a - b);
    const dow = uniqSorted.length > 0 ? uniqSorted.join(',') : '1'; // default Monday

    return `${minute} ${hour} * * ${dow}`;
  }

  if (frequency === 'monthly') {
    return `${minute} ${hour} ${dom} * *`;
  }

  // daily
  return `${minute} ${hour} * * *`;
}

export function buildScheduleSummary(config: FriendlyScheduleConfig): string {
  const frequency: ScheduleFrequency =
    (config.frequency as ScheduleFrequency) || 'daily';

  const { hour, minute } = parseTimeOfDay(config.atTime ?? '09:00');
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');

  let summary = '';

  if (frequency === 'hourly') {
    summary = `Hourly at :${mm}`;
  } else if (frequency === 'daily') {
    summary = `Daily at ${hh}:${mm}`;
  } else if (frequency === 'weekly') {
    const rawDays = Array.isArray(config.daysOfWeek) ? config.daysOfWeek : [];
    const days = rawDays
      .map((d) => DOW_LABEL[String(d).toUpperCase()] || String(d))
      .filter(Boolean);

    const dayLabel = days.length > 0 ? days.join(', ') : 'Mon';
    summary = `Weekly on ${dayLabel} at ${hh}:${mm}`;
  } else if (frequency === 'monthly') {
    const dom = clampInt(config.dayOfMonth, 1, 31, 1);
    summary = `Monthly on day ${dom} at ${hh}:${mm}`;
  }

  const tz = String(config.timezone ?? 'UTC').trim();
  if (tz && tz !== 'UTC') {
    summary += ` (${tz})`;
  }

  return summary;
}
