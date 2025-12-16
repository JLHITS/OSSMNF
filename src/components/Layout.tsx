import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.png';
import { APP_VERSION } from '../version';

export function Layout() {
  const { logout } = useAuth();

  return (
    <div className="app-layout">
      <header className="app-header">
        <img src={logo} alt="OssMNF" className="header-logo" />
        <nav className="main-nav">
          <NavLink to="/play" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Play
          </NavLink>
          <NavLink to="/results" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Results
          </NavLink>
          <NavLink to="/stats" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Stats
          </NavLink>
          <NavLink to="/config" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Configuration
          </NavLink>
        </nav>
        <button onClick={logout} className="logout-button" data-emoji="👋">
          Logout
        </button>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
      <footer className="app-footer">
        <p>OssMNF v{APP_VERSION}</p>
      </footer>
    </div>
  );
}
