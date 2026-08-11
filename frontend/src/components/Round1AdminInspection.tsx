import React, { useState, useEffect } from 'react';
import { round1Api, StudentScoreSummary, AdminInspectionResponse } from '../services/round1Api';

interface Round1AdminInspectionProps {
  roundId: string;
}

export const Round1AdminInspection: React.FC<Round1AdminInspectionProps> = ({ roundId }) => {
  const [scores, setScores] = useState<StudentScoreSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [inspectionData, setInspectionData] = useState<AdminInspectionResponse | null>(null);
  const [inspectLoading, setInspectLoading] = useState<boolean>(false);

  const fetchScores = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await round1Api.getRound1Scores(roundId);
      setScores(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load Round 1 score summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScores();
  }, [roundId]);

  const handleInspectStudent = async (studentId: string) => {
    setSelectedStudentId(studentId);
    try {
      setInspectLoading(true);
      const data = await round1Api.getStudentAnswers(roundId, studentId);
      setInspectionData(data);
    } catch (err: any) {
      alert(err.message || 'Failed to load student inspection data');
      setSelectedStudentId(null);
    } finally {
      setInspectLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#1e293b', borderRadius: '1rem', border: '1px solid #334155', padding: '1.5rem', color: '#f8fafc' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: '0 0 0.25rem 0', color: '#38bdf8' }}>
          Round 1 Student Scores & Answer Inspection
        </h3>
        <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
          Real-time summary of student submissions and answer evaluation
        </span>
      </div>

      {error && (
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#fca5a5', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: '#94a3b8' }}>Loading student scores...</p>
      ) : scores.length === 0 ? (
        <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>No student records found.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Student ID</th>
                <th style={{ padding: '0.75rem 1rem' }}>Full Name</th>
                <th style={{ padding: '0.75rem 1rem' }}>Batch</th>
                <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem' }}>Score</th>
                <th style={{ padding: '0.75rem 1rem' }}>Submitted At</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {scores.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#38bdf8' }}>{s.studentId}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#f8fafc' }}>{s.fullName}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1' }}>{s.batchNumber}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span
                      style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: s.status === 'SUBMITTED' ? 'rgba(16, 185, 129, 0.2)' : s.status === 'IN_PROGRESS' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(100, 116, 139, 0.2)',
                        color: s.status === 'SUBMITTED' ? '#10b981' : s.status === 'IN_PROGRESS' ? '#38bdf8' : '#94a3b8',
                      }}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 'bold', color: s.score > 0 ? '#10b981' : '#f8fafc' }}>
                    {s.score} / {s.maximumScore} pts
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                    {s.submittedAt ? new Date(s.submittedAt).toLocaleTimeString() : 'N/A'}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    <button
                      onClick={() => handleInspectStudent(s.id)}
                      style={{ backgroundColor: '#0284c7', color: '#ffffff', border: 'none', padding: '0.375rem 0.75rem', borderRadius: '0.375rem', fontWeight: 500, fontSize: '0.8rem', cursor: 'pointer' }}
                    >
                      Inspect Answers
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Student Answers Inspection Modal */}
      {selectedStudentId && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 60 }}>
          <div style={{ width: '100%', maxWidth: '720px', backgroundColor: '#1e293b', borderRadius: '1rem', border: '1px solid #0284c7', padding: '2rem', color: '#f8fafc', maxHeight: '90vh', overflowY: 'auto' }}>
            {inspectLoading || !inspectionData ? (
              <p style={{ color: '#94a3b8' }}>Loading student answer details...</p>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', borderBottom: '1px solid #334155', paddingBottom: '1rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: '0 0 0.25rem 0', color: '#38bdf8' }}>
                      {inspectionData.student.fullName} ({inspectionData.student.studentId})
                    </h3>
                    <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                      Batch: {inspectionData.student.batchNumber} | Status: <strong style={{ color: '#10b981' }}>{inspectionData.submissionStatus}</strong>
                    </span>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>Total Score</span>
                    <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>
                      {inspectionData.score} / {inspectionData.maximumScore} pts
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                  {inspectionData.questions.map((q, idx) => (
                    <div key={q.questionId} style={{ backgroundColor: '#0f172a', borderRadius: '0.5rem', border: `1px solid ${q.isCorrect ? '#10b981' : q.studentAnswer ? '#ef4444' : '#334155'}`, padding: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontWeight: 'bold', color: '#38bdf8' }}>Question #{idx + 1} ({q.questionType})</span>
                        <span
                          style={{
                            fontWeight: 'bold',
                            color: q.marksAwarded > 0 ? '#10b981' : q.marksAwarded < 0 ? '#ef4444' : '#94a3b8',
                          }}
                        >
                          {q.marksAwarded > 0 ? `+${q.marksAwarded}` : q.marksAwarded} pts
                        </span>
                      </div>

                      <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem' }}>{q.questionText}</p>

                      <div style={{ fontSize: '0.85rem', color: '#cbd5e1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', backgroundColor: '#1e293b', padding: '0.75rem', borderRadius: '0.375rem' }}>
                        <div>
                          Student Answer:{' '}
                          <strong style={{ color: q.isCorrect ? '#10b981' : '#ef4444' }}>
                            {q.studentAnswer || '(Unanswered)'}
                          </strong>
                        </div>
                        <div>
                          Correct Answer / Output:{' '}
                          <strong style={{ color: '#10b981' }}>
                            {q.questionType === 'MCQ' ? q.correctAnswer : q.correctOutput}
                          </strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setSelectedStudentId(null)}
                    style={{ backgroundColor: '#334155', color: '#f8fafc', border: 'none', padding: '0.5rem 1.25rem', borderRadius: '0.375rem', cursor: 'pointer' }}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
