// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useEffect } from 'react';
import { afterEach, describe, expect, test } from 'vitest';
import type { PmsChartPoint } from '../../../lib/pmsChartHelpers';
import type { ParticleFrame } from '../../types';
import { useParticlesFrame } from '../useParticlesFrame';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface ProbeProps {
  input: Parameters<typeof useParticlesFrame>[0];
  onFrame: (frame: ParticleFrame) => void;
}

function Probe({ input, onFrame }: ProbeProps) {
  const frame = useParticlesFrame(input);

  useEffect(() => {
    onFrame(frame);
  }, [frame, onFrame]);

  return null;
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(async () => {
  if (root) {
    await act(async () => {
      root?.unmount();
    });
  }

  if (container?.parentNode) {
    container.parentNode.removeChild(container);
  }

  root = null;
  container = null;
});

async function renderProbe(input: Parameters<typeof useParticlesFrame>[0]): Promise<ParticleFrame> {
  let captured: ParticleFrame | null = null;

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(<Probe input={input} onFrame={(frame) => { captured = frame; }} />);
  });

  expect(captured).not.toBeNull();
  if (!captured) {
    throw new Error('Probe did not capture frame output');
  }

  return captured;
}

describe('useParticlesFrame', () => {
  test('uses live particles map as the primary source when available', async () => {
    const frame = await renderProbe({
      preferLive: true,
      points: [],
      liveData: {
        ts: 1_700_000_000_000,
        A: { pm1: 1.2, pm25: 2.3, pm10: 3.4 },
        particles: {
          '0p3': 8_352,
          '0p5': 2_368,
          '1p0': 580,
          '2p5': 210,
          '5p0': 64,
          '10p0': 18,
        },
      },
    });

    expect(frame.source).toBe('live-particles');
    expect(frame.sampleTimestamp).toBe(1_700_000_000_000);

    const row03 = frame.rows.find((row) => row.key === '0p3');
    expect(row03).toBeDefined();
    expect(Math.round(row03!.reading)).toBe(8_352);
  });

  test('prefers history-derived data when selected day is not today', async () => {
    const historyPoints: PmsChartPoint[] = [
      { series: 'pm1', x: 1_700_000_010_000, y: 10 },
      { series: 'pm25', x: 1_700_000_010_000, y: 12 },
      { series: 'pm10', x: 1_700_000_010_000, y: 15 },
    ];

    const frame = await renderProbe({
      preferLive: false,
      points: historyPoints,
      liveData: {
        ts: 1_700_000_020_000,
        particles: {
          '0p3': 900_000,
        },
      },
    });

    expect(frame.source).toBe('history-derived');
    expect(frame.sampleTimestamp).toBe(1_700_000_010_000);

    const row03 = frame.rows.find((row) => row.key === '0p3');
    expect(row03).toBeDefined();
    expect(Math.round(row03!.reading)).toBe(70_000);
  });
});
