import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider as TooltipProvider } from '@radix-ui/react-tooltip';
import App from './App';
import { ProductShell } from './fgaa/ProductShell';
import './i18n';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TooltipProvider delayDuration={300}>
      <ProductShell>
        <App />
      </ProductShell>
    </TooltipProvider>
  </React.StrictMode>,
);
