import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConsoleCapture } from 'browser-mobile-debug-panel'
import './index.css'
import App from './App.tsx'

// Start capturing console output before anything else runs,
// so boot-time logs (model loading, errors, etc.) are included in debug reports.
export const bootConsoleCapture = new ConsoleCapture(500);
bootConsoleCapture.start();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
