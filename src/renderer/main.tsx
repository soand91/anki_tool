import './input.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

// Mount React into #root and render the app.
// Keep this file minimal: no DOM mutations, no API calls.
const el = document.getElementById('root')!;
createRoot(el).render(<App />);