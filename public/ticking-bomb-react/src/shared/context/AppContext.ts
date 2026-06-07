import { createContext, useContext, type Dispatch } from 'react';
import type { AlertItem, ConnectionStatus } from '../types';

export interface AppState {
  connectionStatus: ConnectionStatus;
  motionEnabled: boolean;
  alerts: AlertItem[];
  toast: AlertItem | null;
}

export type AppAction =
  | { type: 'SET_CONNECTION'; payload: ConnectionStatus }
  | { type: 'TOGGLE_MOTION' }
  | { type: 'ADD_ALERT'; payload: AlertItem }
  | { type: 'DISMISS_ALERT'; payload: string }
  | { type: 'SHOW_TOAST'; payload: AlertItem }
  | { type: 'HIDE_TOAST' };

export interface AppContextValue {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  pushAlert: (alert: Omit<AlertItem, 'id'> & { id?: string }) => string;
  dismissAlert: (id: string) => void;
  hideToast: () => void;
}

export const initialState: AppState = {
  connectionStatus: 'disconnected',
  motionEnabled: true,
  alerts: [],
  toast: null,
};

export const AppContext = createContext<AppContextValue | null>(null);

export function appReducer(state: AppState, action: AppAction): AppState {
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
