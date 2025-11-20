import '../../input.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { HudApp } from './HudApp';

const el = document.getElementById('hud-root');
if (!el) {
  throw new Error('HUD root element not found');
}

createRoot(el).render(<HudApp />);
