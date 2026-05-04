import { describe, expect, it } from 'vitest';

import { groupChatSessionsByDate } from './sessionHistory';

describe('groupChatSessionsByDate', () => {
  it('groups sessions into Today, Previous 7 Days, and Older buckets', () => {
    const now = Date.parse('2026-05-04T12:00:00Z');
    const groups = groupChatSessionsByDate(
      [
        { id: 'old-1', title: 'Old', last_activity: '2026-04-20T12:00:00Z' },
        { id: 'week-1', title: 'This week', last_activity: '2026-05-01T08:00:00Z' },
        { id: 'today-1', title: 'Today', last_activity: '2026-05-04T09:00:00Z' },
      ],
      now,
    );

    expect(groups.map((group) => group.label)).toEqual(['Today', 'Previous 7 Days', 'Older']);
    expect(groups[0].sessions.map((session) => session.id)).toEqual(['today-1']);
    expect(groups[1].sessions.map((session) => session.id)).toEqual(['week-1']);
    expect(groups[2].sessions.map((session) => session.id)).toEqual(['old-1']);
  });
});
