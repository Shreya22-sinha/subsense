import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import './index.css';
import { router } from './router';
import { initAuth } from './store/authStore';
import { startStoreEffects } from './store/effects';

// Restores the demo at once; a signed-in account shows a short loading screen first.
startStoreEffects();
void initAuth();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
