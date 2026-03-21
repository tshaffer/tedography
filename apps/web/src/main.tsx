import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import App from './App';
import { store } from './app/store';
import { DuplicateReviewPage } from './components/duplicates/DuplicateReviewPage';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/duplicates" element={<Navigate to="/duplicates/review" replace />} />
          <Route path="/duplicates/review" element={<DuplicateReviewPage />} />
          <Route path="/duplicates/groups" element={<Navigate to="/duplicates/review" replace />} />
          <Route path="/duplicates/plans" element={<Navigate to="/duplicates/review" replace />} />
          <Route path="/duplicates/reconciliations" element={<Navigate to="/duplicates/review" replace />} />
        </Routes>
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);
