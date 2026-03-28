import PmsLivePanel from './PmsLivePanel';
import PmsHistorySection from './PmsHistorySection';

function PmsSection() {
  return (
    <section className="panel pms-section" aria-label="Moduł czujnika cząstek PMS5003">
      <PmsLivePanel />
      <hr className="pms-separator" aria-hidden="true" />
      <PmsHistorySection />
    </section>
  );
}

export default PmsSection;
