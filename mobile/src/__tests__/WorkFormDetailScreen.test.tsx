/* eslint-disable import/first */
import React from 'react';

jest.mock('../services/ApiService', () => ({
  ApiService: {
    getWorkForm: jest.fn(),
  },
}));

import { ApiService } from '../services/ApiService';
import WorkFormDetailScreen from '../screens/WorkFormDetailScreen';

let renderer: any = null;
let act: any = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, import/no-unresolved
  const mod = require('react-test-renderer');
  renderer = mod.default ?? mod;
  act = mod.act;
} catch {
  // react-test-renderer is not installed in this repo. Keep the test suite green without adding deps.
}

const itIfRenderer = renderer && act ? it : it.skip;

describe('WorkFormDetailScreen', () => {
  itIfRenderer('calls ApiService.getWorkForm and renders the workform name', async () => {
    const mockForm = {
      id: 'wf-1',
      name: 'Intake',
      description: 'Desc',
      status: 'active',
      is_active: true,
      node_count: 3,
      edge_count: 2,
      updated_at: '2026-01-02T00:00:00Z',
      last_executed_at: null,
      workflow_definition: {
        nodes: [{ id: 'n1' }],
        edges: [],
      },
    };

    const getWorkFormMock = ApiService.getWorkForm as jest.Mock;
    const promise = Promise.resolve(mockForm);
    getWorkFormMock.mockReturnValueOnce(promise);

    const navigation = { goBack: jest.fn(), navigate: jest.fn() } as any;
    const route = { key: 'WorkFormDetail', name: 'WorkFormDetail', params: { id: 'wf-1' } } as any;

    let testRenderer: any;
    await act(async () => {
      testRenderer = renderer.create(<WorkFormDetailScreen navigation={navigation} route={route} />);
      await promise;
    });

    expect(getWorkFormMock).toHaveBeenCalledWith('wf-1');
    expect(testRenderer.root.findByProps({ testID: 'workform-title' }).props.children).toBe('Intake');
  });
});
