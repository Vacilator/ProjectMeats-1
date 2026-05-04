export interface SessionHistoryLike {
  id: string;
  title?: string | null;
  last_activity?: string;
  created_on?: string;
}

export interface SessionHistoryGroup<T extends SessionHistoryLike> {
  label: string;
  sessions: T[];
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const getSessionTimestamp = (session: SessionHistoryLike): number => {
  const raw = session.last_activity || session.created_on;
  const parsed = raw ? Date.parse(raw) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
};

export const groupChatSessionsByDate = <T extends SessionHistoryLike>(
  sessions: T[],
  now: number = Date.now(),
): SessionHistoryGroup<T>[] => {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const todayThreshold = startOfToday.getTime();
  const previousWeekThreshold = now - (7 * DAY_IN_MS);

  const buckets: SessionHistoryGroup<T>[] = [
    { label: 'Today', sessions: [] },
    { label: 'Previous 7 Days', sessions: [] },
    { label: 'Older', sessions: [] },
  ];

  [...sessions]
    .sort((left, right) => getSessionTimestamp(right) - getSessionTimestamp(left))
    .forEach((session) => {
      const timestamp = getSessionTimestamp(session);
      if (timestamp >= todayThreshold) {
        buckets[0].sessions.push(session);
        return;
      }
      if (timestamp >= previousWeekThreshold) {
        buckets[1].sessions.push(session);
        return;
      }
      buckets[2].sessions.push(session);
    });

  return buckets.filter((group) => group.sessions.length > 0);
};
