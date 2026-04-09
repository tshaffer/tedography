import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import App from './App';
import { store } from './app/store';
import { PeopleBrowsePage } from './components/people/PeopleBrowsePage';
import { PeopleDevPage } from './components/people/PeopleDevPage';
import { PersonDetailPage } from './components/people/PersonDetailPage';
import { PeopleReviewPage } from './components/people/PeopleReviewPage';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <Provider store={store}>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/people" element={<PeopleBrowsePage />} />
        <Route path="/people/:personId" element={<PersonDetailPage />} />
        <Route path="/people/dev" element={<PeopleDevPage />} />
        <Route path="/people/review" element={<PeopleReviewPage />} />
      </Routes>
    </BrowserRouter>
  </Provider>
);
