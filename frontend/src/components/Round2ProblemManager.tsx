import React, { useState, useEffect } from 'react';
import { round2Api, DebuggingProblem, BugDefinition } from '../services/round2Api';

interface Round2ProblemManagerProps {
  roundId: string;
}

export const Round2ProblemManager: React.FC<Round2ProblemManagerProps> = ({ roundId }) => {
  const [problems, setProblems] = useState<DebuggingProblem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedProblem, setSelectedProblem] = useState<DebuggingProblem | null>(null);
  const [showProblemModal, setShowProblemModal] = useState<boolean>(false);
  const [showBugModal, setShowBugModal] = useState<boolean>(false);

  // Problem form state
  const [probTitle, setProbTitle] = useState<string>('');
  const [probDesc, setProbDesc] = useState<string>('');
  const [probBuggyCode, setProbBuggyCode] = useState<string>('');
  const [probSolutionCode, setProbSolutionCode] = useState<string>('');
  const [probMaxMarks, setProbMaxMarks] = useState<number>(10);
  const [editingProblemId, setEditingProblemId] = useState<string | null>(null);

  // Bug Definition form state
  const [bugId, setBugId] = useState<string>('');
  const [bugTitle, setBugTitle] = useState<string>('');
  const [bugDesc, setBugDesc] = useState<string>('');
  const [bugMarks, setBugMarks] = useState<number>(2);
  const [bugInput, setBugInput] = useState<string>('');
  const [bugExpectedOutput, setBugExpectedOutput] = useState<string>('');
  const [bugMustInclude, setBugMustInclude] = useState<string>('');
  const [editingBugId, setEditingBugId] = useState<string | null>(null);

  const loadProblems = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await round2Api.getAdminProblems(roundId);
      setProblems(res);
      if (res.length > 0 && !selectedProblem) {
        setSelectedProblem(res[0]);
      } else if (selectedProblem) {
        const updated = res.find((p) => p.id === selectedProblem.id);
        if (updated) setSelectedProblem(updated);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load Round 2 problems');
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
    setProbBuggyCode('// Default Buggy C Code\n#include <stdio.h>\n\nint main() {\n    printf("Hello Buggy World\\n");\n    return 0;\n}');
    setProbSolutionCode('');
    setProbMaxMarks(10);
    setShowProblemModal(true);
  };

  const handleOpenEditProblem = (prob: DebuggingProblem) => {
    setEditingProblemId(prob.id);
    setProbTitle(prob.title);
    setProbDesc(prob.description);
    setProbBuggyCode(prob.buggyCode);
    setProbSolutionCode(prob.solutionCode || '');
    setProbMaxMarks(prob.maximumMarks);
    setShowProblemModal(true);
  };

  const handleSaveProblem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProblemId) {
        await round2Api.updateProblem(editingProblemId, {
          title: probTitle,
          description: probDesc,
          buggyCode: probBuggyCode,
          solutionCode: probSolutionCode,
          maximumMarks: probMaxMarks,
        });
      } else {
        await round2Api.createProblem(roundId, {
          title: probTitle,
          description: probDesc,
          buggyCode: probBuggyCode,
          solutionCode: probSolutionCode,
          maximumMarks: probMaxMarks,
        });
      }
      setShowProblemModal(false);
      await loadProblems();
    } catch (err: any) {
      alert(err.message || 'Failed to save problem');
    }
  };

  const handleDeleteProblem = async (problemId: string) => {
    if (!confirm('Are you sure you want to delete this debugging problem?')) return;
    try {
      await round2Api.deleteProblem(problemId);
      if (selectedProblem?.id === problemId) setSelectedProblem(null);
      await loadProblems();
    } catch (err: any) {
      alert(err.message || 'Failed to delete problem');
    }
  };

  const handleOpenNewBug = () => {
    if (!selectedProblem) return;
    setEditingBugId(null);
    setBugId(`BUG-00${(selectedProblem.bugDefinitions?.length || 0) + 1}`);
    setBugTitle('');
    setBugDesc('');
    setBugMarks(2);
    setBugInput('');
    setBugExpectedOutput('');
    setBugMustInclude('');
    setShowBugModal(true);
  };

  const handleOpenEditBug = (bug: BugDefinition) => {
    setEditingBugId(bug.id);
    setBugId(bug.bugId);
    setBugTitle(bug.title);
    setBugDesc(bug.description || '');
    setBugMarks(bug.marks);
    setBugInput(bug.validationConfig?.input || '');
    setBugExpectedOutput(bug.validationConfig?.expectedOutput || '');
    setBugMustInclude(bug.validationConfig?.mustInclude?.join(', ') || '');
    setShowBugModal(true);
  };

  const handleSaveBug = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProblem) return;

    try {
      const validationConfig: any = {};
      if (bugExpectedOutput.trim()) {
        validationConfig.expectedOutput = bugExpectedOutput.trim();
        validationConfig.input = bugInput;
        validationConfig.comparisonMethod = 'TRIM';
      }
      if (bugMustInclude.trim()) {
        validationConfig.mustInclude = bugMustInclude.split(',').map((s) => s.trim()).filter(Boolean);
      }

      if (editingBugId) {
        await round2Api.updateBugDefinition(editingBugId, {
          bugId,
          title: bugTitle,
          description: bugDesc,
          marks: bugMarks,
          validationConfig,
        });
      } else {
        await round2Api.createBugDefinition(selectedProblem.id, {
          bugId,
          title: bugTitle,
          description: bugDesc,
          marks: bugMarks,
          validationConfig,
        });
      }
      setShowBugModal(false);
      await loadProblems();
    } catch (err: any) {
      alert(err.message || 'Failed to save bug definition');
    }
  };

  const handleDeleteBug = async (bugId: string) => {
    if (!confirm('Are you sure you want to delete this bug definition?')) return;
    try {
      await round2Api.deleteBugDefinition(bugId);
      await loadProblems();
    } catch (err: any) {
      alert(err.message || 'Failed to delete bug definition');
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem', color: '#94a3b8' }}>Loading Round 2 problems...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Round 2 Bug Hunt Management</h2>
          <p style={styles.subtitle}>Configure C debugging problems and target bug validation definitions.</p>
        </div>
        <button onClick={handleOpenNewProblem} style={styles.btnPrimary}>
          + Create Debugging Problem
        </button>
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}

      <div style={styles.contentGrid}>
        {/* PROBLEMS LIST */}
        <div style={styles.leftCard}>
          <h3 style={styles.cardHeader}>Debugging Problems ({problems.length})</h3>
          {problems.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No debugging problems created yet.</p>
          ) : (
            <div style={styles.problemList}>
              {problems.map((prob) => (
                <div
                  key={prob.id}
                  onClick={() => setSelectedProblem(prob)}
                  style={{
                    ...styles.problemItem,
                    borderColor: selectedProblem?.id === prob.id ? '#38bdf8' : '#1e293b',
                    backgroundColor: selectedProblem?.id === prob.id ? '#1e293b' : '#0f172a',
                  }}
                >
                  <div style={{ fontWeight: 600, color: '#f8fafc' }}>{prob.title}</div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                    Max Marks: {prob.maximumMarks} | Bugs: {prob.bugDefinitions?.length || 0}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button onClick={(e) => { e.stopPropagation(); handleOpenEditProblem(prob); }} style={styles.btnSmall}>
                      Edit
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteProblem(prob.id); }} style={styles.btnSmallDanger}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SELECTED PROBLEM DETAILS & BUG DEFINITIONS */}
        <div style={styles.rightCard}>
          {selectedProblem ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, color: '#f8fafc' }}>{selectedProblem.title}</h3>
                <button onClick={handleOpenNewBug} style={styles.btnSecondary}>
                  + Add Bug Definition
                </button>
              </div>

              <p style={{ color: '#cbd5e1', fontSize: '0.95rem', margin: '0.75rem 0' }}>{selectedProblem.description}</p>

              <h4 style={{ color: '#38bdf8', marginTop: '1.5rem', marginBottom: '0.5rem' }}>
                Configured Bugs ({selectedProblem.bugDefinitions?.length || 0})
              </h4>

              {(!selectedProblem.bugDefinitions || selectedProblem.bugDefinitions.length === 0) ? (
                <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No bugs defined yet for this problem.</p>
              ) : (
                <div style={styles.bugTable}>
                  <div style={styles.tableHeader}>
                    <span>Bug ID</span>
                    <span>Title / Description</span>
                    <span>Marks</span>
                    <span>Validation Info</span>
                    <span>Actions</span>
                  </div>
                  {selectedProblem.bugDefinitions.map((bug) => (
                    <div key={bug.id} style={styles.tableRow}>
                      <span style={{ fontWeight: 700, color: '#38bdf8' }}>{bug.bugId}</span>
                      <div>
                        <div style={{ color: '#f8fafc', fontWeight: 600 }}>{bug.title}</div>
                        {bug.description && <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{bug.description}</div>}
                      </div>
                      <span style={{ color: '#eab308', fontWeight: 700 }}>+{bug.marks}</span>
                      <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                        {bug.validationConfig?.expectedOutput ? `Output Match: "${bug.validationConfig.expectedOutput}"` : 'Pattern Check'}
                      </span>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => handleOpenEditBug(bug)} style={styles.btnSmall}>Edit</button>
                        <button onClick={() => handleDeleteBug(bug.id)} style={styles.btnSmallDanger}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: '#64748b', textAlign: 'center', padding: '3rem' }}>
              Select a debugging problem from the left list to view and manage its bug definitions.
            </div>
          )}
        </div>
      </div>

      {/* PROBLEM MODAL */}
      {showProblemModal && (
        <div style={styles.modalOverlay}>
          <form onSubmit={handleSaveProblem} style={styles.modalContent}>
            <h3>{editingProblemId ? 'Edit Debugging Problem' : 'Create Debugging Problem'}</h3>
            <label style={styles.label}>Title</label>
            <input type="text" value={probTitle} onChange={(e) => setProbTitle(e.target.value)} required style={styles.input} />

            <label style={styles.label}>Description</label>
            <textarea value={probDesc} onChange={(e) => setProbDesc(e.target.value)} required rows={3} style={styles.input} />

            <label style={styles.label}>Buggy C Code</label>
            <textarea value={probBuggyCode} onChange={(e) => setProbBuggyCode(e.target.value)} required rows={8} style={{ ...styles.input, fontFamily: 'monospace' }} />

            <label style={styles.label}>Maximum Marks</label>
            <input type="number" value={probMaxMarks} onChange={(e) => setProbMaxMarks(Number(e.target.value))} required style={styles.input} />

            <div style={styles.modalButtons}>
              <button type="button" onClick={() => setShowProblemModal(false)} style={styles.btnSecondary}>Cancel</button>
              <button type="submit" style={styles.btnPrimary}>Save Problem</button>
            </div>
          </form>
        </div>
      )}

      {/* BUG MODAL */}
      {showBugModal && (
        <div style={styles.modalOverlay}>
          <form onSubmit={handleSaveBug} style={styles.modalContent}>
            <h3>{editingBugId ? 'Edit Bug Definition' : 'Add Bug Definition'}</h3>
            <label style={styles.label}>Bug Identifier (e.g. BUG-001)</label>
            <input type="text" value={bugId} onChange={(e) => setBugId(e.target.value)} required style={styles.input} />

            <label style={styles.label}>Title / Bug Description</label>
            <input type="text" value={bugTitle} onChange={(e) => setBugTitle(e.target.value)} required style={styles.input} />

            <label style={styles.label}>Marks</label>
            <input type="number" value={bugMarks} onChange={(e) => setBugMarks(Number(e.target.value))} required style={styles.input} />

            <h4 style={{ color: '#38bdf8', marginTop: '1rem' }}>Deterministic Validation Criteria</h4>
            <label style={styles.label}>Test Case Input (stdin)</label>
            <input type="text" value={bugInput} onChange={(e) => setBugInput(e.target.value)} placeholder="Optional stdin input" style={styles.input} />

            <label style={styles.label}>Expected Program Output (stdout)</label>
            <input type="text" value={bugExpectedOutput} onChange={(e) => setBugExpectedOutput(e.target.value)} placeholder="Expected stdout string for fixed code" style={styles.input} />

            <label style={styles.label}>Must Include Code Substrings (comma separated)</label>
            <input type="text" value={bugMustInclude} onChange={(e) => setBugMustInclude(e.target.value)} placeholder="e.g. i < 10, return 0;" style={styles.input} />

            <div style={styles.modalButtons}>
              <button type="button" onClick={() => setShowBugModal(false)} style={styles.btnSecondary}>Cancel</button>
              <button type="submit" style={styles.btnPrimary}>Save Bug Definition</button>
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
  bugTable: { display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' },
  tableHeader: { display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 2fr 1fr', padding: '0.5rem', backgroundColor: '#1e293b', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 },
  tableRow: { display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 2fr 1fr', padding: '0.5rem', backgroundColor: '#090d16', borderBottom: '1px solid #1e293b', alignItems: 'center', fontSize: '0.85rem' },
  btnPrimary: { backgroundColor: '#0284c7', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' },
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
