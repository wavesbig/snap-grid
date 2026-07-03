import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/geist';
import App from './App.tsx';
import '@/assets/styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
