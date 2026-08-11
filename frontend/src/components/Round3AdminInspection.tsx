import React, { useState, useEffect } from 'react';
import { round3Api, Round3ScoreSummary, ProgrammingSubmission, ProgrammingProblem } from '../services/round3Api';

interface Round3AdminInspectionProps {
  roundId: string;
}

export const Round3AdminInspection: React.FC<Round3AdminInspectionProps> = ({ roundId }) => {
  const [scores, setScores] = useState<Round3ScoreSummary[]>([]);
  const [problems, setProblems] = useState<ProgrammingProblem[]>([]);
  const [selectedProblemId, setSelectedProblemId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal inspection state
  const [selectedStudent, setSelectedStudent] = useState<Round3ScoreSummary | null>(null);
  const [studentSubmissions, setStudentSubmissions] = useState<ProgrammingSubmission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState<boolean>(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [scoresData, problemsData] = await Promise.all([
        round3Api.getRound3Scores(roundId),
        round3Api.getAdminProblems(roundId),
      ]);
      setScores(scoresData);
      setProblems(problemsData);
      if (problemsData.length > 0 && !selectedProblemId) {
        setSelectedProblemId(problemsData[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load Round 3 inspection data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [roundId]);

  const handleInspectStudent = async (student: Round3ScoreSummary) => {
    setSelectedStudent(student);
    if (!selectedProblemId) return;

    try {
      setLoadingSubmissions(true);
      const subs = await round3Api.getAdminSubmissions(selectedProblemId, student.id);
      setStudentSubmissions(subs);
    } catch (err: any) {
      alert(err.message || 'Failed to load student submissions');
    } finally {
      setLoadingSubmissions(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem', color: '#94a3b8' }}>Loading Round 3 scores...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Round 3 Student Scores & Submissions</h2>
          <p style={styles.subtitle}>View student leaderboard, passed test counts, and submitted source code.</p>
        </div>
        {problems.length > 0 && (
          <div>
            <label style={{ fontSize: '0.85rem', color: '#94a3b8', marginRight: '0.5rem' }}>Select Problem:</label>
            <select
              value={selectedProblemId}
              onChange={(e) => setSelectedProblemId(e.target.value)}
              style={styles.select}
            >
              {problems.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}

      {/* SUMMARY LEADERBOARD TABLE */}
      <div style={styles.tableCard}>
        <div style={styles.tableHeader}>
          <span>Student ID</span>
          <span>Full Name</span>
          <span>Batch</span>
          <span>Status</span>
          <span>Score</span>
          <span>Action</span>
        </div>

        {scores.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>No student records found.</div>
        ) : (
          scores.map((st) => (
            <div key={st.id} style={styles.tableRow}>
              <span style={{ fontWeight: 700, color: '#c084fc' }}>{st.studentId}</span>
              <span style={{ color: '#f8fafc', fontWeight: 600 }}>{st.fullName}</span>
              <span style={{ color: '#94a3b8' }}>{st.batchNumber}</span>
              <span>
                <span
                  style={{
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    backgroundColor: st.status === 'SUBMITTED' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                    color: st.status === 'SUBMITTED' ? '#22c55e' : '#94a3b8',
                  }}
                >
                  {st.status}
                </span>
              </span>
              <span style={{ fontWeight: 700, color: '#22c55e' }}>{st.score} / {st.maximumScore}</span>
              <button onClick={() => handleInspectStudent(st)} style={styles.btnInspect}>
                Inspect Code
              </button>
            </div>
          ))
        )}
      </div>

      {/* INSPECTION MODAL */}
      {selectedStudent && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#f8fafc' }}>
                Submissions: {selectedStudent.fullName} ({selectedStudent.studentId})
              </h3>
              <button onClick={() => setSelectedStudent(null)} style={styles.btnSecondary}>Close</button>
            </div>

            {loadingSubmissions ? (
              <p style={{ color: '#94a3b8', marginTop: '1rem' }}>Loading submissions...</p>
            ) : studentSubmissions.length === 0 ? (
              <p style={{ color: '#64748b', marginTop: '1rem' }}>No submissions recorded for this student yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                {studentSubmissions.map((sub) => (
                  <div key={sub.id} style={styles.subCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                      <span>Submission #{sub.submissionNumber} • <strong style={{ color: '#c084fc' }}>{sub.language}</strong></span>
                      <span>{new Date(sub.submittedAt).toLocaleString()}</span>
                      <span style={{ color: sub.submissionStatus === 'ACCEPTED' ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                        {sub.submissionStatus} (Passed {sub.passedTests}/{sub.totalTests})
                      </span>
                    </div>

                    <pre style={styles.codePreview}>{sub.submittedCode}</pre>

                    {sub.compileOutput && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#f87171' }}>
                        Compiler Output: {sub.compileOutput}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '1.5rem', backgroundColor: '#090d16', minHeight: '80vh', color: '#f8fafc' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' },
  title: { margin: 0, fontSize: '1.5rem', color: '#f8fafc' },
  subtitle: { margin: '0.2rem 0 0 0', color: '#94a3b8', fontSize: '0.9rem' },
  select: { backgroundColor: '#1e293b', color: '#f8fafc', border: '1px solid #334155', borderRadius: '6px', padding: '0.4rem 0.8rem' },
  tableCard: { backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b', overflow: 'hidden' },
  tableHeader: { display: 'grid', gridTemplateColumns: '1.5fr 2fr 1fr 1fr 1fr 1fr', padding: '0.75rem 1rem', backgroundColor: '#1e293b', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 },
  tableRow: { display: 'grid', gridTemplateColumns: '1.5fr 2fr 1fr 1fr 1fr 1fr', padding: '0.75rem 1rem', borderBottom: '1px solid #1e293b', alignItems: 'center', fontSize: '0.9rem' },
  btnInspect: { backgroundColor: '#9333ea', color: '#fff', border: 'none', padding: '0.3rem 0.75rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' },
  btnSecondary: { backgroundColor: '#334155', color: '#fff', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer' },
  errorBox: { backgroundColor: '#7f1d1d', color: '#f8fafc', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalContent: { backgroundColor: '#0f172a', padding: '1.5rem', borderRadius: '12px', width: '650px', maxHeight: '85vh', overflowY: 'auto', border: '1px solid #334155' },
  subCard: { backgroundColor: '#090d16', border: '1px solid #1e293b', borderRadius: '8px', padding: '1rem' },
  codePreview: { margin: 0, backgroundColor: '#030712', padding: '0.75rem', borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.85rem', color: '#c084fc', overflowX: 'auto' },
};
