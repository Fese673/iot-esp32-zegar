import TopBar from './features/dashboard/components/TopBar';
import MetaGrid from './features/dashboard/components/MetaGrid';
import LiveGrid from './features/dashboard/components/LiveGrid';
import AlertsSection from './shared/components/AlertsSection';
import Toast from './shared/components/Toast';
import Footer from './features/dashboard/components/Footer';
import { Suspense, lazy, useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { useConnectionHealth } from './features/dashboard/hooks/useConnectionHealth';
import { useLiveMetrics } from './features/dashboard/hooks/useLiveMetrics';
import type { AlertItem } from './shared/types';
import { AppContext, appReducer, initialState, useAppContext, type AppContextValue } from './shared/context/AppContext';

const HistoryPanel = lazy(() => import('./features/dashboard/components/HistoryPanel'));
const PmsSection = lazy(() => import('./features/pms/components/PmsSection'));

function SectionFallback({ label, title, className }: { label: string; title: string; className?: string }) {
  return (
    <section className={className ?? 'panel'} aria-label={label}>
      <header className="panel-head">
        <div>
          <p className="eyebrow">Ładowanie</p>
          <h2>{title}</h2>
        </div>
      </header>
    </section>
  );
}

declare global {
  interface Window {
    __notifyAlert?: (alert: Omit<AlertItem, 'id'> & { id?: string }) => string;
  }
}

function DashboardContent() {
  const { state, dispatch } = useAppContext();
  const liveMetrics = useLiveMetrics();
  const { lastSeen } = useConnectionHealth(liveMetrics.data);
  const refreshDashboard = useCallback(() => {
    window.location.reload();
  }, []);

  return (
    <>
      <div className="scanlines" aria-hidden="true"></div>
      <div className="bg-grid" aria-hidden="true"></div>

      <main className="app-shell">
        <TopBar
          motionEnabled={state.motionEnabled}
          onToggleMotion={() => dispatch({ type: 'TOGGLE_MOTION' })}
          onRefresh={refreshDashboard}
          connectionStatus={state.connectionStatus}
        />
        <MetaGrid liveTimestamp={liveMetrics.data?.ts} />
        <LiveGrid
          liveRecord={liveMetrics.data}
          loadState={liveMetrics.status}
          connectionStatus={state.connectionStatus}
          lastSeen={lastSeen}
        />
        <Suspense fallback={<SectionFallback label="Ładowanie historii danych" title="Historia ładuje się..." />}>
          <HistoryPanel liveRecord={liveMetrics.data} />
        </Suspense>
        <Suspense fallback={<SectionFallback label="Ładowanie sekcji PMS" title="PMS ładuje się..." className="panel pms-section" />}>
          <PmsSection />
        </Suspense>
        <AlertsSection />
        <Footer />
      </main>

      <Toast />
    </>
  );
}

function App() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const hasReportedFirebaseErrorRef = useRef(false);

  const pushAlert = useCallback((alert: Omit<AlertItem, 'id'> & { id?: string }) => {
    const id = alert.id ?? (globalThis.crypto?.randomUUID?.() ?? `alert-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const nextAlert: AlertItem = {
      id,
      level: alert.level,
      message: alert.message,
      autoDismiss: alert.autoDismiss,
    };

    dispatch({ type: 'ADD_ALERT', payload: nextAlert });
    dispatch({ type: 'SHOW_TOAST', payload: nextAlert });
    return id;
  }, [dispatch]);

  const dismissAlert = useCallback((id: string) => {
    dispatch({ type: 'DISMISS_ALERT', payload: id });
  }, [dispatch]);

  const hideToast = useCallback(() => {
    dispatch({ type: 'HIDE_TOAST' });
  }, [dispatch]);

  useEffect(() => {
    window.__notifyAlert = pushAlert;

    return () => {
      delete window.__notifyAlert;
    };
  }, [pushAlert]);

  useEffect(() => {
    const reportFirebaseError = (rawMessage: string) => {
      if (hasReportedFirebaseErrorRef.current) {
        return;
      }

      const message = rawMessage.toLowerCase();
      if (!message.includes('firebase') && !message.includes('permission denied') && !message.includes('database url')) {
        return;
      }

      hasReportedFirebaseErrorRef.current = true;
      pushAlert({
        level: 'error',
        message: message.includes('permission denied')
          ? 'Brak dostępu do Firebase — sprawdź reguły bazy.'
          : 'Błąd Firebase — sprawdź konfigurację bazy.',
        autoDismiss: false,
      });
    };

    const handleError = (event: ErrorEvent) => {
      reportFirebaseError(event.message || event.error?.message || '');
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason || '');
      reportFirebaseError(message);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [pushAlert]);

  useEffect(() => {
    document.documentElement.classList.toggle('motion-off', !state.motionEnabled);
  }, [state.motionEnabled]);

  const value = useMemo<AppContextValue>(() => ({
    state,
    dispatch,
    pushAlert,
    dismissAlert,
    hideToast,
  }), [state, dispatch, pushAlert, dismissAlert, hideToast]);

  return (
    <AppContext.Provider value={value}>
      <DashboardContent />
    </AppContext.Provider>
  );
}

export default App;
