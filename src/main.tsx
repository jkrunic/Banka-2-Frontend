import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './index.css';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ArbitroProvider } from './context/ArbitroContext';
import App from './App';

// Suppress Recharts noisy `width(-1) and height(-1) of chart should be > 0`
// warning koji spamuje console pri layout transition-ima i pre nego sto
// ResponsiveContainer dobije svoj measured size. Cisto kosmeticki — chart
// se uvek pravilno renderuje cim parent dobije dimenzije. Recharts maintainer-i
// ostavili warning iako je pre-mount izmera regularna React faza (vidi
// https://github.com/recharts/recharts/issues/3615).
if (typeof window !== 'undefined' && import.meta.env?.MODE !== 'test') {
  const RECHARTS_SIZE_WARN = /(?:width|height)\(-?\d+\) (?:and (?:width|height)\(-?\d+\) )?of chart should be greater than 0/;
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && RECHARTS_SIZE_WARN.test(args[0])) return;
    originalWarn.apply(console, args);
  };
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && RECHARTS_SIZE_WARN.test(args[0])) return;
    originalLog.apply(console, args);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <ArbitroProvider>
            <App />
          </ArbitroProvider>
        </AuthProvider>
        <ToastContainer position="bottom-right" autoClose={4000} />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>
);
