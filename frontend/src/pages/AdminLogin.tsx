import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export const AdminLogin: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');

  const { loginAdmin, clearError } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    clearError();

    if (!username.trim()) {
      setLocalError('Username is required');
      return;
    }
    if (!password) {
      setLocalError('Password is required');
      return;
    }

    try {
      setSubmitting(true);
      await loginAdmin(username, password);
      navigate('/admin/dashboard');
    } catch (err: any) {
      setLocalError(err.message || 'Invalid credentials');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', color: '#f8fafc', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: '420px', backgroundColor: '#1e293b', padding: '2.5rem', borderRadius: '1rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)', border: '1px solid #334155' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#a855f7', marginBottom: '0.5rem' }}>
            Coding Challenge 2026
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '1rem' }}>Administrator Portal</p>
        </div>

        {localError && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#fca5a5', padding: '0.75rem 1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
            {localError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#cbd5e1', marginBottom: '0.5rem' }}>
              Username / Email
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. admin@it.com"
              style={{ width: '100%', padding: '0.75rem 1rem', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '0.5rem', color: '#f8fafc', fontSize: '1rem', outline: 'none' }}
              disabled={submitting}
            />
          </div>

          <div style={{ marginBottom: '1.75rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#cbd5e1', marginBottom: '0.5rem' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{ width: '100%', padding: '0.75rem 1rem', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '0.5rem', color: '#f8fafc', fontSize: '1rem', outline: 'none' }}
              disabled={submitting}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{ width: '100%', padding: '0.875rem', backgroundColor: '#9333ea', color: '#ffffff', fontWeight: 600, borderRadius: '0.5rem', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', fontSize: '1rem' }}
          >
            {submitting ? 'Authenticating...' : 'ADMIN LOGIN'}
          </button>
        </form>

        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #334155', textAlign: 'center', fontSize: '0.875rem' }}>
          <Link to="/login" style={{ color: '#38bdf8', textDecoration: 'none' }}>
            ← Back to Student Login
          </Link>
        </div>
      </div>
    </div>
  );
};
