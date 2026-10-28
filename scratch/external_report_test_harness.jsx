// Solo lo carga test_external_report_upload.mjs con los servicios interceptados.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import MyReportsPage from '../src/pages/MyReportsPage';
import '../src/index.css';

window.open = url => window.testState.opens.push(url);
const originalFetch = window.fetch;
window.fetch = (url, options) => url === '/__test_email'
  ? (window.testState.emails.push(JSON.parse(options.body)), Promise.resolve(new Response('ok')))
  : originalFetch(url, options);
createRoot(document.getElementById('root')).render(
  <MemoryRouter><MyReportsPage user={{uid:'synthetic-prof'}} userProfile={{role:'fonoaudiologa'}} isAdmin={false} /></MemoryRouter>
);
