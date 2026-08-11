import React, { useState, useEffect, useRef } from 'react';
import { round2Api, StudentRound2Data, ExecutionRunResult, SubmissionResult } from '../services/round2Api';

interface Round2CodeEditorProps {
  roundId: string;
  isPaused: boolean;
  onRefreshRoundState?: () => void;
}

export const Round2CodeEditor: React.FC<Round2CodeEditorProps> = ({ roundId, isPaused, onRefreshRoundState }) => {
  const [data, setData] = useState<StudentRound2Data | null>(null);
  const [code, setCode] = useState<string>('');
  const [sampleInput, setSampleInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [running, setRunning] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'console' | 'compiler'>('console');
  const [runResult, setRunResult] = useState<ExecutionRunResult | null>(null);
  const [lastSubmission, setLastSubmission] = useState<SubmissionResult | null>(null);

  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load Round 2 student workspace data
  const loadWorkspace = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await round2Api.getStudentRound2(roundId);
      setData(res);
      setCode(res.problem.savedCode || res.problem.buggyCode);
      setRemainingSeconds(res.round.remainingSeconds);
    } catch (err: any) {
      setError(err.message || 'Failed to load Round 2 workspace');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspace();
  }, [roundId]);

  // Server-authoritative timer countdown
  useEffect(() => {
    if (remainingSeconds <= 0 || isPaused || data?.isSubmitted) return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [remainingSeconds, isPaused, data?.isSubmitted]);

  // Debounced auto-save handler (500ms)
  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    if (data?.isSubmitted || isPaused) return;

    setSaving(true);
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await round2Api.saveStudentCode(roundId, newCode);
        setLastSaved(new Date(res.lastSavedAt).toLocaleTimeString());
      } catch (err) {
        console.error('Auto-save error:', err);
      } finally {
        setSaving(false);
      }
    }, 500);
  };

  // Keyboard tab key handling in textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const updated = code.substring(0, start) + '    ' + code.substring(end);
      setCode(updated);
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 4;
      }, 0);
      handleCodeChange(updated);
    }
  };

  // Run code against custom sample input
  const handleRunCode = async () => {
    if (!data || isPaused || data.isSubmitted) return;
    try {
      setRunning(true);
      setError(null);
      const res = await round2Api.runStudentCode(roundId, data.problem.id, code, sampleInput);
      setRunResult(res);
      setActiveTab(res.compileStatus === 'COMPILATION_ERROR' ? 'compiler' : 'console');
    } catch (err: any) {
      setError(err.message || 'Error running C program');
    } finally {
      setRunning(false);
    }
  };

  // Submit code for bug validation
  const handleSubmitCode = async () => {
    if (!data || isPaused || data.isSubmitted) return;
    try {
      setSubmitting(true);
      setShowSubmitModal(false);
      setError(null);

      const res = await round2Api.submitStudentCode(roundId, data.problem.id, code);
      setLastSubmission(res);

      if (res.compileStatus === 'COMPILATION_ERROR') {
        setActiveTab('compiler');
      } else {
        setActiveTab('console');
      }

      // Reload workspace state
      await loadWorkspace();
      if (onRefreshRoundState) onRefreshRoundState();
    } catch (err: any) {
      setError(err.message || 'Failed to submit solution');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAutoSubmit = async () => {
    if (!data || data.isSubmitted) return;
    await handleSubmitCode();
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div style={styles.centered}>
        <div style={styles.spinner}></div>
        <p style={{ color: '#94a3b8', marginTop: '1rem' }}>Loading Round 2 Bug Hunt Workspace...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={styles.errorBox}>
        <h3 style={{ margin: 0, color: '#ef4444' }}>Round 2 Error</h3>
        <p>{error}</p>
        <button onClick={loadWorkspace} style={styles.btnSecondary}>Retry</button>
      </div>
    );
  }

  if (!data) return null;

  const lines = code.split('\n');

  return (
    <div style={styles.container}>
      {/* HEADER BAR */}
      <div style={styles.header}>
        <div>
          <span style={styles.badgeRound}>ROUND 2 — BUG HUNT</span>
          <h2 style={styles.title}>{data.problem.title}</h2>
        </div>

        <div style={styles.headerRight}>
          <div style={styles.timerCard}>
            <span style={styles.timerLabel}>ROUND TIME REMAINING</span>
            <span style={{ ...styles.timerValue, color: remainingSeconds < 300 ? '#ef4444' : '#38bdf8' }}>
              {formatTime(remainingSeconds)}
            </span>
          </div>

          <div style={styles.saveStatus}>
            {saving ? (
              <span style={{ color: '#eab308' }}>● Saving...</span>
            ) : lastSaved ? (
              <span style={{ color: '#22c55e' }}>✓ Saved {lastSaved}</span>
            ) : (
              <span style={{ color: '#64748b' }}>Ready</span>
            )}
          </div>
        </div>
      </div>

      {/* PAUSED / SUBMITTED OVERLAYS */}
      {isPaused && (
        <div style={styles.pauseBanner}>
          ⚠️ ROUND IS CURRENTLY PAUSED BY ADMIN. Editing and execution are temporarily disabled.
        </div>
      )}

      {data.isSubmitted && (
        <div style={styles.submittedBanner}>
          ✓ ROUND 2 HAS BEEN SUBMITTED. Your code has been evaluated and locked.
        </div>
      )}

      {/* MAIN SPLIT WORKSPACE */}
      <div style={styles.mainLayout}>
        {/* LEFT PANEL: PROBLEM INSTRUCTIONS */}
        <div style={styles.leftPanel}>
          <div style={styles.panelHeader}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: '#f8fafc' }}>Problem Description</h3>
          </div>
          <div style={styles.descriptionContent}>
            <p style={{ whiteSpace: 'pre-wrap', color: '#cbd5e1', lineHeight: '1.6' }}>{data.problem.description}</p>

            <div style={styles.instructionCard}>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#38bdf8' }}>Target Language & Rules</h4>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#94a3b8', fontSize: '0.9rem' }}>
                <li>Language: <strong>C (GCC Compiler)</strong></li>
                <li>Edit code to fix all identified bugs.</li>
                <li>Use <strong>Run Code</strong> to test against sample inputs.</li>
                <li>Use <strong>Submit Fixed Program</strong> to evaluate your fixes and earn marks.</li>
                <li>Marks are awarded for newly fixed bugs. Re-submitting will not duplicate marks.</li>
              </ul>
            </div>

            {lastSubmission && (
              <div style={styles.submissionSummaryCard}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#22c55e' }}>Latest Submission Results</h4>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.9rem' }}>
                  <div>Compile Status: <strong style={{ color: lastSubmission.compileStatus === 'SUCCESS' ? '#22c55e' : '#ef4444' }}>{lastSubmission.compileStatus}</strong></div>
                  <div>Newly Fixed Bugs: <strong style={{ color: '#eab308' }}>+{lastSubmission.newlyFixedBugsCount}</strong></div>
                  <div>Total Fixed Bugs: <strong style={{ color: '#38bdf8' }}>{lastSubmission.totalFixedBugsCount}</strong></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: CODE EDITOR + OUTPUT */}
        <div style={styles.rightPanel}>
          {/* EDITOR BAR */}
          <div style={styles.editorToolbar}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={styles.cBadge}>C</span>
              <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>main.c</span>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={handleRunCode}
                disabled={running || submitting || isPaused || data.isSubmitted}
                style={styles.btnRun}
              >
                {running ? 'Running...' : '▶ Run Code'}
              </button>

              <button
                onClick={() => setShowSubmitModal(true)}
                disabled={running || submitting || isPaused || data.isSubmitted}
                style={styles.btnSubmit}
              >
                {submitting ? 'Submitting...' : '🚀 Submit Fixed Program'}
              </button>
            </div>
          </div>

          {/* CODE TEXTAREA WITH LINE NUMBERS */}
          <div style={styles.editorContainer}>
            <div style={styles.lineNumbers}>
              {lines.map((_, i) => (
                <div key={i} style={styles.lineNumber}>{i + 1}</div>
              ))}
            </div>

            <textarea
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isPaused || data.isSubmitted}
              style={styles.codeTextarea}
              placeholder="// Write/Fix your C program here..."
              spellCheck={false}
            />
          </div>

          {/* SAMPLE INPUT & OUTPUT CONSOLE */}
          <div style={styles.consoleContainer}>
            <div style={styles.tabHeader}>
              <button
                onClick={() => setActiveTab('console')}
                style={{ ...styles.tabBtn, borderBottom: activeTab === 'console' ? '2px solid #38bdf8' : 'none', color: activeTab === 'console' ? '#38bdf8' : '#64748b' }}
              >
                Terminal Output
              </button>
              <button
                onClick={() => setActiveTab('compiler')}
                style={{ ...styles.tabBtn, borderBottom: activeTab === 'compiler' ? '2px solid #38bdf8' : 'none', color: activeTab === 'compiler' ? '#38bdf8' : '#64748b' }}
              >
                Compiler Log
              </button>

              <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Custom Input (stdin):</span>
                <input
                  type="text"
                  value={sampleInput}
                  onChange={(e) => setSampleInput(e.target.value)}
                  placeholder="Enter sample input..."
                  style={styles.sampleInput}
                  disabled={isPaused || data.isSubmitted}
                />
              </div>
            </div>

            <div style={styles.tabContent}>
              {activeTab === 'console' && (
                <pre style={styles.logOutput}>
                  {runResult?.executionOutput || lastSubmission?.executionOutput || '// Output will appear here after running/submitting...'}
                </pre>
              )}

              {activeTab === 'compiler' && (
                <pre style={{ ...styles.logOutput, color: '#f87171' }}>
                  {runResult?.compileOutput || lastSubmission?.compileOutput || '// Compiler output & warnings will appear here...'}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CONFIRMATION SUBMIT MODAL */}
      {showSubmitModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#f8fafc' }}>Confirm Program Submission</h3>
            <p style={{ color: '#cbd5e1', fontSize: '0.95rem', lineHeight: '1.5' }}>
              Are you sure you want to submit your C program for bug evaluation?
              Your code will be checked against the bug test criteria and marks will be updated.
            </p>
            <div style={styles.modalButtons}>
              <button onClick={() => setShowSubmitModal(false)} style={styles.btnSecondary}>
                Cancel
              </button>
              <button onClick={handleSubmitCode} style={styles.btnSubmit}>
                Confirm & Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 120px)',
    backgroundColor: '#090d16',
    color: '#f8fafc',
    borderRadius: '12px',
    overflow: 'hidden',
    border: '1px solid #1e293b',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem 1.25rem',
    backgroundColor: '#0f172a',
    borderBottom: '1px solid #1e293b',
  },
  badgeRound: {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    padding: '0.2rem 0.6rem',
    borderRadius: '4px',
    letterSpacing: '0.05em',
  },
  title: {
    margin: '0.25rem 0 0 0',
    fontSize: '1.15rem',
    fontWeight: 600,
    color: '#f8fafc',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
  },
  timerCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  timerLabel: {
    fontSize: '0.65rem',
    color: '#64748b',
    fontWeight: 700,
    letterSpacing: '0.05em',
  },
  timerValue: {
    fontFamily: 'monospace',
    fontSize: '1.25rem',
    fontWeight: 700,
  },
  saveStatus: {
    fontSize: '0.85rem',
    fontWeight: 500,
  },
  pauseBanner: {
    backgroundColor: '#b45309',
    color: '#fff',
    padding: '0.6rem 1rem',
    textAlign: 'center',
    fontWeight: 600,
    fontSize: '0.9rem',
  },
  submittedBanner: {
    backgroundColor: '#15803d',
    color: '#fff',
    padding: '0.6rem 1rem',
    textAlign: 'center',
    fontWeight: 600,
    fontSize: '0.9rem',
  },
  mainLayout: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  leftPanel: {
    width: '40%',
    backgroundColor: '#0f172a',
    borderRight: '1px solid #1e293b',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
  },
  rightPanel: {
    width: '60%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#090d16',
  },
  panelHeader: {
    padding: '0.75rem 1rem',
    borderBottom: '1px solid #1e293b',
    backgroundColor: '#1e293b',
  },
  descriptionContent: {
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  instructionCard: {
    backgroundColor: '#1e293b',
    borderRadius: '8px',
    padding: '1rem',
    border: '1px solid #334155',
  },
  submissionSummaryCard: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: '8px',
    padding: '1rem',
    border: '1px solid rgba(34, 197, 94, 0.3)',
  },
  editorToolbar: {
    display: 'flex',
    justify: 'space-between',
    alignItems: 'center',
    padding: '0.5rem 1rem',
    backgroundColor: '#0f172a',
    borderBottom: '1px solid #1e293b',
  },
  cBadge: {
    backgroundColor: '#0284c7',
    color: '#fff',
    fontWeight: 700,
    fontSize: '0.75rem',
    padding: '0.15rem 0.4rem',
    borderRadius: '3px',
  },
  btnRun: {
    backgroundColor: '#334155',
    color: '#f8fafc',
    border: 'none',
    padding: '0.4rem 0.9rem',
    borderRadius: '6px',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnSubmit: {
    backgroundColor: '#0284c7',
    color: '#fff',
    border: 'none',
    padding: '0.4rem 1rem',
    borderRadius: '6px',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  editorContainer: {
    display: 'flex',
    flex: 1,
    backgroundColor: '#030712',
    overflow: 'hidden',
    position: 'relative',
  },
  lineNumbers: {
    padding: '1rem 0.5rem',
    backgroundColor: '#0b0f19',
    color: '#475569',
    fontFamily: 'monospace',
    fontSize: '0.9rem',
    lineHeight: '1.5',
    textAlign: 'right',
    userSelect: 'none',
    borderRight: '1px solid #1e293b',
    minWidth: '40px',
  },
  lineNumber: {
    height: '1.5em',
  },
  codeTextarea: {
    flex: 1,
    backgroundColor: 'transparent',
    color: '#38bdf8',
    border: 'none',
    padding: '1rem',
    fontFamily: 'Consolas, Monaco, "Andale Mono", monospace',
    fontSize: '0.95rem',
    lineHeight: '1.5',
    resize: 'none',
    outline: 'none',
  },
  consoleContainer: {
    height: '180px',
    backgroundColor: '#0b0f19',
    borderTop: '1px solid #1e293b',
    display: 'flex',
    flexDirection: 'column',
  },
  tabHeader: {
    display: 'flex',
    backgroundColor: '#0f172a',
    borderBottom: '1px solid #1e293b',
    padding: '0 0.5rem',
  },
  tabBtn: {
    background: 'none',
    border: 'none',
    padding: '0.5rem 1rem',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  sampleInput: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    border: '1px solid #334155',
    borderRadius: '4px',
    padding: '0.2rem 0.5rem',
    fontSize: '0.8rem',
    width: '180px',
  },
  tabContent: {
    flex: 1,
    padding: '0.75rem',
    overflowY: 'auto',
  },
  logOutput: {
    margin: 0,
    fontFamily: 'monospace',
    fontSize: '0.85rem',
    color: '#e2e8f0',
    whiteSpace: 'pre-wrap',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#0f172a',
    padding: '1.5rem',
    borderRadius: '12px',
    width: '420px',
    border: '1px solid #334155',
  },
  modalButtons: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    marginTop: '1.5rem',
  },
  btnSecondary: {
    backgroundColor: '#334155',
    color: '#f8fafc',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  centered: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #1e293b',
    borderTopColor: '#38bdf8',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  errorBox: {
    padding: '2rem',
    backgroundColor: '#1e1b4b',
    borderRadius: '8px',
    color: '#f8fafc',
    textAlign: 'center',
  },
};
