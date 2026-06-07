import { useEffect } from 'react';
import { useAppContext } from '../context/AppContext';

function Toast() {
  const { state, hideToast } = useAppContext();
  const toast = state.toast;

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      hideToast();
    }, toast.autoDismiss === false ? 5000 : 3500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [hideToast, toast]);

  if (!toast) {
    return null;
  }

  return (
    <div className={`toast ${toast.level} show`} id="toast" role="status" aria-live="polite">
      <div className="toast-inner">
        <p className="toast-label">{toast.level}</p>
        <p className="toast-message">{toast.message}</p>
      </div>
      <button type="button" className="ghost-btn" onClick={hideToast} aria-label="Zamknij toast">×</button>
    </div>
  );
}

export default Toast;