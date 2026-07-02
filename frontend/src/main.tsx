import * as React from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/app/App';
import '@/styles/globals.css';

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('Root element #root not found in DOM');
}

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
