import { describe, expect, it } from 'vitest';

import { navigation } from './navigation';

describe('navigation', () => {
  it('exposes Command Center as the only top-level operator hub', () => {
    const topLevelLabels = navigation.map((item) => item.label);

    expect(topLevelLabels).toContain('Command Center');
    expect(topLevelLabels).not.toContain('Cockpit');
  });

  it('keeps secondary workspace surfaces nested under Command Center', () => {
    const commandCenter = navigation.find((item) => item.label === 'Command Center');
    const childPaths = commandCenter?.children?.map((item) => item.path);

    expect(childPaths).toContain('/command-center');
    expect(childPaths).toContain('/cockpit/dashboard');
    expect(childPaths).toContain('/calls');
    expect(childPaths).toContain('/reports');
    expect(childPaths).toContain('/workforms');
  });
});
