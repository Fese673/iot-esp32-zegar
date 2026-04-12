import TopBar from './features/dashboard/components/TopBar';
import MetaGrid from './features/dashboard/components/MetaGrid';
import LiveGrid from './features/dashboard/components/LiveGrid';
import AlertsSection from './shared/components/AlertsSection';
import Toast from './shared/components/Toast';
import Footer from './features/dashboard/components/Footer';
import { Suspense, lazy, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useConnectionHealth } from './features/dashboard/hooks/useConnectionHealth';
import { useLiveMetrics } from './features/dashboard/hooks/useLiveMetrics';
import type { AlertItem } from './shared/types';
import { AppContext, appReducer, initialState, useAppContext, type AppContextValue } from './shared/context/AppContext';
import { DeviceTelemetryProvider } from './shared/context/DeviceTelemetryContext';
import HistoryPanel from './features/dashboard/components/HistoryPanel';
import PmsSection from './features/pms/components/PmsSection';
import Ens160Section from './features/ens160/components/Ens160Section';

const AnalysisPage = lazy(() => import('./features/analiza/components/AnalysisPage'));
const DocumentationPage = lazy(() => import('./features/dokumentacja/components/DocumentationPage'));

type ActivePage = 'dashboard' | 'analysis' | 'documentation';

function resolveActivePageFromHash(hash: string): ActivePage {
  if (hash.startsWith('#analiza-danych')) {
    return 'analysis';
  }

  if (hash.startsWith('#dokumentacja')) {
    return 'documentation';
  }

  return 'dashboard';
}

declare global {
  interface Window {
    __notifyAlert?: (alert: Omit<AlertItem, 'id'> & { id?: string }) => string;
  }
}

function DashboardContent() {
  const { state, dispatch } = useAppContext();
  const [activePage, setActivePage] = useState<ActivePage>(() => resolveActivePageFromHash(window.location.hash));

  const liveMetrics = useLiveMetrics();
  const { lastSeen } = useConnectionHealth(liveMetrics.data);

  useEffect(() => {
    const handleHashChange = () => {
      setActivePage(resolveActivePageFromHash(window.location.hash));
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    const active = activePage === 'analysis';
    document.documentElement.classList.toggle('analysis-page-active', active);
    document.body.classList.toggle('analysis-page-active', active);

    return () => {
      document.documentElement.classList.remove('analysis-page-active');
      document.body.classList.remove('analysis-page-active');
    };
  }, [activePage]);

  const refreshDashboard = useCallback(() => {
    window.location.reload();
  }, []);

  const openAnalysis = useCallback(() => {
    window.location.hash = '#analiza-danych';
    setActivePage('analysis');
  }, []);

  const openDocumentation = useCallback(() => {
    window.location.hash = '#dokumentacja';
    setActivePage('documentation');
  }, []);

  const backToDashboard = useCallback(() => {
    window.location.hash = '';
    setActivePage('dashboard');
  }, []);

  if (activePage === 'analysis') {
    return (
      <Suspense
        fallback={
          <main className="app-shell analysis-shell">
            <section className="panel analysis-empty" aria-live="polite">
              <h3>Ladowanie modulu analizy</h3>
              <p>Doczytuje sie wizualizacja i wzory matematyczne.</p>
            </section>
          </main>
        }
      >
        <div className="scanlines" aria-hidden="true"></div>
        <div className="bg-grid" aria-hidden="true"></div>
        <AnalysisPage
          onBack={backToDashboard}
          liveRecord={liveMetrics.data}
          loadState={liveMetrics.status}
          connectionStatus={state.connectionStatus}
          motionEnabled={state.motionEnabled}
        />
      </Suspense>
    );
  }

  if (activePage === 'documentation') {
    return (
      <Suspense
        fallback={
          <main className="app-shell">
            <section className="panel analysis-empty" aria-live="polite">
              <h3>Ladowanie modulu dokumentacji</h3>
              <p>Doczytuje sie komplet sekcji i markdown.</p>
            </section>
          </main>
        }
      >
        <div className="scanlines" aria-hidden="true"></div>
        <div className="bg-grid" aria-hidden="true"></div>
        <DocumentationPage onBack={backToDashboard} />
      </Suspense>
    );
  }

  return (
    <>
      <div className="scanlines" aria-hidden="true"></div>
      <div className="bg-grid" aria-hidden="true"></div>

      <main className="app-shell">
        <TopBar
          motionEnabled={state.motionEnabled}
          onToggleMotion={() => dispatch({ type: 'TOGGLE_MOTION' })}
          onRefresh={refreshDashboard}
          onOpenAnalysis={openAnalysis}
          onOpenDocumentation={openDocumentation}
          connectionStatus={state.connectionStatus}
        />
        <MetaGrid liveTimestamp={liveMetrics.data?.ts} />
        <LiveGrid
          liveRecord={liveMetrics.data}
          loadState={liveMetrics.status}
          connectionStatus={state.connectionStatus}
          lastSeen={lastSeen}
        />
        <HistoryPanel liveRecord={liveMetrics.data} />
        <PmsSection />
        <Ens160Section />
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
      <DeviceTelemetryProvider>
        <DashboardContent />
      </DeviceTelemetryProvider>
    </AppContext.Provider>
  );
}

export default App;
