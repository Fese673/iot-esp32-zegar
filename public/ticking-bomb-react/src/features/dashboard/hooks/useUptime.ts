import { useEffect, useState } from 'react';

const PROJECT_START_MS = new Date('2026-06-12T10:00:00').getTime();

interface Uptime {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

function calculateUptime(): Uptime {
  const now = Date.now();
  const diff = Math.max(0, now - PROJECT_START_MS);

  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((diff % (60 * 1000)) / 1000);

  return { days, hours, minutes, seconds, total: diff };
}

export function useUptime(): Uptime {
  const [uptime, setUptime] = useState<Uptime>(calculateUptime);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setUptime(calculateUptime());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  return uptime;
}
