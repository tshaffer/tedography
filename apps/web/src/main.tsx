import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import App from './App';
import { store } from './app/store';
import { DuplicateHubPage } from './components/duplicates/DuplicateHubPage';
import { DuplicateGroupsPage } from './components/duplicates/DuplicateGroupsPage';
import { DuplicateActionPlansPage } from './components/duplicates/DuplicateActionPlansPage';
import { DuplicateReconciliationsPage } from './components/duplicates/DuplicateReconciliationsPage';
import { DuplicateReviewPage } from './components/duplicates/DuplicateReviewPage';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/duplicates" element={<DuplicateHubPage />} />
          <Route path="/duplicates/review" element={<DuplicateReviewPage />} />
          <Route path="/duplicates/groups" element={<DuplicateGroupsPage />} />
          <Route path="/duplicates/plans" element={<DuplicateActionPlansPage />} />
          <Route path="/duplicates/reconciliations" element={<DuplicateReconciliationsPage />} />
        </Routes>
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);
