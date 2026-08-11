import React from 'react';
import { useAuth } from '../hooks/useAuth';

export const AdminLanding: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      {/* Top Navbar */}
      <header style={{ backgroundColor: '#1e293b', borderBottom: '1px solid #334155', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#a855f7', margin: 0 }}>
            Coding Challenge 2026
          </h1>
          <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Admin Portal</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Administrator</div>
            <div style={{ fontSize: '0.8rem', color: '#c084fc' }}>{user?.username || 'admin@it.com'}</div>
          </div>

          <button
            onClick={() => logout()}
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', border: '1px solid #ef4444', padding: '0.5rem 1rem', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: 500, fontSize: '0.875rem' }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ maxWidth: '800px', margin: '3rem auto', padding: '0 1.5rem' }}>
        <div style={{ backgroundColor: '#1e293b', borderRadius: '1rem', border: '1px solid #9333ea', padding: '2.5rem', textAlign: 'center', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)' }}>
          <div style={{ display: 'inline-block', padding: '0.5rem 1.25rem', borderRadius: '9999px', backgroundColor: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', fontWeight: 600, fontSize: '0.875rem', marginBottom: '1.5rem', border: '1px solid #c084fc' }}>
            ADMINISTRATOR STANDBY
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.75rem', color: '#f8fafc' }}>
            Authenticated as {user?.username || 'admin@it.com'}
          </h2>

          <p style={{ color: '#94a3b8', fontSize: '1rem', maxWidth: '500px', margin: '0 auto 1.5rem auto', lineHeight: 1.6 }}>
            Admin foundation initialized successfully. Event management and round controls will be enabled in subsequent steps.
          </p>

          <div style={{ backgroundColor: '#0f172a', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #334155', display: 'inline-flex', gap: '2rem', fontSize: '0.875rem' }}>
            <div>
              <span style={{ color: '#64748b' }}>Role: </span>
              <span style={{ fontWeight: 600, color: '#c084fc' }}>{user?.role}</span>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Status: </span>
              <span style={{ fontWeight: 600, color: '#10b981' }}>Active Session</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
