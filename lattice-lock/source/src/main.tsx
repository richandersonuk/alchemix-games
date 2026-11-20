import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './components/App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Dev-only handle for debugging / automated playtests
if (import.meta.env.DEV) {
  import('./engine/waveManager').then(({ engine }) => {
    (window as unknown as { __engine: unknown }).__engine = engine;
  });
}

if (import.meta.env.DEV) {
  import('./engine/music').then(({ music }) => {
    (window as unknown as { __music: unknown }).__music = music;
  });
}
