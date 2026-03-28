import { useEffect } from 'react';
import type { RefObject } from 'react';
import type { WindowRange } from '../../../shared/lib/chartHelpers';

export type WheelGesture = 'none' | 'pan-left' | 'pan-right' | 'zoom-in' | 'zoom-out';

export interface UseChartInteractionsOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  frameRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  minWindowMs: number;
  getValueAtClientX: (clientX: number) => number | null;
  getWindow: () => WindowRange | null;
  getBounds: () => WindowRange | null;
  setWindow: (start: number, end: number) => void;
  pan: (direction: number) => void;
  zoom: (factor: number) => void;
}

export function resolveWheelGesture(deltaX: number, deltaY: number, ctrlKey: boolean, metaKey: boolean): WheelGesture {
  const isHorizontalPan = Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 0;
  const isZoomGesture = ctrlKey || metaKey;

  if (!isHorizontalPan && !isZoomGesture) {
    return 'none';
  }

  if (isHorizontalPan) {
    return deltaX > 0 ? 'pan-right' : 'pan-left';
  }

  return deltaY < 0 ? 'zoom-in' : 'zoom-out';
}

export function pointerDistance(first: { x: number; y: number }, second: { x: number; y: number }): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

export function useChartInteractions({
  canvasRef,
  frameRef,
  enabled,
  minWindowMs,
  getValueAtClientX,
  getWindow,
  getBounds,
  setWindow,
  pan,
  zoom,
}: UseChartInteractionsOptions): void {
  useEffect(() => {
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (!canvas || !frame || !enabled) {
      return undefined;
    }

    const activeCanvas = canvas;
    const activeFrame = frame;

    const activePointers = new Map<number, { x: number; y: number }>();
    let pinchStartDist: number | null = null;
    let pinchStartWidth: number | null = null;
    let pinchStartCenterValue: number | null = null;
    let panLastValue: number | null = null;

    function handlePointerDown(event: PointerEvent) {
      if (!getBounds()) {
        return;
      }

      activeCanvas.setPointerCapture?.(event.pointerId);
      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (activePointers.size === 1) {
        panLastValue = getValueAtClientX(event.clientX);
        pinchStartDist = null;
        pinchStartWidth = null;
        pinchStartCenterValue = null;
        return;
      }

      if (activePointers.size === 2) {
        const pointers = Array.from(activePointers.values());
        const currentWindow = getWindow();
        if (!currentWindow) {
          return;
        }

        pinchStartDist = pointerDistance(pointers[0], pointers[1]);
        pinchStartWidth = currentWindow.end - currentWindow.start;
        const centerX = (pointers[0].x + pointers[1].x) / 2;
        pinchStartCenterValue = getValueAtClientX(centerX);
        panLastValue = null;
      }
    }

    function handlePointerMove(event: PointerEvent) {
      if (!activePointers.has(event.pointerId) || !getBounds()) {
        return;
      }

      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (activePointers.size === 1 && panLastValue != null) {
        const currentValue = getValueAtClientX(event.clientX);
        const currentWindow = getWindow();
        if (currentValue == null || !currentWindow) {
          return;
        }

        const delta = currentValue - panLastValue;
        if (delta === 0) {
          return;
        }

        setWindow(currentWindow.start - delta, currentWindow.end - delta);
        panLastValue = currentValue;
        return;
      }

      if (activePointers.size === 2 && pinchStartDist && pinchStartWidth && pinchStartCenterValue != null) {
        const pointers = Array.from(activePointers.values());
        const bounds = getBounds();
        if (!bounds) {
          return;
        }

        const distance = pointerDistance(pointers[0], pointers[1]);
        if (distance <= 0) {
          return;
        }

        const ratio = distance / pinchStartDist;
        const maxWidth = bounds.end - bounds.start;
        const nextWidth = Math.max(minWindowMs, Math.min(pinchStartWidth / ratio, maxWidth));
        setWindow(
          pinchStartCenterValue - nextWidth / 2,
          pinchStartCenterValue + nextWidth / 2,
        );
      }
    }

    function handlePointerUp(event: PointerEvent) {
      activePointers.delete(event.pointerId);

      if (activePointers.size === 1) {
        const [remaining] = Array.from(activePointers.values());
        panLastValue = getValueAtClientX(remaining.x);
        pinchStartDist = null;
        pinchStartWidth = null;
        pinchStartCenterValue = null;
        return;
      }

      panLastValue = null;
      pinchStartDist = null;
      pinchStartWidth = null;
      pinchStartCenterValue = null;
    }

    function handleWheel(event: WheelEvent) {
      const gesture = resolveWheelGesture(event.deltaX, event.deltaY, event.ctrlKey, event.metaKey);
      if (gesture === 'none') {
        return;
      }

      event.preventDefault();

      if (gesture === 'pan-left') {
        pan(-1);
        return;
      }

      if (gesture === 'pan-right') {
        pan(1);
        return;
      }

      if (gesture === 'zoom-in') {
        zoom(0.8);
        return;
      }

      zoom(1.25);
    }

    activeCanvas.style.touchAction = 'none';
    activeFrame.addEventListener('wheel', handleWheel, { passive: false });
    activeCanvas.addEventListener('pointerdown', handlePointerDown);
    activeCanvas.addEventListener('pointermove', handlePointerMove);
    const pointerEventNames: Array<'pointerup' | 'pointercancel' | 'pointerleave' | 'pointerout'> = ['pointerup', 'pointercancel', 'pointerleave', 'pointerout'];
    const pointerEventListener = handlePointerUp as EventListener;
    pointerEventNames.forEach((type) => {
      activeCanvas.addEventListener(type, pointerEventListener);
    });

    return () => {
      activeFrame.removeEventListener('wheel', handleWheel);
      activeCanvas.removeEventListener('pointerdown', handlePointerDown);
      activeCanvas.removeEventListener('pointermove', handlePointerMove);
      pointerEventNames.forEach((type) => {
        activeCanvas.removeEventListener(type, pointerEventListener);
      });
    };
  }, [canvasRef, frameRef, enabled, minWindowMs, getValueAtClientX, getWindow, getBounds, setWindow, pan, zoom]);
}
