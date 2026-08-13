import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { adminStudentApi, StudentListResponse, StudentDetailResponse } from '../services/adminStudentApi';
import { violationApi } from '../services/violationApi';

export const StudentManagementTab: React.FC = () => {
  const { adminMetrics } = useSocket();
  const [data, setData] = useState<StudentListResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Search & Filter State
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('studentId');
  const [sortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(25);

  // Inspection Drawer/Modal State
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [inspectionData, setInspectionData] = useState<StudentDetailResponse | null>(null);
  const [inspectionLoading, setInspectionLoading] = useState<boolean>(false);
  const [inspectionTab, setInspectionTab] = useState<'OVERVIEW' | 'ROUND1' | 'ROUND2' | 'ROUND3'>('OVERVIEW');
  const [selectedCodeView, setSelectedCodeView] = useState<{ title: string; language?: string; code: string } | null>(null);

  const fetchList = async () => {
    try {
      setLoading(true);
      const res = await adminStudentApi.getStudentsList({
        search,
        statusFilter,
        page,
        limit,
        sortBy,
        sortOrder,
      });
      setData(res);
    } catch (err: any) {
      console.error('Failed to fetch student management list:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch list on filter/page changes
  useEffect(() => {
    fetchList();
  }, [search, statusFilter, sortBy, sortOrder, page, limit]);

  // Real-time socket metrics trigger refresh
  useEffect(() => {
    if (adminMetrics) {
      fetchList();
    }
  }, [adminMetrics]);

  const handleInspectStudent = async (studentId: string) => {
    try {
      setSelectedStudentId(studentId);
      setInspectionLoading(true);
      setInspectionTab('OVERVIEW');
      const detail = await adminStudentApi.getStudentDetail(studentId);
      setInspectionData(detail);
    } catch (err: any) {
      alert(`Failed to load student details: ${err.message}`);
    } finally {
      setInspectionLoading(false);
    }
  };

  const handleToggleAccountStatus = async (studentDbId: string, currentActive: boolean) => {
    try {
      await adminStudentApi.toggleStudentAccount(studentDbId, !currentActive);
      if (inspectionData && inspectionData.studentInfo.id === studentDbId) {
        setInspectionData({
          ...inspectionData,
          studentInfo: { ...inspectionData.studentInfo, accountActive: !currentActive },
        });
      }
      fetchList();
    } catch (err: any) {
      alert(`Failed to update account status: ${err.message}`);
    }
  };

  const handleInvigilatorUnlock = async (studentDbId: string) => {
    try {
      await violationApi.invigilatorUnlock('admin@sara', studentDbId);
      alert('Student unlocked successfully');
      fetchList();
      if (selectedStudentId) {
        handleInspectStudent(selectedStudentId);
      }
    } catch (err: any) {
      alert(`Failed to unlock student: ${err.message}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Summary Metrics Header Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
        <div style={{ backgroundColor: '#1e293b', borderRadius: '0.75rem', border: '1px solid #334155', padding: '1rem' }}>
          <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Total Students</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#38bdf8', marginTop: '0.2rem' }}>{data?.summary.totalStudents ?? 0}</div>
        </div>

        <div style={{ backgroundColor: '#1e293b', borderRadius: '0.75rem', border: '1px solid #22c55e', padding: '1rem' }}>
          <span style={{ fontSize: '0.7rem', color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>🟢 Online</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#22c55e', marginTop: '0.2rem' }}>{data?.summary.onlineCount ?? 0}</div>
        </div>

        <div style={{ backgroundColor: '#1e293b', borderRadius: '0.75rem', border: '1px solid #334155', padding: '1rem' }}>
          <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>⚪ Offline</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#94a3b8', marginTop: '0.2rem' }}>{data?.summary.offlineCount ?? 0}</div>
        </div>

        <div style={{ backgroundColor: '#1e293b', borderRadius: '0.75rem', border: '1px solid #0284c7', padding: '1rem' }}>
          <span style={{ fontSize: '0.7rem', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>🔵 Working</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#38bdf8', marginTop: '0.2rem' }}>{data?.summary.workingCount ?? 0}</div>
        </div>

        <div style={{ backgroundColor: '#1e293b', borderRadius: '0.75rem', border: '1px solid #f59e0b', padding: '1rem' }}>
          <span style={{ fontSize: '0.7rem', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>🟠 Submitted</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f59e0b', marginTop: '0.2rem' }}>{data?.summary.submittedCount ?? 0}</div>
        </div>

        <div style={{ backgroundColor: '#1e293b', borderRadius: '0.75rem', border: '1px solid #ef4444', padding: '1rem' }}>
          <span style={{ fontSize: '0.7rem', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>🔴 Locked</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ef4444', marginTop: '0.2rem' }}>{data?.summary.lockedCount ?? 0}</div>
        </div>

        <div style={{ backgroundColor: '#1e293b', borderRadius: '0.75rem', border: '1px solid #c084fc', padding: '1rem' }}>
          <span style={{ fontSize: '0.7rem', color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Violations</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#c084fc', marginTop: '0.2rem' }}>{data?.summary.withViolationsCount ?? 0}</div>
        </div>
      </div>

      {/* Toolbar: Search, Filters, Sorting, Page Size */}
      <div style={{ backgroundColor: '#1e293b', borderRadius: '0.75rem', border: '1px solid #334155', padding: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', flex: 1, minWidth: '300px' }}>
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by Name, Student ID, or Batch..."
            style={{ flex: 1, minWidth: '220px', padding: '0.45rem 0.85rem', borderRadius: '0.375rem', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', fontSize: '0.875rem' }}
          />

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            style={{ padding: '0.45rem 0.85rem', borderRadius: '0.375rem', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', fontSize: '0.875rem' }}
          >
            <option value="ALL">All Statuses</option>
            <option value="ONLINE">🟢 Online Only</option>
            <option value="OFFLINE">⚪ Offline Only</option>
            <option value="WORKING">🔵 Working</option>
            <option value="SUBMITTED">🟠 Submitted</option>
            <option value="LOCKED">🔴 Locked</option>
            <option value="WITH_VIOLATIONS">⚠️ With Violations</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{ padding: '0.45rem 0.85rem', borderRadius: '0.375rem', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', fontSize: '0.875rem' }}
          >
            <option value="studentId">Sort by Student ID</option>
            <option value="fullName">Sort by Name</option>
            <option value="batchNumber">Sort by Batch</option>
            <option value="score">Sort by Score</option>
            <option value="violations">Sort by Violations</option>
            <option value="online">Sort by Online Status</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Per page:</span>
          <select
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
            style={{ padding: '0.35rem 0.6rem', borderRadius: '0.375rem', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', fontSize: '0.85rem' }}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>

          <button
            onClick={fetchList}
            style={{ backgroundColor: '#334155', color: '#f8fafc', border: '1px solid #475569', padding: '0.45rem 0.85rem', borderRadius: '0.375rem', fontSize: '0.85rem', cursor: 'pointer' }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Main Student Management Table */}
      <div style={{ backgroundColor: '#1e293b', borderRadius: '1rem', border: '1px solid #334155', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#0f172a', color: '#94a3b8', borderBottom: '1px solid #334155' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Student ID</th>
                <th style={{ padding: '0.75rem 1rem' }}>Full Name</th>
                <th style={{ padding: '0.75rem 1rem' }}>Batch</th>
                <th style={{ padding: '0.75rem 1rem' }}>Online</th>
                <th style={{ padding: '0.75rem 1rem' }}>Current Round & Activity</th>
                <th style={{ padding: '0.75rem 1rem' }}>Score</th>
                <th style={{ padding: '0.75rem 1rem' }}>Violations</th>
                <th style={{ padding: '0.75rem 1rem' }}>Account</th>
                <th style={{ padding: '0.75rem 1rem' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && !data ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Loading student directory...</td>
                </tr>
              ) : data?.students && data.students.length > 0 ? (
                data.students.map((s) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #334155', backgroundColor: s.isLocked ? 'rgba(239, 68, 68, 0.05)' : 'transparent' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 'bold', color: '#38bdf8' }}>{s.studentId}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#f8fafc', fontWeight: 500 }}>{s.fullName}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>{s.batchNumber}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          backgroundColor: s.isOnline ? 'rgba(34, 197, 94, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                          color: s.isOnline ? '#22c55e' : '#94a3b8',
                          border: `1px solid ${s.isOnline ? '#22c55e' : '#64748b'}`,
                        }}
                      >
                        {s.isOnline ? '🟢 ONLINE' : '⚪ OFFLINE'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ fontSize: '0.85rem', color: '#f8fafc' }}>{s.currentRound?.name || 'Standing by'}</div>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color:
                            s.activityStatus === 'LOCKED'
                              ? '#ef4444'
                              : s.activityStatus === 'SUBMITTED'
                              ? '#f59e0b'
                              : s.activityStatus === 'WORKING'
                              ? '#38bdf8'
                              : '#94a3b8',
                        }}
                      >
                        {s.activityStatus}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 'bold', color: '#f8fafc' }}>
                      {s.totalScore} pts
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ color: s.violationCount > 0 ? '#ef4444' : '#22c55e', fontWeight: 600 }}>
                        {s.violationCount} {s.isLocked && '🔒 (LOCKED)'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ color: s.accountActive ? '#22c55e' : '#ef4444', fontSize: '0.8rem', fontWeight: 500 }}>
                        {s.accountActive ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <button
                        onClick={() => handleInspectStudent(s.id)}
                        style={{
                          backgroundColor: '#0284c7',
                          color: '#ffffff',
                          border: 'none',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '0.375rem',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    No students match the selected search or filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {data?.pagination && (
          <div style={{ backgroundColor: '#0f172a', padding: '0.75rem 1.25rem', borderTop: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Showing {data.students.length} of {data.pagination.totalCount} students (Page {data.pagination.page} of {data.pagination.totalPages})
            </span>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage(1)}
                style={{ backgroundColor: '#1e293b', color: '#f8fafc', border: '1px solid #334155', padding: '0.3rem 0.6rem', borderRadius: '0.25rem', fontSize: '0.75rem', cursor: page <= 1 ? 'not-allowed' : 'pointer' }}
              >
                First
              </button>
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{ backgroundColor: '#1e293b', color: '#f8fafc', border: '1px solid #334155', padding: '0.3rem 0.6rem', borderRadius: '0.25rem', fontSize: '0.75rem', cursor: page <= 1 ? 'not-allowed' : 'pointer' }}
              >
                Previous
              </button>
              <button
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                style={{ backgroundColor: '#1e293b', color: '#f8fafc', border: '1px solid #334155', padding: '0.3rem 0.6rem', borderRadius: '0.25rem', fontSize: '0.75rem', cursor: page >= data.pagination.totalPages ? 'not-allowed' : 'pointer' }}
              >
                Next
              </button>
              <button
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage(data.pagination.totalPages)}
                style={{ backgroundColor: '#1e293b', color: '#f8fafc', border: '1px solid #334155', padding: '0.3rem 0.6rem', borderRadius: '0.25rem', fontSize: '0.75rem', cursor: page >= data.pagination.totalPages ? 'not-allowed' : 'pointer' }}
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DETAILED STUDENT INSPECTION MODAL */}
      {selectedStudentId && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1.5rem' }}>
          <div style={{ backgroundColor: '#1e293b', width: '100%', maxWidth: '1000px', maxHeight: '90vh', borderRadius: '1rem', border: '1px solid #475569', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            {/* Modal Header */}
            <div style={{ backgroundColor: '#0f172a', padding: '1.25rem 1.5rem', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#38bdf8', margin: 0 }}>
                  Student Inspection: {inspectionData?.studentInfo.fullName || selectedStudentId}
                </h3>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                  {inspectionData?.studentInfo.studentId} • Batch {inspectionData?.studentInfo.batchNumber} • {inspectionData?.studentInfo.isOnline ? '🟢 ONLINE' : '⚪ OFFLINE'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                {inspectionData && (
                  <button
                    onClick={() => handleToggleAccountStatus(inspectionData.studentInfo.id, inspectionData.studentInfo.accountActive)}
                    style={{
                      backgroundColor: inspectionData.studentInfo.accountActive ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                      color: inspectionData.studentInfo.accountActive ? '#ef4444' : '#22c55e',
                      border: `1px solid ${inspectionData.studentInfo.accountActive ? '#ef4444' : '#22c55e'}`,
                      padding: '0.35rem 0.75rem',
                      borderRadius: '0.375rem',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {inspectionData.studentInfo.accountActive ? 'Suspend Account' : 'Activate Account'}
                  </button>
                )}

                {inspectionData?.overall.isLocked && (
                  <button
                    onClick={() => handleInvigilatorUnlock(inspectionData.studentInfo.id)}
                    style={{ backgroundColor: '#16a34a', color: '#ffffff', border: 'none', padding: '0.35rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Unlock Student Session
                  </button>
                )}

                <button
                  onClick={() => setSelectedStudentId(null)}
                  style={{ backgroundColor: '#334155', color: '#f8fafc', border: 'none', padding: '0.4rem 0.75rem', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  ✕ Close
                </button>
              </div>
            </div>

            {/* Modal Body & Sub-tabs */}
            {inspectionLoading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Loading detailed student workspace & submissions...</div>
            ) : inspectionData ? (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                {/* Sub-tab buttons */}
                <div style={{ display: 'flex', borderBottom: '1px solid #334155', backgroundColor: '#0f172a' }}>
                  <button
                    onClick={() => setInspectionTab('OVERVIEW')}
                    style={{ padding: '0.75rem 1.25rem', backgroundColor: inspectionTab === 'OVERVIEW' ? '#1e293b' : 'transparent', color: inspectionTab === 'OVERVIEW' ? '#38bdf8' : '#94a3b8', border: 'none', borderBottom: inspectionTab === 'OVERVIEW' ? '2px solid #38bdf8' : 'none', fontWeight: 600, cursor: 'pointer' }}
                  >
                    📊 Overview & Security
                  </button>
                  <button
                    onClick={() => setInspectionTab('ROUND1')}
                    style={{ padding: '0.75rem 1.25rem', backgroundColor: inspectionTab === 'ROUND1' ? '#1e293b' : 'transparent', color: inspectionTab === 'ROUND1' ? '#38bdf8' : '#94a3b8', border: 'none', borderBottom: inspectionTab === 'ROUND1' ? '2px solid #38bdf8' : 'none', fontWeight: 600, cursor: 'pointer' }}
                  >
                    📝 Round 1 (Quiz)
                  </button>
                  <button
                    onClick={() => setInspectionTab('ROUND2')}
                    style={{ padding: '0.75rem 1.25rem', backgroundColor: inspectionTab === 'ROUND2' ? '#1e293b' : 'transparent', color: inspectionTab === 'ROUND2' ? '#38bdf8' : '#94a3b8', border: 'none', borderBottom: inspectionTab === 'ROUND2' ? '2px solid #38bdf8' : 'none', fontWeight: 600, cursor: 'pointer' }}
                  >
                    🐛 Round 2 (Bug Hunt)
                  </button>
                  <button
                    onClick={() => setInspectionTab('ROUND3')}
                    style={{ padding: '0.75rem 1.25rem', backgroundColor: inspectionTab === 'ROUND3' ? '#1e293b' : 'transparent', color: inspectionTab === 'ROUND3' ? '#38bdf8' : '#94a3b8', border: 'none', borderBottom: inspectionTab === 'ROUND3' ? '2px solid #38bdf8' : 'none', fontWeight: 600, cursor: 'pointer' }}
                  >
                    💻 Round 3 (Programming)
                  </button>
                </div>

                {/* Sub-tab Contents */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                  {/* TAB 1: OVERVIEW */}
                  {inspectionTab === 'OVERVIEW' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', backgroundColor: '#0f172a', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #334155' }}>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Total Score</span>
                          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#38bdf8' }}>{inspectionData.overall.totalScore} pts</div>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Overall Rank</span>
                          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f59e0b' }}>#{inspectionData.overall.rank || 'N/A'}</div>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Total Violations</span>
                          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: inspectionData.overall.violationCount > 0 ? '#ef4444' : '#22c55e' }}>
                            {inspectionData.overall.violationCount} / {inspectionData.overall.maximumAllowedViolations}
                          </div>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Lock Status</span>
                          <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: inspectionData.overall.isLocked ? '#ef4444' : '#22c55e' }}>
                            {inspectionData.overall.isLocked ? '🔒 LOCKED' : '🟢 ACTIVE'}
                          </div>
                        </div>
                      </div>

                      {/* Violations Timeline */}
                      <div>
                        <h4 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#f8fafc', marginBottom: '0.75rem' }}>
                          🛡️ Security Violation History ({inspectionData.violations.length})
                        </h4>
                        {inspectionData.violations.length > 0 ? (
                          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                            <thead>
                              <tr style={{ backgroundColor: '#0f172a', color: '#94a3b8' }}>
                                <th style={{ padding: '0.5rem' }}>Timestamp</th>
                                <th style={{ padding: '0.5rem' }}>Round</th>
                                <th style={{ padding: '0.5rem' }}>Violation Type</th>
                                <th style={{ padding: '0.5rem' }}>Details</th>
                              </tr>
                            </thead>
                            <tbody>
                              {inspectionData.violations.map((v) => (
                                <tr key={v.id} style={{ borderBottom: '1px solid #334155' }}>
                                  <td style={{ padding: '0.5rem', color: '#94a3b8' }}>{new Date(v.timestamp).toLocaleTimeString()}</td>
                                  <td style={{ padding: '0.5rem', color: '#38bdf8' }}>{v.roundName}</td>
                                  <td style={{ padding: '0.5rem', color: '#ef4444', fontWeight: 'bold' }}>{v.type}</td>
                                  <td style={{ padding: '0.5rem', color: '#cbd5e1' }}>{v.details || 'Detected by system'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div style={{ color: '#64748b', fontSize: '0.85rem' }}>No security violations recorded for this student.</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 2: ROUND 1 (QUIZ) */}
                  {inspectionTab === 'ROUND1' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      <div style={{ backgroundColor: '#0f172a', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #334155', display: 'flex', gap: '2rem' }}>
                        <div><span style={{ fontSize: '0.75rem', color: '#64748b' }}>Round 1 Status:</span> <strong style={{ color: '#38bdf8' }}>{inspectionData.round1.status}</strong></div>
                        <div><span style={{ fontSize: '0.75rem', color: '#64748b' }}>Score:</span> <strong style={{ color: '#22c55e' }}>{inspectionData.round1.score} / {inspectionData.round1.maximumScore} pts</strong></div>
                        <div><span style={{ fontSize: '0.75rem', color: '#64748b' }}>Answered:</span> <strong style={{ color: '#f8fafc' }}>{inspectionData.round1.answeredCount} / {inspectionData.round1.totalQuestions} questions</strong></div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {inspectionData.round1.answers.map((ans, idx) => (
                          <div key={ans.questionId} style={{ backgroundColor: '#0f172a', padding: '1rem', borderRadius: '0.5rem', border: `1px solid ${ans.isCorrect ? '#22c55e' : ans.studentAnswer === '(Unanswered)' ? '#475569' : '#ef4444'}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                              <span style={{ fontWeight: 'bold', color: '#38bdf8' }}>Question #{idx + 1} ({ans.questionType})</span>
                              <span style={{ fontSize: '0.8rem', color: ans.isCorrect ? '#22c55e' : '#ef4444', fontWeight: 'bold' }}>
                                {ans.isCorrect ? `+${ans.marks} Marks` : ans.studentAnswer === '(Unanswered)' ? '0 Marks' : `-${ans.negativeMarks} Marks`}
                              </span>
                            </div>

                            <p style={{ color: '#f8fafc', fontSize: '0.9rem', marginBottom: '0.5rem' }}>{ans.questionText}</p>

                            {ans.code && (
                              <pre style={{ backgroundColor: '#1e293b', padding: '0.5rem', borderRadius: '0.25rem', color: '#f8fafc', fontSize: '0.8rem', overflowX: 'auto' }}>{ans.code}</pre>
                            )}

                            <div style={{ display: 'flex', gap: '2rem', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                              <div><span style={{ color: '#94a3b8' }}>Student Answer:</span> <strong style={{ color: ans.isCorrect ? '#22c55e' : '#ef4444' }}>{ans.studentAnswer}</strong></div>
                              <div><span style={{ color: '#94a3b8' }}>Correct Answer (Admin):</span> <strong style={{ color: '#22c55e' }}>{ans.correctAnswer}</strong></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: ROUND 2 (BUG HUNT) */}
                  {inspectionTab === 'ROUND2' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      <div style={{ backgroundColor: '#0f172a', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #334155', display: 'flex', gap: '2rem' }}>
                        <div><span style={{ fontSize: '0.75rem', color: '#64748b' }}>Round 2 Status:</span> <strong style={{ color: '#38bdf8' }}>{inspectionData.round2.status}</strong></div>
                        <div><span style={{ fontSize: '0.75rem', color: '#64748b' }}>Best Score:</span> <strong style={{ color: '#22c55e' }}>{inspectionData.round2.score} / {inspectionData.round2.maximumScore} pts</strong></div>
                        <div><span style={{ fontSize: '0.75rem', color: '#64748b' }}>Submissions:</span> <strong style={{ color: '#f8fafc' }}>{inspectionData.round2.submissions.length} attempts</strong></div>
                      </div>

                      {inspectionData.round2.currentDraftCode && (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#38bdf8' }}>CURRENT UN-SUBMITTED DRAFT CODE</span>
                            <button
                              onClick={() => setSelectedCodeView({ title: 'Round 2 Current Draft Code', code: inspectionData.round2.currentDraftCode! })}
                              style={{ backgroundColor: '#334155', color: '#f8fafc', border: 'none', padding: '0.2rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.75rem', cursor: 'pointer' }}
                            >
                              Expand Viewer
                            </button>
                          </div>
                          <pre style={{ backgroundColor: '#0f172a', padding: '0.75rem', borderRadius: '0.5rem', color: '#f8fafc', fontSize: '0.8rem', maxHeight: '150px', overflowY: 'auto', border: '1px solid #334155' }}>
                            {inspectionData.round2.currentDraftCode}
                          </pre>
                        </div>
                      )}

                      <div>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#f8fafc', marginBottom: '0.5rem' }}>Historical Submissions</h4>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#0f172a', color: '#94a3b8' }}>
                              <th style={{ padding: '0.5rem' }}>#</th>
                              <th style={{ padding: '0.5rem' }}>Timestamp</th>
                              <th style={{ padding: '0.5rem' }}>Compile</th>
                              <th style={{ padding: '0.5rem' }}>Bugs Fixed</th>
                              <th style={{ padding: '0.5rem' }}>Awarded Marks</th>
                              <th style={{ padding: '0.5rem' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {inspectionData.round2.submissions.map((sub) => (
                              <tr key={sub.id} style={{ borderBottom: '1px solid #334155' }}>
                                <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>Submission #{sub.submissionIndex}</td>
                                <td style={{ padding: '0.5rem', color: '#94a3b8' }}>{new Date(sub.timestamp).toLocaleTimeString()}</td>
                                <td style={{ padding: '0.5rem', color: sub.compileStatus === 'SUCCESS' ? '#22c55e' : '#ef4444' }}>{sub.compileStatus}</td>
                                <td style={{ padding: '0.5rem', color: '#38bdf8' }}>{sub.bugsFixedCount} bugs fixed</td>
                                <td style={{ padding: '0.5rem', fontWeight: 'bold', color: '#22c55e' }}>{sub.awardedMarks} pts</td>
                                <td style={{ padding: '0.5rem' }}>
                                  <button
                                    onClick={() => setSelectedCodeView({ title: `Round 2 Submission #${sub.submissionIndex}`, code: sub.submittedCode })}
                                    style={{ backgroundColor: '#0284c7', color: '#ffffff', border: 'none', padding: '0.2rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.75rem', cursor: 'pointer' }}
                                  >
                                    View Code
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* TAB 4: ROUND 3 (PROGRAMMING) */}
                  {inspectionTab === 'ROUND3' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      <div style={{ backgroundColor: '#0f172a', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #334155', display: 'flex', gap: '2rem' }}>
                        <div><span style={{ fontSize: '0.75rem', color: '#64748b' }}>Round 3 Status:</span> <strong style={{ color: '#38bdf8' }}>{inspectionData.round3.status}</strong></div>
                        <div><span style={{ fontSize: '0.75rem', color: '#64748b' }}>Best Score:</span> <strong style={{ color: '#22c55e' }}>{inspectionData.round3.score} / {inspectionData.round3.maximumScore} pts</strong></div>
                        <div><span style={{ fontSize: '0.75rem', color: '#64748b' }}>Submissions:</span> <strong style={{ color: '#f8fafc' }}>{inspectionData.round3.submissions.length} attempts</strong></div>
                      </div>

                      <div>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#f8fafc', marginBottom: '0.5rem' }}>Historical Submissions</h4>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#0f172a', color: '#94a3b8' }}>
                              <th style={{ padding: '0.5rem' }}>#</th>
                              <th style={{ padding: '0.5rem' }}>Timestamp</th>
                              <th style={{ padding: '0.5rem' }}>Lang</th>
                              <th style={{ padding: '0.5rem' }}>Status</th>
                              <th style={{ padding: '0.5rem' }}>Test Cases Passed</th>
                              <th style={{ padding: '0.5rem' }}>Score</th>
                              <th style={{ padding: '0.5rem' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {inspectionData.round3.submissions.map((sub) => (
                              <tr key={sub.id} style={{ borderBottom: '1px solid #334155' }}>
                                <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>Submission #{sub.submissionIndex}</td>
                                <td style={{ padding: '0.5rem', color: '#94a3b8' }}>{new Date(sub.timestamp).toLocaleTimeString()}</td>
                                <td style={{ padding: '0.5rem', color: '#c084fc', fontWeight: 'bold' }}>{sub.language}</td>
                                <td style={{ padding: '0.5rem', color: sub.status === 'ACCEPTED' ? '#22c55e' : '#ef4444' }}>{sub.status}</td>
                                <td style={{ padding: '0.5rem', color: '#38bdf8' }}>{sub.passedTestsCount} / {sub.totalTestsCount} passed</td>
                                <td style={{ padding: '0.5rem', fontWeight: 'bold', color: '#22c55e' }}>{sub.score} pts</td>
                                <td style={{ padding: '0.5rem' }}>
                                  <button
                                    onClick={() => setSelectedCodeView({ title: `Round 3 Submission #${sub.submissionIndex} (${sub.language})`, language: sub.language, code: sub.submittedCode })}
                                    style={{ backgroundColor: '#0284c7', color: '#ffffff', border: 'none', padding: '0.2rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.75rem', cursor: 'pointer' }}
                                  >
                                    View Code
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* READ-ONLY CODE VIEWER MODAL */}
      {selectedCodeView && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100, padding: '2rem' }}>
          <div style={{ backgroundColor: '#0f172a', width: '100%', maxWidth: '850px', maxHeight: '80vh', borderRadius: '0.75rem', border: '1px solid #38bdf8', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ backgroundColor: '#1e293b', padding: '0.75rem 1.25rem', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold', color: '#38bdf8', fontSize: '0.95rem' }}>{selectedCodeView.title}</span>
              <button
                onClick={() => setSelectedCodeView(null)}
                style={{ backgroundColor: '#334155', color: '#f8fafc', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.8rem' }}
              >
                Close
              </button>
            </div>
            <pre style={{ padding: '1.25rem', margin: 0, color: '#f8fafc', backgroundColor: '#0f172a', fontSize: '0.85rem', fontFamily: 'monospace', overflow: 'auto', flex: 1, lineHeight: 1.5 }}>
              {selectedCodeView.code}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
