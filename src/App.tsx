import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { Login } from './components/Login';
import { Layout } from './components/Layout';
import { Play } from './pages/Play';
import { Results } from './pages/Results';
import { Stats } from './pages/Stats';
import { Configuration } from './pages/Configuration';
import './App.css';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
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
        path="/"
        element={
          <ProtectedRoute>
            <DataProvider>
              <Layout />
            </DataProvider>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/play" replace />} />
        <Route path="play" element={<Play />} />
        <Route path="results" element={<Results />} />
        <Route path="stats" element={<Stats />} />
        <Route path="config" element={<Configuration />} />
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
