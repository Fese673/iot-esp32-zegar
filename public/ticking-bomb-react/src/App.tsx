import TopBar from './features/dashboard/components/TopBar';
import MetaGrid from './features/dashboard/components/MetaGrid';
import LiveGrid from './features/dashboard/components/LiveGrid';
import HistoryPanel from './features/dashboard/components/HistoryPanel';
import PmsSection from './features/pms/components/PmsSection';
import AlertsSection from './shared/components/AlertsSection';
import Toast from './shared/components/Toast';
import Footer from './features/dashboard/components/Footer';
import { createContext, useCallback, useContext, useEffect, useReducer, type Dispatch } from 'react';
import { useConnectionHealth } from './features/dashboard/hooks/useConnectionHealth';
import { useLiveMetrics } from './features/dashboard/hooks/useLiveMetrics';
import type { AlertItem, ConnectionStatus } from './shared/types';

declare global {
  interface Window {
    __notifyAlert?: (alert: Omit<AlertItem, 'id'> & { id?: string }) => string;
  }
}

interface AppState {
  connectionStatus: ConnectionStatus;
  motionEnabled: boolean;
  alerts: AlertItem[];
  toast: AlertItem | null;
}

type AppAction =
  | { type: 'SET_CONNECTION'; payload: ConnectionStatus }
  | { type: 'TOGGLE_MOTION' }
  | { type: 'ADD_ALERT'; payload: AlertItem }
  | { type: 'DISMISS_ALERT'; payload: string }
  | { type: 'SHOW_TOAST'; payload: AlertItem }
  | { type: 'HIDE_TOAST' };

interface AppContextValue {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  pushAlert: (alert: Omit<AlertItem, 'id'> & { id?: string }) => string;
  dismissAlert: (id: string) => void;
  hideToast: () => void;
}

const initialState: AppState = {
  connectionStatus: 'disconnected',
  motionEnabled: true,
  alerts: [],
  toast: null,
};

const AppContext = createContext<AppContextValue | null>(null);

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_CONNECTION':
      return { ...state, connectionStatus: action.payload };
    case 'TOGGLE_MOTION':
      return { ...state, motionEnabled: !state.motionEnabled };
    case 'ADD_ALERT':
      return { ...state, alerts: [action.payload, ...state.alerts] };
    case 'DISMISS_ALERT':
      return { ...state, alerts: state.alerts.filter((alert) => alert.id !== action.payload) };
    case 'SHOW_TOAST':
      return { ...state, toast: action.payload };
    case 'HIDE_TOAST':
      return { ...state, toast: null };
    default:
      return state;
  }
}

export function useAppContext(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppContext.Provider');
  }

  return context;
}

function DashboardContent() {
  const { state, dispatch } = useAppContext();
  const liveMetrics = useLiveMetrics();
  const { lastSeen } = useConnectionHealth(liveMetrics.data);

  return (
    <>
      <div className="scanlines" aria-hidden="true"></div>
      <div className="bg-grid" aria-hidden="true"></div>

      <main className="app-shell">
        <TopBar
          motionEnabled={state.motionEnabled}
          onToggleMotion={() => dispatch({ type: 'TOGGLE_MOTION' })}
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
        <AlertsSection />
        <Footer />
      </main>

      <Toast />
    </>
  );
}

function App() {
  const [state, dispatch] = useReducer(appReducer, initialState);

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
    document.documentElement.classList.toggle('motion-off', !state.motionEnabled);
  }, [state.motionEnabled]);

  const value: AppContextValue = { state, dispatch, pushAlert, dismissAlert, hideToast };

  return (
    <AppContext.Provider value={value}>
      <DashboardContent />
    </AppContext.Provider>
  );
}

export default App;
