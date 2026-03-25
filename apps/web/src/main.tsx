import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import App from './App';
import { store } from './app/store';
import { DuplicateReviewPage } from './components/duplicates/DuplicateReviewPage';
import { PeopleBrowsePage } from './components/people/PeopleBrowsePage';
import { PeopleDevPage } from './components/people/PeopleDevPage';
import { PeopleReviewPage } from './components/people/PeopleReviewPage';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/duplicates" element={<Navigate to="/duplicates/review" replace />} />
          <Route path="/duplicates/review" element={<DuplicateReviewPage />} />
          <Route path="/people" element={<PeopleBrowsePage />} />
          <Route path="/people/dev" element={<PeopleDevPage />} />
          <Route path="/people/review" element={<PeopleReviewPage />} />
        </Routes>
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);
