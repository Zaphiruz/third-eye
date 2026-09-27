import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/600.css';
import './index.css';
import { App } from './App';
import { store } from './store';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}><BrowserRouter><App /></BrowserRouter></Provider>
  </React.StrictMode>,
);
