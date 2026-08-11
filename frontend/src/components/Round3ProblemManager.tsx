import React, { useState, useEffect } from 'react';
import { round3Api, ProgrammingProblem, TestCase } from '../services/round3Api';

interface Round3ProblemManagerProps {
  roundId: string;
}

const ALL_LANGUAGES = ['C', 'CPP', 'JAVA', 'PYTHON'];

export const Round3ProblemManager: React.FC<Round3ProblemManagerProps> = ({ roundId }) => {
  const [problems, setProblems] = useState<ProgrammingProblem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedProblem, setSelectedProblem] = useState<ProgrammingProblem | null>(null);
  const [showProblemModal, setShowProblemModal] = useState<boolean>(false);
  const [showTestCaseModal, setShowTestCaseModal] = useState<boolean>(false);

  // Problem form state
  const [probTitle, setProbTitle] = useState<string>('');
  const [probDesc, setProbDesc] = useState<string>('');
  const [probInputFormat, setProbInputFormat] = useState<string>('');
  const [probOutputFormat, setProbOutputFormat] = useState<string>('');
  const [probConstraints, setProbConstraints] = useState<string>('');
  const [probStarterCode, setProbStarterCode] = useState<string>('');
  const [probMaxMarks, setProbMaxMarks] = useState<number>(100);
  const [probLanguages, setProbLanguages] = useState<string[]>(['C', 'CPP', 'JAVA', 'PYTHON']);
  const [editingProblemId, setEditingProblemId] = useState<string | null>(null);

  // Test case form state
  const [tcInput, setTcInput] = useState<string>('');
  const [tcOutput, setTcOutput] = useState<string>('');
  const [tcMarks, setTcMarks] = useState<number>(10);
  const [tcVisibility, setTcVisibility] = useState<'VISIBLE' | 'HIDDEN'>('VISIBLE');
  const [editingTestCaseId, setEditingTestCaseId] = useState<string | null>(null);

  const loadProblems = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await round3Api.getAdminProblems(roundId);
      setProblems(res);
      if (res.length > 0 && !selectedProblem) {
        setSelectedProblem(res[0]);
      } else if (selectedProblem) {
        const updated = res.find((p) => p.id === selectedProblem.id);
        if (updated) setSelectedProblem(updated);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load Round 3 problems');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProblems();
  }, [roundId]);

  const handleOpenNewProblem = () => {
    setEditingProblemId(null);
    setProbTitle('');
    setProbDesc('');
    setProbInputFormat('');
    setProbOutputFormat('');
    setProbConstraints('');
    setProbStarterCode('');
    setProbMaxMarks(100);
    setProbLanguages(['C', 'CPP', 'JAVA', 'PYTHON']);
    setShowProblemModal(true);
  };

  const handleOpenEditProblem = (prob: ProgrammingProblem) => {
    setEditingProblemId(prob.id);
    setProbTitle(prob.title);
    setProbDesc(prob.description);
    setProbInputFormat(prob.inputFormat || '');
    setProbOutputFormat(prob.outputFormat || '');
    setProbConstraints(prob.constraints || '');
    setProbStarterCode(prob.starterCode || '');
    setProbMaxMarks(prob.maximumMarks);
    setProbLanguages(prob.supportedLanguages || ['C', 'CPP', 'JAVA', 'PYTHON']);
    setShowProblemModal(true);
  };

  const handleToggleLanguage = (lang: string) => {
    if (probLanguages.includes(lang)) {
      if (probLanguages.length === 1) {
        alert('At least one supported language must be selected!');
        return;
      }
      setProbLanguages(probLanguages.filter((l) => l !== lang));
    } else {
      setProbLanguages([...probLanguages, lang]);
    }
  };

  const handleSaveProblem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProblemId) {
        await round3Api.updateProblem(editingProblemId, {
          title: probTitle,
          description: probDesc,
          inputFormat: probInputFormat,
          outputFormat: probOutputFormat,
          constraints: probConstraints,
          starterCode: probStarterCode,
          maximumMarks: probMaxMarks,
          supportedLanguages: probLanguages,
        });
      } else {
        await round3Api.createProblem(roundId, {
          title: probTitle,
          description: probDesc,
          inputFormat: probInputFormat,
          outputFormat: probOutputFormat,
          constraints: probConstraints,
          starterCode: probStarterCode,
          maximumMarks: probMaxMarks,
          supportedLanguages: probLanguages,
        });
      }
      setShowProblemModal(false);
      await loadProblems();
    } catch (err: any) {
      alert(err.message || 'Failed to save problem');
    }
  };

  const handleDeleteProblem = async (problemId: string) => {
    if (!confirm('Are you sure you want to delete this programming problem?')) return;
    try {
      await round3Api.deleteProblem(problemId);
      if (selectedProblem?.id === problemId) setSelectedProblem(null);
      await loadProblems();
    } catch (err: any) {
      alert(err.message || 'Failed to delete problem');
    }
  };

  const handleOpenNewTestCase = () => {
    if (!selectedProblem) return;
    setEditingTestCaseId(null);
    setTcInput('');
    setTcOutput('');
    setTcMarks(10);
    setTcVisibility('VISIBLE');
    setShowTestCaseModal(true);
  };

  const handleOpenEditTestCase = (tc: TestCase) => {
    setEditingTestCaseId(tc.id);
    setTcInput(tc.input);
    setTcOutput(tc.expectedOutput);
    setTcMarks(tc.marks);
    setTcVisibility(tc.visibility);
    setShowTestCaseModal(true);
  };

  const handleSaveTestCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProblem) return;

    try {
      if (editingTestCaseId) {
        await round3Api.updateTestCase(editingTestCaseId, {
          input: tcInput,
          expectedOutput: tcOutput,
          marks: tcMarks,
          visibility: tcVisibility,
        });
      } else {
        await round3Api.createTestCase(selectedProblem.id, {
          input: tcInput,
          expectedOutput: tcOutput,
          marks: tcMarks,
          visibility: tcVisibility,
        });
      }
      setShowTestCaseModal(false);
      await loadProblems();
    } catch (err: any) {
      alert(err.message || 'Failed to save test case');
    }
  };

  const handleDeleteTestCase = async (testCaseId: string) => {
    if (!confirm('Are you sure you want to delete this test case?')) return;
    try {
      await round3Api.deleteTestCase(testCaseId);
      await loadProblems();
    } catch (err: any) {
      alert(err.message || 'Failed to delete test case');
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem', color: '#94a3b8' }}>Loading Round 3 problems...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Round 3 Programming Challenge Management</h2>
          <p style={styles.subtitle}>Configure algorithm problems, allowed languages, and visible/hidden test cases.</p>
        </div>
        <button onClick={handleOpenNewProblem} style={styles.btnPrimary}>
          + Create Programming Problem
        </button>
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}

      <div style={styles.contentGrid}>
        {/* PROBLEMS LIST */}
        <div style={styles.leftCard}>
          <h3 style={styles.cardHeader}>Problems ({problems.length})</h3>
          {problems.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No programming problems created yet.</p>
          ) : (
            <div style={styles.problemList}>
              {problems.map((prob) => (
                <div
                  key={prob.id}
                  onClick={() => setSelectedProblem(prob)}
                  style={{
                    ...styles.problemItem,
                    borderColor: selectedProblem?.id === prob.id ? '#a855f7' : '#1e293b',
                    backgroundColor: selectedProblem?.id === prob.id ? '#1e293b' : '#0f172a',
                  }}
                >
                  <div style={{ fontWeight: 600, color: '#f8fafc' }}>{prob.title}</div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                    Allowed: {prob.supportedLanguages.join(', ')} | Max Marks: {prob.maximumMarks}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button onClick={(e) => { e.stopPropagation(); handleOpenEditProblem(prob); }} style={styles.btnSmall}>Edit</button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteProblem(prob.id); }} style={styles.btnSmallDanger}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SELECTED PROBLEM & TEST CASES */}
        <div style={styles.rightCard}>
          {selectedProblem ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, color: '#f8fafc' }}>{selectedProblem.title}</h3>
                <button onClick={handleOpenNewTestCase} style={styles.btnSecondary}>
                  + Add Test Case
                </button>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', margin: '0.75rem 0' }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Supported Languages:</span>
                {selectedProblem.supportedLanguages.map((l) => (
                  <span key={l} style={styles.langTag}>{l}</span>
                ))}
              </div>

              <p style={{ color: '#cbd5e1', fontSize: '0.9rem' }}>{selectedProblem.description}</p>

              <h4 style={{ color: '#a855f7', marginTop: '1.5rem', marginBottom: '0.5rem' }}>
                Configured Test Cases ({selectedProblem.testCases?.length || 0})
              </h4>

              {(!selectedProblem.testCases || selectedProblem.testCases.length === 0) ? (
                <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No test cases created yet for this problem.</p>
              ) : (
                <div style={styles.testCaseTable}>
                  <div style={styles.tableHeader}>
                    <span>Visibility</span>
                    <span>Input</span>
                    <span>Expected Output</span>
                    <span>Marks</span>
                    <span>Actions</span>
                  </div>
                  {selectedProblem.testCases.map((tc) => (
                    <div key={tc.id} style={styles.tableRow}>
                      <span style={{ fontWeight: 700, color: tc.visibility === 'VISIBLE' ? '#22c55e' : '#f59e0b' }}>
                        {tc.visibility}
                      </span>
                      <pre style={styles.codeCell}>{tc.input || '(empty)'}</pre>
                      <pre style={styles.codeCell}>{tc.expectedOutput || '(empty)'}</pre>
                      <span style={{ color: '#eab308', fontWeight: 700 }}>+{tc.marks}</span>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => handleOpenEditTestCase(tc)} style={styles.btnSmall}>Edit</button>
                        <button onClick={() => handleDeleteTestCase(tc.id)} style={styles.btnSmallDanger}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: '#64748b', textAlign: 'center', padding: '3rem' }}>
              Select a programming problem from the left list to view and manage its details and test cases.
            </div>
          )}
        </div>
      </div>

      {/* PROBLEM MODAL */}
      {showProblemModal && (
        <div style={styles.modalOverlay}>
          <form onSubmit={handleSaveProblem} style={styles.modalContent}>
            <h3>{editingProblemId ? 'Edit Programming Problem' : 'Create Programming Problem'}</h3>
            
            <label style={styles.label}>Title</label>
            <input type="text" value={probTitle} onChange={(e) => setProbTitle(e.target.value)} required style={styles.input} />

            <label style={styles.label}>Description</label>
            <textarea value={probDesc} onChange={(e) => setProbDesc(e.target.value)} required rows={3} style={styles.input} />

            <label style={styles.label}>Input Format</label>
            <input type="text" value={probInputFormat} onChange={(e) => setProbInputFormat(e.target.value)} style={styles.input} />

            <label style={styles.label}>Output Format</label>
            <input type="text" value={probOutputFormat} onChange={(e) => setProbOutputFormat(e.target.value)} style={styles.input} />

            <label style={styles.label}>Constraints</label>
            <input type="text" value={probConstraints} onChange={(e) => setProbConstraints(e.target.value)} style={styles.input} />

            <label style={styles.label}>Allowed Programming Languages</label>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.4rem', marginBottom: '0.75rem' }}>
              {ALL_LANGUAGES.map((lang) => (
                <label key={lang} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#f8fafc', fontSize: '0.9rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={probLanguages.includes(lang)}
                    onChange={() => handleToggleLanguage(lang)}
                  />
                  {lang}
                </label>
              ))}
            </div>

            <label style={styles.label}>Maximum Marks</label>
            <input type="number" value={probMaxMarks} onChange={(e) => setProbMaxMarks(Number(e.target.value))} required style={styles.input} />

            <div style={styles.modalButtons}>
              <button type="button" onClick={() => setShowProblemModal(false)} style={styles.btnSecondary}>Cancel</button>
              <button type="submit" style={styles.btnPrimary}>Save Problem</button>
            </div>
          </form>
        </div>
      )}

      {/* TEST CASE MODAL */}
      {showTestCaseModal && (
        <div style={styles.modalOverlay}>
          <form onSubmit={handleSaveTestCase} style={styles.modalContent}>
            <h3>{editingTestCaseId ? 'Edit Test Case' : 'Add Test Case'}</h3>

            <label style={styles.label}>Visibility</label>
            <select value={tcVisibility} onChange={(e) => setTcVisibility(e.target.value as any)} style={styles.input}>
              <option value="VISIBLE">VISIBLE (Practice run & sample case)</option>
              <option value="HIDDEN">HIDDEN (Secret evaluation & hidden marks)</option>
            </select>

            <label style={styles.label}>Input (stdin)</label>
            <textarea value={tcInput} onChange={(e) => setTcInput(e.target.value)} rows={3} style={{ ...styles.input, fontFamily: 'monospace' }} />

            <label style={styles.label}>Expected Output (stdout)</label>
            <textarea value={tcOutput} onChange={(e) => setTcOutput(e.target.value)} required rows={3} style={{ ...styles.input, fontFamily: 'monospace' }} />

            <label style={styles.label}>Marks</label>
            <input type="number" value={tcMarks} onChange={(e) => setTcMarks(Number(e.target.value))} required style={styles.input} />

            <div style={styles.modalButtons}>
              <button type="button" onClick={() => setShowTestCaseModal(false)} style={styles.btnSecondary}>Cancel</button>
              <button type="submit" style={styles.btnPrimary}>Save Test Case</button>
            </div>
          </form>
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
  contentGrid: { display: 'flex', gap: '1.5rem' },
  leftCard: { width: '35%', backgroundColor: '#0f172a', borderRadius: '8px', padding: '1rem', border: '1px solid #1e293b' },
  rightCard: { width: '65%', backgroundColor: '#0f172a', borderRadius: '8px', padding: '1rem', border: '1px solid #1e293b' },
  cardHeader: { margin: '0 0 1rem 0', color: '#f8fafc', fontSize: '1.1rem' },
  problemList: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  problemItem: { padding: '0.75rem', borderRadius: '6px', border: '1px solid #1e293b', cursor: 'pointer' },
  langTag: { backgroundColor: '#1e293b', color: '#c084fc', border: '1px solid #475569', borderRadius: '4px', padding: '0.15rem 0.4rem', fontSize: '0.75rem', fontWeight: 700 },
  testCaseTable: { display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' },
  tableHeader: { display: 'grid', gridTemplateColumns: '1fr 2fr 2fr 1fr 1fr', padding: '0.5rem', backgroundColor: '#1e293b', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 },
  tableRow: { display: 'grid', gridTemplateColumns: '1fr 2fr 2fr 1fr 1fr', padding: '0.5rem', backgroundColor: '#090d16', borderBottom: '1px solid #1e293b', alignItems: 'center', fontSize: '0.85rem' },
  codeCell: { margin: 0, fontFamily: 'monospace', fontSize: '0.8rem', color: '#38bdf8', overflow: 'hidden', textOverflow: 'ellipsis', maxHeight: '40px' },
  btnPrimary: { backgroundColor: '#9333ea', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' },
  btnSecondary: { backgroundColor: '#334155', color: '#fff', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer' },
  btnSmall: { backgroundColor: '#334155', color: '#fff', border: 'none', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' },
  btnSmallDanger: { backgroundColor: '#991b1b', color: '#fff', border: 'none', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' },
  errorBox: { backgroundColor: '#7f1d1d', color: '#f8fafc', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalContent: { backgroundColor: '#0f172a', padding: '1.5rem', borderRadius: '12px', width: '500px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid #334155' },
  label: { display: 'block', margin: '0.75rem 0 0.25rem 0', color: '#cbd5e1', fontSize: '0.85rem' },
  input: { width: '100%', backgroundColor: '#1e293b', color: '#f8fafc', border: '1px solid #334155', borderRadius: '6px', padding: '0.5rem', boxSizing: 'border-box' },
  modalButtons: { display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' },
};
