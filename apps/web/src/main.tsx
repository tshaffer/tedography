import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import App from './App';
import { store } from './app/store';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginScreen } from './components/auth/LoginScreen';
import { PeopleBrowsePage } from './components/people/PeopleBrowsePage';
import { PeopleDevPage } from './components/people/PeopleDevPage';
import { PersonDetailPage } from './components/people/PersonDetailPage';
import { PeopleReviewPage } from './components/people/PeopleReviewPage';
import { UsersPage } from './components/admin/UsersPage';
import { RolesPage } from './components/admin/RolesPage';

function AuthGate({ children }: { children: React.ReactNode }): React.ReactElement {
  const { user, loading } = useAuth();
  if (loading) {
    // Blank while we check for an existing session
    return <div style={{ height: '100vh', background: '#1a1a2e' }} />;
  }
  if (!user) {
    return <LoginScreen />;
  }
  return <>{children}</>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <Provider store={store}>
    <AuthProvider>
      <AuthGate>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/people" element={<PeopleBrowsePage />} />
            <Route path="/people/:personId" element={<PersonDetailPage />} />
            <Route path="/people/dev" element={<PeopleDevPage />} />
            <Route path="/people/review" element={<PeopleReviewPage />} />
            <Route path="/admin/users" element={<UsersPage />} />
            <Route path="/admin/roles" element={<RolesPage />} />
          </Routes>
        </BrowserRouter>
      </AuthGate>
    </AuthProvider>
  </Provider>
);
