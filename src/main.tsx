import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { Settings } from './lib/storage';

// Apply saved theme before first render to avoid flash
const savedSettings = Settings.get();
if (savedSettings.theme === 'light') {
  document.documentElement.classList.add('light');
} else {
  document.documentElement.classList.remove('light');
}

createRoot(document.getElementById("root")!).render(<App />);
