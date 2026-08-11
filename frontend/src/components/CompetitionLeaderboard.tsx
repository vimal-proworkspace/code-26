import React, { useState, useEffect } from 'react';
import { competitionApi, AdminLeaderboardResponse, LeaderboardItem } from '../services/competitionApi';

export const CompetitionLeaderboard: React.FC = () => {
  const [data, setData] = useState<AdminLeaderboardResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<boolean>(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [inspectionData, setInspectionData] = useState<any | null>(null);
  const [inspectLoading, setInspectLoading] = useState<boolean>(false);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const res = await competitionApi.getAdminLeaderboard();
      setData(res);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch leaderboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const handleToggleVisibility = async () => {
    if (!data) return;
    try {
      setToggling(true);
      const newStatus = !data.showResults;
      await competitionApi.toggleResultsVisibility(newStatus);
      setData({ ...data, showResults: newStatus });
    } catch (err: any) {
      alert(`Failed to toggle visibility: ${err.message}`);
    } finally {
      setToggling(false);
    }
  };

  const handleInspectStudent = async (studentId: string) => {
    try {
      setSelectedStudentId(studentId);
      setInspectLoading(true);
      const res = await competitionApi.getAdminStudentInspection(studentId);
      setInspectionData(res);
    } catch (err: any) {
      alert(`Failed to fetch student inspection details: ${err.message}`);
    } finally {
      setInspectLoading(false);
    }
  };

  if (loading) {
    return <div style={{ color: '#94a3b8', padding: '2rem', textAlign: 'center' }}>Loading competition leaderboard...</div>;
  }

  return (
    <div style={{ backgroundColor: '#1e293b', borderRadius: '1rem', border: '1px solid #334155', padding: '2rem' }}>
      {/* Header & Results Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.375rem', fontWeight: 'bold', color: '#f8fafc', margin: 0 }}>
            🏆 Authoritative Competition Leaderboard & Results
          </h2>
          <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            Calculated from database transactions using deterministic 5-tier tie-breaking rules.
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: '0.375rem',
              backgroundColor: data?.showResults ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: data?.showResults ? '#22c55e' : '#ef4444',
              border: `1px solid ${data?.showResults ? '#22c55e' : '#ef4444'}`,
              fontSize: '0.8rem',
              fontWeight: 600,
            }}
          >
            {data?.showResults ? '● RESULTS PUBLISHED TO STUDENTS' : '○ RESULTS HIDDEN FROM STUDENTS'}
          </div>

          <button
            onClick={handleToggleVisibility}
            disabled={toggling}
            style={{
              backgroundColor: data?.showResults ? '#dc2626' : '#16a34a',
              color: '#ffffff',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: toggling ? 'not-allowed' : 'pointer',
            }}
          >
            {toggling ? 'Updating...' : data?.showResults ? 'Unpublish Results' : 'Publish Results'}
          </button>

          <button
            onClick={fetchLeaderboard}
            style={{
              backgroundColor: '#334155',
              color: '#f8fafc',
              border: '1px solid #475569',
              padding: '0.5rem 0.85rem',
              borderRadius: '0.375rem',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            🔄 Recalculate
          </button>
        </div>
      </div>

      {error && (
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#fca5a5', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {/* Leaderboard Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#0f172a', color: '#94a3b8', borderBottom: '1px solid #334155' }}>
              <th style={{ padding: '0.75rem 1rem' }}>Rank</th>
              <th style={{ padding: '0.75rem 1rem' }}>Student ID</th>
              <th style={{ padding: '0.75rem 1rem' }}>Student Name</th>
              <th style={{ padding: '0.75rem 1rem' }}>Batch</th>
              <th style={{ padding: '0.75rem 1rem' }}>R1 (Quiz)</th>
              <th style={{ padding: '0.75rem 1rem' }}>R2 (Debugging)</th>
              <th style={{ padding: '0.75rem 1rem' }}>R3 (Programming)</th>
              <th style={{ padding: '0.75rem 1rem' }}>Total Score</th>
              <th style={{ padding: '0.75rem 1rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data?.leaderboard && data.leaderboard.length > 0 ? (
              data.leaderboard.map((item) => (
                <tr key={item.studentId} style={{ borderBottom: '1px solid #334155', backgroundColor: item.rank <= 3 ? 'rgba(56, 189, 248, 0.05)' : 'transparent' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 'bold', color: item.rank === 1 ? '#f59e0b' : item.rank === 2 ? '#cbd5e1' : item.rank === 3 ? '#b45309' : '#94a3b8' }}>
                    #{item.rank}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#38bdf8' }}>{item.studentId}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#f8fafc', fontWeight: 500 }}>{item.studentName}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>{item.batchNumber}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#f8fafc' }}>{item.round1Score}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#f8fafc' }}>{item.round2Score}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#f8fafc' }}>{item.round3Score}</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 'bold', color: '#22c55e', fontSize: '1rem' }}>{item.totalScore} pts</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <button
                      onClick={() => handleInspectStudent(item.studentId)}
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
                      Inspect Student
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  No student competition scores recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Admin Student Inspection Modal */}
      {selectedStudentId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1.5rem' }}>
          <div style={{ backgroundColor: '#1e293b', borderRadius: '1rem', border: '1px solid #334155', maxWidth: '800px', width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: '2rem', color: '#f8fafc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #334155', paddingBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#38bdf8', margin: 0 }}>
                  Student Detailed Inspection: {selectedStudentId}
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Comprehensive competition activity breakdown</span>
              </div>
              <button
                onClick={() => { setSelectedStudentId(null); setInspectionData(null); }}
                style={{ backgroundColor: '#334155', color: '#94a3b8', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: 'bold' }}
              >
                ✕ Close
              </button>
            </div>

            {inspectLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Loading student inspection data...</div>
            ) : inspectionData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', fontSize: '0.875rem' }}>
                {/* Profile Overview */}
                <div style={{ backgroundColor: '#0f172a', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #334155', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Full Name</span>
                    <strong style={{ color: '#f8fafc' }}>{inspectionData.fullName}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Batch Number</span>
                    <strong style={{ color: '#f8fafc' }}>{inspectionData.batchNumber}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Account Status</span>
                    <strong style={{ color: '#10b981' }}>{inspectionData.user?.isActive ? 'Active' : 'Disabled'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Total Violations</span>
                    <strong style={{ color: inspectionData.violations?.length > 0 ? '#ef4444' : '#22c55e' }}>{inspectionData.violations?.length || 0} recorded</strong>
                  </div>
                </div>

                {/* Round 1 Answers Summary */}
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#38bdf8', marginBottom: '0.5rem' }}>
                    Round 1: Quiz Answers ({inspectionData.answers?.length || 0} answered)
                  </h4>
                  {inspectionData.answers && inspectionData.answers.length > 0 ? (
                    <div style={{ backgroundColor: '#0f172a', padding: '0.75rem', borderRadius: '0.5rem', maxHeight: '150px', overflowY: 'auto' }}>
                      {inspectionData.answers.map((ans: any, idx: number) => (
                        <div key={ans.id} style={{ borderBottom: '1px solid #334155', padding: '0.4rem 0' }}>
                          <span style={{ color: '#94a3b8' }}>Q{idx + 1}: </span>
                          <span style={{ color: '#f8fafc' }}>{ans.question?.questionText?.substring(0, 60)}...</span>
                          <span style={{ color: '#38bdf8', marginLeft: '0.5rem', fontWeight: 'bold' }}>Ans: {ans.answer}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: '#64748b', fontStyle: 'italic' }}>No Round 1 answers submitted.</div>
                  )}
                </div>

                {/* Round 2 Submissions & Bug Awards */}
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#38bdf8', marginBottom: '0.5rem' }}>
                    Round 2: Bug Awards ({inspectionData.bugAwards?.length || 0} bugs fixed)
                  </h4>
                  {inspectionData.bugAwards && inspectionData.bugAwards.length > 0 ? (
                    <div style={{ backgroundColor: '#0f172a', padding: '0.75rem', borderRadius: '0.5rem' }}>
                      {inspectionData.bugAwards.map((award: any) => (
                        <div key={award.id} style={{ borderBottom: '1px solid #334155', padding: '0.4rem 0', display: 'flex', justifyContent: 'space-between' }}>
                          <span>{award.bugDefinition?.title || 'Bug Fixed'}</span>
                          <strong style={{ color: '#22c55e' }}>+{award.marksAwarded} pts</strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: '#64748b', fontStyle: 'italic' }}>No Round 2 bugs awarded.</div>
                  )}
                </div>

                {/* Round 3 Programming Submissions */}
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#38bdf8', marginBottom: '0.5rem' }}>
                    Round 3: Programming Submissions ({inspectionData.programmingSubmissions?.length || 0} attempts)
                  </h4>
                  {inspectionData.programmingSubmissions && inspectionData.programmingSubmissions.length > 0 ? (
                    <div style={{ backgroundColor: '#0f172a', padding: '0.75rem', borderRadius: '0.5rem' }}>
                      {inspectionData.programmingSubmissions.map((sub: any, idx: number) => (
                        <div key={sub.id} style={{ borderBottom: '1px solid #334155', padding: '0.5rem 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ color: '#c084fc', fontWeight: 'bold' }}>#{sub.submissionNumber} ({sub.language})</span>
                            <span style={{ color: '#94a3b8', marginLeft: '0.75rem' }}>Tests: {sub.passedTests}/{sub.totalTests}</span>
                          </div>
                          <strong style={{ color: '#22c55e' }}>{sub.score} pts ({sub.submissionStatus})</strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: '#64748b', fontStyle: 'italic' }}>No Round 3 code submitted.</div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
