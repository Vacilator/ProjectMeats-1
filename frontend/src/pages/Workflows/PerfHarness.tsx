import React, { lazy, Suspense, useMemo, useState } from 'react';
import { Button, Card, Select, Typography } from 'antd';
import type { Edge, Node } from '@xyflow/react';

const UnifiedFlowEditor = lazy(() => import('@/components/FlowEditor/UnifiedFlowEditor').then(m => ({ default: m.UnifiedFlowEditor })));

const { Title, Paragraph, Text } = Typography;

type Preset = 150 | 500 | 1000;

const buildGraph = (nodeCount: number): { nodes: Node[]; edges: Edge[] } => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const cols = Math.max(10, Math.floor(Math.sqrt(nodeCount)));
  const spacingX = 260;
  const spacingY = 140;

  for (let i = 0; i < nodeCount; i += 1) {
    const id = `n-${i}`;
    const x = (i % cols) * spacingX;
    const y = Math.floor(i / cols) * spacingY;

    nodes.push({
      id,
      type: 'utility',
      position: { x, y },
      data: {
        label: `Node ${i + 1}`,
        utilityType: 'transform',
      },
    });

    if (i > 0) {
      edges.push({
        id: `e-${i - 1}-${i}`,
        source: `n-${i - 1}`,
        target: id,
        type: 'step',
      });
    }
  }

  return { nodes, edges };
};

export const PerfHarness: React.FC = () => {
  const [preset, setPreset] = useState<Preset>(150);
  const [seed, setSeed] = useState(0);

  const { nodes, edges } = useMemo(() => {
    // seed is used only to force regeneration on demand
    void seed;
    return buildGraph(preset);
  }, [preset, seed]);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Card>
          <Title level={3} style={{ margin: 0 }}>
            FlowEditor Performance Harness (Dev Only)
          </Title>
          <Paragraph style={{ marginBottom: 8 }}>
            Generates a synthetic graph to profile canvas responsiveness at scale.
          </Paragraph>
          <Paragraph style={{ marginBottom: 0 }}>
            <Text strong>Tip:</Text> open Chrome Performance, then pan/zoom and drag nodes to measure.
          </Paragraph>

          <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 220 }}>
              <Text style={{ display: 'block', marginBottom: 4 }}>Preset</Text>
              <Select
                value={preset}
                style={{ width: '100%' }}
                options={[
                  { value: 150, label: '150 nodes (baseline)' },
                  { value: 500, label: '500 nodes' },
                  { value: 1000, label: '1000 nodes (stress)' },
                ]}
                onChange={(v) => setPreset(v as Preset)}
              />
            </div>

            <Button onClick={() => setSeed((s) => s + 1)}>Regenerate</Button>
          </div>
        </Card>

        <div style={{ height: '75vh', minHeight: 640 }}>
          <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>Loading editor…</div>}>
            <UnifiedFlowEditor
              initialNodes={nodes}
              initialEdges={edges}
              editorMode="visual"
              readOnly={false}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
};

export default PerfHarness;
