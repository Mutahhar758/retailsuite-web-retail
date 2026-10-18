import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { initAutoVersionRefresh } from './utils/autoVersionRefresh';

// Start background version check & cache auto-refresh
initAutoVersionRefresh();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
