import {StrictMode} from 'react';
import { initAds } from './services/ads';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initBilling } from './services/billing' // 👈 خط جدید ۱: ایمپورت کردن

initBilling()
initAds();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
