import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.png';
import { APP_VERSION } from '../version';

export function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!login(password)) {
      setError('Incorrect password');
      setPassword('');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <img src={logo} alt="OssMNF" className="login-logo" />
        <h2>Welcome to OssMNF</h2>
        <p className="login-subtitle">Monday Night Football Manager</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="login-input"
              autoFocus
            />
          </div>
          {error && <p className="error-message">{error}</p>}
          <button type="submit" className="login-button">
            Enter
          </button>
        </form>
        <p className="version">v{APP_VERSION}</p>
      </div>
    </div>
  );
}
