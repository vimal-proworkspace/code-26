import React, { useState, useEffect } from 'react';
import { violationApi, AdminViolationOverviewResponse } from '../services/violationApi';

export const SecurityViolationsTab: React.FC = () => {
  const [data, setData] = useState<AdminViolationOverviewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterStudentId, setFilterStudentId] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('ALL');

  // Invigilator unlock state inside admin tab
  const [unlockPassword] = useState<string>('admin@sara');
  const [unlockingId, setUnlockingId] = useState<string | null>(null);

  const fetchOverview = async () => {
    try {
      setLoading(true);
      const res = await violationApi.getAdminViolationOverview();
      setData(res);
    } catch (err: any) {
      console.error('Failed to fetch security violations overview:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
    const interval = setInterval(fetchOverview, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAdminUnlockStudent = async (studentDbId: string, studentId: string) => {
    try {
      setUnlockingId(studentDbId);
      await violationApi.invigilatorUnlock(unlockPassword, studentDbId);
      alert(`Student ${studentId} has been unlocked successfully.`);
      await fetchOverview();
    } catch (err: any) {
      alert(`Failed to unlock student: ${err.message}`);
    } finally {
      setUnlockingId(null);
    }
  };

  const filteredViolations = (data?.recentViolations || []).filter((v) => {
    const matchesStudent = !filterStudentId || v.studentId.toLowerCase().includes(filterStudentId.toLowerCase());
    const matchesType = filterType === 'ALL' || v.type === filterType;
    return matchesStudent && matchesType;
  });

  if (loading && !data) {
    return <div style={{ color: '#94a3b8', padding: '2rem', textAlign: 'center' }}>Loading security violations dashboard...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Metrics Summary Header Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
        <div style={{ backgroundColor: '#1e293b', borderRadius: '0.75rem', border: '1px solid #334155', padding: '1.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            Configured Violation Limit
          </span>
          <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#38bdf8', marginTop: '0.25rem' }}>
            {data?.maximumAllowed ?? 3} violations
          </div>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>EventSettings.maximumViolations</span>
        </div>

        <div style={{ backgroundColor: '#1e293b', borderRadius: '0.75rem', border: '1px solid #334155', padding: '1.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            Total Recorded Violations
          </span>
          <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#f59e0b', marginTop: '0.25rem' }}>
            {data?.totalViolations ?? 0}
          </div>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Persisted in PostgreSQL</span>
        </div>

        <div style={{ backgroundColor: '#1e293b', borderRadius: '0.75rem', border: '1px solid #ef4444', padding: '1.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            Currently Locked Students
          </span>
          <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#ef4444', marginTop: '0.25rem' }}>
            {data?.lockedCount ?? 0}
          </div>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Requires Invigilator Continuation</span>
        </div>
      </div>

      {/* Locked Students Section */}
      {data?.lockedStudents && data.lockedStudents.length > 0 && (
        <div style={{ backgroundColor: '#1e293b', borderRadius: '1rem', border: '2px solid #ef4444', padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#ef4444', marginBottom: '1rem' }}>
            🔒 Currently Locked Students ({data.lockedStudents.length})
          </h3>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#0f172a', color: '#94a3b8', borderBottom: '1px solid #334155' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Student ID</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Full Name</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Batch</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Round</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Locked At</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.lockedStudents.map((ls) => (
                  <tr key={ls.studentDbId} style={{ borderBottom: '1px solid #334155', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 'bold', color: '#ef4444' }}>{ls.studentId}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#f8fafc' }}>{ls.fullName}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>{ls.batchNumber}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#38bdf8' }}>{ls.roundName}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>{ls.lockedAt ? new Date(ls.lockedAt).toLocaleTimeString() : 'N/A'}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <button
                        onClick={() => handleAdminUnlockStudent(ls.studentDbId, ls.studentId)}
                        disabled={unlockingId === ls.studentDbId}
                        style={{
                          backgroundColor: '#16a34a',
                          color: '#ffffff',
                          border: 'none',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '0.375rem',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: unlockingId === ls.studentDbId ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {unlockingId === ls.studentDbId ? 'Unlocking...' : 'Unlock Student'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Violations Log Table */}
      <div style={{ backgroundColor: '#1e293b', borderRadius: '1rem', border: '1px solid #334155', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#f8fafc', margin: 0 }}>
              🛡️ Audit & Security Violation History
            </h3>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Real-time feed of detected security events (Fullscreen exits, tab switches, window blurs).
            </span>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <input
              type="text"
              value={filterStudentId}
              onChange={(e) => setFilterStudentId(e.target.value)}
              placeholder="Filter by Student ID..."
              style={{ padding: '0.4rem 0.75rem', borderRadius: '0.375rem', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', fontSize: '0.85rem' }}
            />

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{ padding: '0.4rem 0.75rem', borderRadius: '0.375rem', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', fontSize: '0.85rem' }}
            >
              <option value="ALL">All Violation Types</option>
              <option value="FULLSCREEN_EXIT">FULLSCREEN_EXIT</option>
              <option value="TAB_SWITCH">TAB_SWITCH</option>
              <option value="WINDOW_BLUR">WINDOW_BLUR</option>
            </select>

            <button
              onClick={fetchOverview}
              style={{ backgroundColor: '#334155', color: '#f8fafc', border: '1px solid #475569', padding: '0.4rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#0f172a', color: '#94a3b8', borderBottom: '1px solid #334155' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Timestamp</th>
                <th style={{ padding: '0.75rem 1rem' }}>Student ID</th>
                <th style={{ padding: '0.75rem 1rem' }}>Student Name</th>
                <th style={{ padding: '0.75rem 1rem' }}>Round</th>
                <th style={{ padding: '0.75rem 1rem' }}>Violation Type</th>
                <th style={{ padding: '0.75rem 1rem' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredViolations.length > 0 ? (
                filteredViolations.map((v) => (
                  <tr key={v.id} style={{ borderBottom: '1px solid #334155' }}>
                    <td style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                      {new Date(v.timestamp).toLocaleTimeString()}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#38bdf8' }}>{v.studentId}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#f8fafc' }}>{v.studentName}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#c084fc' }}>{v.roundName}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span
                        style={{
                          padding: '0.2rem 0.5rem',
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          backgroundColor: v.type === 'FULLSCREEN_EXIT' ? 'rgba(239, 68, 68, 0.2)' : v.type === 'TAB_SWITCH' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(148, 163, 184, 0.2)',
                          color: v.type === 'FULLSCREEN_EXIT' ? '#ef4444' : v.type === 'TAB_SWITCH' ? '#f59e0b' : '#94a3b8',
                          border: `1px solid ${v.type === 'FULLSCREEN_EXIT' ? '#ef4444' : v.type === 'TAB_SWITCH' ? '#f59e0b' : '#94a3b8'}`,
                        }}
                      >
                        {v.type}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1', fontSize: '0.8rem' }}>{v.details || 'Detected by anti-cheating monitor'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    No security violations recorded for the selected filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
