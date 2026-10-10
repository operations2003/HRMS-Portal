import React, { Component } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/index.css';

// Unregister any stale service workers and clear browser caches on startup
if (typeof window !== 'undefined') {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((reg) => reg.unregister());
    }).catch(() => {});
  }
  if (typeof caches !== 'undefined') {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name));
    }).catch(() => {});
  }
}

// Global Vite chunk load error & cache mismatch handler
const handleChunkOrCacheError = (errorMsg) => {
  const msg = (errorMsg || '').toLowerCase();
  const isChunkError =
    msg.includes('dynamically imported module') ||
    msg.includes('loading chunk') ||
    msg.includes('chunkloaderror') ||
    msg.includes('importing a module script failed') ||
    msg.includes('cache') ||
    msg.includes('outdated optimize dep');

  if (isChunkError) {
    if (typeof caches !== 'undefined') {
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name));
      }).catch(() => {});
    }
    const lastReload = parseInt(sessionStorage.getItem('hrms_chunk_reload_ts') || '0', 10);
    // Reload at most once every 10 seconds to avoid infinite loops
    if (Date.now() - lastReload > 10000) {
      sessionStorage.setItem('hrms_chunk_reload_ts', String(Date.now()));
      window.location.href = window.location.pathname + '?_reload=' + Date.now();
      return true;
    }
  }
  return false;
};

// Catch Vite dynamic import failure event
window.addEventListener('vite:preloadError', (event) => {
  console.warn('Vite preload error detected, auto-reloading to fetch newest application build:', event);
  const lastReload = parseInt(sessionStorage.getItem('hrms_chunk_reload_ts') || '0', 10);
  if (Date.now() - lastReload > 10000) {
    sessionStorage.setItem('hrms_chunk_reload_ts', String(Date.now()));
    window.location.reload();
  }
});

// Catch unhandled script/chunk loading errors
window.addEventListener('error', (event) => {
  handleChunkOrCacheError(event?.message || event?.error?.message);
});

// Catch unhandled promise rejections specifically for dynamic script chunk import failures
window.addEventListener('unhandledrejection', (event) => {
  const reason = event?.reason;
  const msg = typeof reason === 'string' ? reason : reason?.message || '';
  if (
    msg.toLowerCase().includes('dynamically imported module') ||
    msg.toLowerCase().includes('loading chunk')
  ) {
    handleChunkOrCacheError(msg);
  }
});

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('TaskNera HRMS Uncaught UI Exception:', error, errorInfo);
    // Auto-recover if it is a chunk/cache error
    const recovered = handleChunkOrCacheError(error?.message);
    if (recovered) {
      return;
    }
  }

  handleHardRefresh = () => {
    // Clear browser caches if Cache API exists
    if (typeof caches !== 'undefined') {
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name));
      }).catch(() => {});
    }
    sessionStorage.clear();
    window.location.href = window.location.pathname + '?_t=' + Date.now();
  };

  handleFullReset = () => {
    if (typeof caches !== 'undefined') {
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name));
      }).catch(() => {});
    }
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/login?_reset=' + Date.now();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center font-sans">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-slate-200">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-xl">
              !
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h2>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              {this.state.error?.message || 'An unexpected rendering error occurred.'}
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={this.handleHardRefresh}
                className="w-full py-2.5 px-4 rounded-xl bg-brand-500 text-white font-semibold text-sm hover:bg-brand-600 transition-colors shadow-md shadow-brand-500/20"
              >
                Refresh Application
              </button>
              <button
                type="button"
                onClick={this.handleFullReset}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-100 text-slate-700 font-medium text-xs hover:bg-slate-200 transition-colors"
              >
                Clear Cache & Go to Login
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
