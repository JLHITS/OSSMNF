import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { Login } from './components/Login';
import { Layout } from './components/Layout';
import { Play } from './pages/Play';
import { Results } from './pages/Results';
import { Stats } from './pages/Stats';
import { Configuration } from './pages/Configuration';
import { PlayerProfile } from './pages/PlayerProfile';
import './App.css';

function ProtectedOutlet() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/play" replace /> : <Login />}
      />
      <Route
        path="/player/:playerSlug"
        element={
          <DataProvider>
            <PlayerProfile />
          </DataProvider>
        }
      />
      <Route
        path="/"
        element={
          <DataProvider>
            <Layout />
          </DataProvider>
        }
      >
        <Route index element={<Navigate to="/play" replace />} />
        <Route path="stats" element={<Stats />} />
        <Route element={<ProtectedOutlet />}>
          <Route path="play" element={<Play />} />
          <Route path="results" element={<Results />} />
          <Route path="config" element={<Configuration />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/play" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
