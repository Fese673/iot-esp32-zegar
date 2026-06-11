import { forwardRef, memo } from 'react';
import { useClock } from '../hooks/useClock';
import { useUptime } from '../hooks/useUptime';

interface MetaGridProps {
  liveTimestamp?: number;
}

interface ClockValueProps {
  value: string;
}

const ClockValue = memo(
  forwardRef<HTMLParagraphElement, ClockValueProps>(function ClockValue({ value }, ref) {
    return (
      <p className="value mono" id="ntpClockValue" ref={ref}>
        {value}
      </p>
    );
  }),
);

function formatUptime(days: number, hours: number, minutes: number, seconds: number): string {
  return `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
}

function MetaGrid({ liveTimestamp }: MetaGridProps) {
  const clock = useClock(liveTimestamp);
  const uptime = useUptime();

  return (
    <section className="meta-grid" aria-label="Czas i start systemu">
      <article className="stat-card meta-card">
        <header className="stat-top">
          <p className="label">Projekt działa od</p>
          <img src="/elektryk-2.gif" id="uptimeGif" className="uptime-gif" alt="Uptime indicator" />
        </header>
        <p className="value mono" id="uptimeValue">{formatUptime(uptime.days, uptime.hours, uptime.minutes, uptime.seconds)}</p>
      </article>

      <article className="stat-card meta-card ntp-card">
        <header className="stat-top">
          <p className="label">Dokładny czas systemowy</p>
          <span className="tag live">NTP</span>
        </header>
        <ClockValue value={clock.displayTime} />
      </article>
    </section>
  );
}

export default MetaGrid;
