import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export const Register: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [batchNumber, setBatchNumber] = useState('284001');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');
  const [registeredStudent, setRegisteredStudent] = useState<{ studentId: string; fullName: string; batchNumber: string } | null>(null);

  const { registerStudent, clearError } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    clearError();

    const nameTrimmed = fullName.trim();
    const batchTrimmed = batchNumber.trim();

    if (!nameTrimmed) {
      setLocalError('Full name is required');
      return;
    }

    const batchRegex = /^2840\d{2}$/;
    if (!batchRegex.test(batchTrimmed)) {
      setLocalError('Batch number must be exactly 6 digits starting with 2840 (e.g. 284001)');
      return;
    }

    try {
      setSubmitting(true);
      const res = await registerStudent(nameTrimmed, batchTrimmed);
      setRegisteredStudent(res);
    } catch (err: any) {
      setLocalError(err.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (registeredStudent) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', color: '#f8fafc', padding: '1rem' }}>
        <div style={{ width: '100%', maxWidth: '440px', backgroundColor: '#1e293b', padding: '2.5rem', borderRadius: '1rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)', border: '1px solid #10b981', textAlign: 'center' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.2)', border: '2px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto', fontSize: '1.75rem' }}>
            ✓
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981', marginBottom: '0.5rem' }}>
            Registration Successful!
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Your student account has been created successfully.
          </p>

          <div style={{ backgroundColor: '#0f172a', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #334155', textAlign: 'left', marginBottom: '2rem' }}>
            <div style={{ marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assigned Student ID</span>
              <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#38bdf8' }}>{registeredStudent.studentId}</span>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Full Name</span>
              <span style={{ fontSize: '1rem', color: '#f8fafc' }}>{registeredStudent.fullName}</span>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Batch Number</span>
              <span style={{ fontSize: '1rem', color: '#f8fafc' }}>{registeredStudent.batchNumber}</span>
            </div>
          </div>

          <button
            onClick={() => navigate('/login')}
            style={{ width: '100%', padding: '0.875rem', backgroundColor: '#0284c7', color: '#ffffff', fontWeight: 600, borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontSize: '1rem' }}
          >
            GO TO LOGIN
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', color: '#f8fafc', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: '440px', backgroundColor: '#1e293b', padding: '2.5rem', borderRadius: '1rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)', border: '1px solid #334155' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#38bdf8', marginBottom: '0.5rem' }}>
            Coding Challenge 2026
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '1rem' }}>New Student Registration</p>
        </div>

        {localError && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#fca5a5', padding: '0.75rem 1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
            {localError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#cbd5e1', marginBottom: '0.5rem' }}>
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Jane Doe"
              style={{ width: '100%', padding: '0.75rem 1rem', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '0.5rem', color: '#f8fafc', fontSize: '1rem', outline: 'none' }}
              disabled={submitting}
            />
          </div>

          <div style={{ marginBottom: '1.75rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#cbd5e1', marginBottom: '0.5rem' }}>
              Batch Number (Format: 2840XX)
            </label>
            <input
              type="text"
              value={batchNumber}
              onChange={(e) => setBatchNumber(e.target.value)}
              placeholder="e.g. 284001"
              style={{ width: '100%', padding: '0.75rem 1rem', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '0.5rem', color: '#f8fafc', fontSize: '1rem', outline: 'none' }}
              disabled={submitting}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{ width: '100%', padding: '0.875rem', backgroundColor: '#0284c7', color: '#ffffff', fontWeight: 600, borderRadius: '0.5rem', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', fontSize: '1rem' }}
          >
            {submitting ? 'Registering...' : 'REGISTER'}
          </button>
        </form>

        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #334155', textAlign: 'center', fontSize: '0.875rem' }}>
          <Link to="/login" style={{ color: '#38bdf8', textDecoration: 'none' }}>
            Already registered? Login here
          </Link>
        </div>
      </div>
    </div>
  );
};
