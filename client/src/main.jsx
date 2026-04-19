import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// When a new service worker takes control (i.e. a new version deployed),
// reload once so users get the latest build automatically.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Guard against reload loops — only reload if we haven't just done so.
    if (!sessionStorage.getItem('sw-reloaded')) {
      sessionStorage.setItem('sw-reloaded', '1');
      window.location.reload();
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
