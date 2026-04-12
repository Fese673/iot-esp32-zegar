import { forwardRef, memo } from 'react';
import { useClock } from '../hooks/useClock';
import { formatDateTime } from '../../../shared/lib/timeHelpers';

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

function MetaGrid({ liveTimestamp }: MetaGridProps) {
  const clock = useClock(liveTimestamp);

  return (
    <section className="meta-grid" aria-label="Czas i start systemu">
      <article className="stat-card meta-card">
        <header className="stat-top">
          <p className="label">Projekt działa od</p>
          <img src="/elektryk-2.gif" id="uptimeGif" className="uptime-gif" alt="Uptime indicator" />
        </header>
        <p className="value mono" id="uptimeValue">{clock.startMs ? formatDateTime(clock.startMs) : '--'}</p>
        <p className="muted" id="projectStartTime">{clock.source === 'device' ? 'Źródło: device' : 'Źródło: local'}</p>
      </article>

      <article className="stat-card meta-card ntp-card">
        <header className="stat-top">
          <p className="label">Dokładny czas systemowy</p>
          <span className="tag live">NTP</span>
        </header>
        <ClockValue value={clock.displayTime} />
        <p className="muted" id="ntpClockMeta">
          {clock.source === 'device'
            ? `Źródło: device${clock.rtt != null ? ` • RTT ~${Math.round(clock.rtt)} ms` : ''}`
            : 'Brak NTP — używam czasu lokalnego'}
        </p>
      </article>
    </section>
  );
}

export default MetaGrid;
