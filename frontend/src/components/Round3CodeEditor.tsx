import React, { useState, useEffect, useRef } from 'react';
import { round3Api, StudentRound3Data, ExecutionRunResult, SubmissionResult } from '../services/round3Api';

interface Round3CodeEditorProps {
  roundId: string;
  isPaused: boolean;
  onRefreshRoundState?: () => void;
}

const DEFAULT_STARTER_CODES: Record<string, string> = {
  C: `#include <stdio.h>\n\nint main() {\n    // Write your solution in C\n    return 0;\n}`,
  CPP: `#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your solution in C++\n    return 0;\n}`,
  JAVA: `import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        // Write your solution in Java\n    }\n}`,
  PYTHON: `# Write your solution in Python 3\nimport sys\n\ndef main():\n    pass\n\nif __name__ == "__main__":\n    main()`,
};

export const Round3CodeEditor: React.FC<Round3CodeEditorProps> = ({ roundId, isPaused, onRefreshRoundState }) => {
  const [data, setData] = useState<StudentRound3Data | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('C');
  const [codeMap, setCodeMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [running, setRunning] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'visible' | 'submission' | 'compiler'>('visible');
  const [runResult, setRunResult] = useState<ExecutionRunResult | null>(null);
  const [lastSubmission, setLastSubmission] = useState<SubmissionResult | null>(null);

  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const loadWorkspace = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await round3Api.getStudentRound3(roundId);
      setData(res);

      const supported = res.problem.supportedLanguages;
      const initialLang = supported.length > 0 ? supported[0] : 'C';
      setSelectedLanguage(initialLang);

      // Build code map from saved code map or starter code
      const map: Record<string, string> = { ...res.problem.savedCodeMap };
      for (const lang of supported) {
        if (!map[lang]) {
          map[lang] = res.problem.starterCode || DEFAULT_STARTER_CODES[lang] || '';
        }
      }
      setCodeMap(map);
      setRemainingSeconds(res.round.remainingSeconds);
    } catch (err: any) {
      setError(err.message || 'Failed to load Round 3 workspace');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspace();
  }, [roundId]);

  // Server countdown timer
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

  const currentCode = codeMap[selectedLanguage] || '';

  const handleCodeChange = (newCode: string) => {
    setCodeMap((prev) => ({ ...prev, [selectedLanguage]: newCode }));
    if (data?.isSubmitted || isPaused) return;

    setSaving(true);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await round3Api.saveStudentCode(roundId, selectedLanguage, newCode);
        setLastSaved(new Date(res.lastSavedAt).toLocaleTimeString());
      } catch (err) {
        console.error('Auto-save error:', err);
      } finally {
        setSaving(false);
      }
    }, 500);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const updated = currentCode.substring(0, start) + '    ' + currentCode.substring(end);
      handleCodeChange(updated);
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 4;
      }, 0);
    }
  };

  const handleRunCode = async () => {
    if (!data || isPaused || data.isSubmitted) return;
    try {
      setRunning(true);
      setError(null);
      const res = await round3Api.runStudentCode(roundId, data.problem.id, selectedLanguage, currentCode);
      setRunResult(res);
      setActiveTab(res.compileStatus === 'COMPILATION_ERROR' ? 'compiler' : 'visible');
    } catch (err: any) {
      setError(err.message || 'Error running code');
    } finally {
      setRunning(false);
    }
  };

  const handleSubmitCode = async () => {
    if (!data || isPaused || data.isSubmitted) return;
    try {
      setSubmitting(true);
      setShowSubmitModal(false);
      setError(null);

      const res = await round3Api.submitStudentCode(roundId, data.problem.id, selectedLanguage, currentCode);
      setLastSubmission(res);

      if (res.compileStatus === 'COMPILATION_ERROR') {
        setActiveTab('compiler');
      } else {
        setActiveTab('submission');
      }

      await loadWorkspace();
      if (onRefreshRoundState) onRefreshRoundState();
    } catch (err: any) {
      setError(err.message || 'Failed to submit code');
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
        <p style={{ color: '#94a3b8', marginTop: '1rem' }}>Loading Round 3 Programming Workspace...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={styles.errorBox}>
        <h3 style={{ margin: 0, color: '#ef4444' }}>Round 3 Error</h3>
        <p>{error}</p>
        <button onClick={loadWorkspace} style={styles.btnSecondary}>Retry</button>
      </div>
    );
  }

  if (!data) return null;

  const lines = currentCode.split('\n');

  return (
    <div style={styles.container}>
      {/* HEADER BAR */}
      <div style={styles.header}>
        <div>
          <span style={styles.badgeRound}>ROUND 3 — PROGRAMMING CHALLENGE</span>
          <h2 style={styles.title}>{data.problem.title}</h2>
        </div>

        <div style={styles.headerRight}>
          <div style={styles.timerCard}>
            <span style={styles.timerLabel}>ROUND TIME REMAINING</span>
            <span style={{ ...styles.timerValue, color: remainingSeconds < 300 ? '#ef4444' : '#a855f7' }}>
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

      {/* OVERLAYS */}
      {isPaused && (
        <div style={styles.pauseBanner}>
          ⚠️ ROUND IS CURRENTLY PAUSED BY ADMIN. Code execution and submission are temporarily disabled.
        </div>
      )}

      {data.isSubmitted && (
        <div style={styles.submittedBanner}>
          ✓ ROUND 3 HAS BEEN SUBMITTED. Your solution has been evaluated and locked.
        </div>
      )}

      {/* MAIN WORKSPACE */}
      <div style={styles.mainLayout}>
        {/* LEFT PANEL: PROBLEM STATEMENT */}
        <div style={styles.leftPanel}>
          <div style={styles.panelHeader}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: '#f8fafc' }}>Problem Statement</h3>
          </div>
          <div style={styles.descriptionContent}>
            <p style={{ whiteSpace: 'pre-wrap', color: '#cbd5e1', lineHeight: '1.6' }}>{data.problem.description}</p>

            {data.problem.inputFormat && (
              <div style={styles.sectionBox}>
                <h4 style={styles.sectionTitle}>Input Format</h4>
                <p style={styles.sectionText}>{data.problem.inputFormat}</p>
              </div>
            )}

            {data.problem.outputFormat && (
              <div style={styles.sectionBox}>
                <h4 style={styles.sectionTitle}>Output Format</h4>
                <p style={styles.sectionText}>{data.problem.outputFormat}</p>
              </div>
            )}

            {data.problem.constraints && (
              <div style={styles.sectionBox}>
                <h4 style={styles.sectionTitle}>Constraints</h4>
                <p style={styles.sectionText}>{data.problem.constraints}</p>
              </div>
            )}

            {/* VISIBLE TEST CASES PREVIEW */}
            <div style={styles.sectionBox}>
              <h4 style={styles.sectionTitle}>Sample Test Cases</h4>
              {data.problem.visibleTestCases.map((tc, idx) => (
                <div key={tc.id} style={styles.testCaseSample}>
                  <div style={{ fontWeight: 600, color: '#a855f7', fontSize: '0.85rem' }}>Sample Case #{idx + 1}</div>
                  <div style={{ marginTop: '0.4rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Input:</span>
                    <pre style={styles.sampleCode}>{tc.input || '(empty)'}</pre>
                  </div>
                  <div style={{ marginTop: '0.4rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Expected Output:</span>
                    <pre style={styles.sampleCode}>{tc.expectedOutput || '(empty)'}</pre>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: EDITOR + CONSOLE */}
        <div style={styles.rightPanel}>
          {/* TOOLBAR: LANGUAGE SELECTOR & BUTTONS */}
          <div style={styles.editorToolbar}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600 }}>Language:</span>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                disabled={isPaused || data.isSubmitted}
                style={styles.langSelect}
              >
                {data.problem.supportedLanguages.map((lang) => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={handleRunCode}
                disabled={running || submitting || isPaused || data.isSubmitted}
                style={styles.btnRun}
              >
                {running ? 'Running...' : '▶ Run Visible Tests'}
              </button>

              <button
                onClick={() => setShowSubmitModal(true)}
                disabled={running || submitting || isPaused || data.isSubmitted}
                style={styles.btnSubmit}
              >
                {submitting ? 'Submitting...' : '⚡ Submit Program'}
              </button>
            </div>
          </div>

          {/* CODE EDITOR */}
          <div style={styles.editorContainer}>
            <div style={styles.lineNumbers}>
              {lines.map((_, i) => (
                <div key={i} style={styles.lineNumber}>{i + 1}</div>
              ))}
            </div>

            <textarea
              value={currentCode}
              onChange={(e) => handleCodeChange(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isPaused || data.isSubmitted}
              style={styles.codeTextarea}
              placeholder={`// Write your ${selectedLanguage} solution here...`}
              spellCheck={false}
            />
          </div>

          {/* CONSOLE / TEST RESULTS PANEL */}
          <div style={styles.consoleContainer}>
            <div style={styles.tabHeader}>
              <button
                onClick={() => setActiveTab('visible')}
                style={{ ...styles.tabBtn, borderBottom: activeTab === 'visible' ? '2px solid #a855f7' : 'none', color: activeTab === 'visible' ? '#a855f7' : '#64748b' }}
              >
                Visible Test Results ({runResult?.totalPassedTests ?? 0}/{runResult?.totalTests ?? 0})
              </button>

              <button
                onClick={() => setActiveTab('submission')}
                style={{ ...styles.tabBtn, borderBottom: activeTab === 'submission' ? '2px solid #a855f7' : 'none', color: activeTab === 'submission' ? '#a855f7' : '#64748b' }}
              >
                Official Submission Score ({lastSubmission ? `${lastSubmission.passedTests}/${lastSubmission.totalTests}` : 'None'})
              </button>

              <button
                onClick={() => setActiveTab('compiler')}
                style={{ ...styles.tabBtn, borderBottom: activeTab === 'compiler' ? '2px solid #a855f7' : 'none', color: activeTab === 'compiler' ? '#a855f7' : '#64748b' }}
              >
                Compiler Output
              </button>
            </div>

            <div style={styles.tabContent}>
              {activeTab === 'visible' && (
                <div>
                  {!runResult ? (
                    <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Click "Run Visible Tests" to test your solution against visible sample cases.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {runResult.visibleTestResults.map((tr, idx) => (
                        <div key={idx} style={styles.testResultRow}>
                          <span style={{ fontWeight: 700, color: tr.status === 'ACCEPTED' ? '#22c55e' : '#ef4444' }}>
                            {tr.status === 'ACCEPTED' ? '✓ PASSED' : '✕ FAILED'}
                          </span>
                          <span>Test Case #{idx + 1}</span>
                          <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{tr.executionTimeMs}ms</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'submission' && (
                <div>
                  {!lastSubmission ? (
                    <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No official submission recorded yet.</p>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', alignItems: 'center' }}>
                        <div>Passed Tests: <strong style={{ color: '#a855f7' }}>{lastSubmission.passedTests} / {lastSubmission.totalTests}</strong></div>
                        <div>Official Score: <strong style={{ color: '#22c55e' }}>{lastSubmission.score} / {lastSubmission.maximumScore}</strong></div>
                        <div>Status: <strong style={{ color: lastSubmission.submissionStatus === 'ACCEPTED' ? '#22c55e' : '#ef4444' }}>{lastSubmission.submissionStatus}</strong></div>
                      </div>

                      {/* SAFE TEST RESULTS DISPLAY: Hidden inputs & outputs strictly omitted */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {lastSubmission.testResults.map((tr, idx) => (
                          <div key={idx} style={styles.testResultRow}>
                            <span style={{ fontWeight: 700, color: tr.status === 'ACCEPTED' ? '#22c55e' : '#ef4444' }}>
                              {tr.status === 'ACCEPTED' ? '✓ PASSED' : '✕ FAILED'}
                            </span>
                            <span>Test Case #{idx + 1} ({tr.visibility})</span>
                            <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{tr.executionTimeMs}ms</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'compiler' && (
                <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '0.85rem', color: '#f87171' }}>
                  {runResult?.compileOutput || lastSubmission?.compileOutput || '// Compiler output and build warnings will appear here...'}
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
            <h3 style={{ margin: '0 0 1rem 0', color: '#f8fafc' }}>Confirm Programming Submission</h3>
            <p style={{ color: '#cbd5e1', fontSize: '0.95rem', lineHeight: '1.5' }}>
              Are you sure you want to submit your <strong>{selectedLanguage}</strong> solution?
              It will be compiled and evaluated against all visible and hidden test cases to calculate your official score.
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
  container: { display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', backgroundColor: '#090d16', color: '#f8fafc', borderRadius: '12px', overflow: 'hidden', border: '1px solid #1e293b' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1.25rem', backgroundColor: '#0f172a', borderBottom: '1px solid #1e293b' },
  badgeRound: { fontSize: '0.75rem', fontWeight: 700, color: '#c084fc', backgroundColor: 'rgba(168, 85, 247, 0.1)', padding: '0.2rem 0.6rem', borderRadius: '4px', letterSpacing: '0.05em' },
  title: { margin: '0.25rem 0 0 0', fontSize: '1.15rem', fontWeight: 600, color: '#f8fafc' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '1.5rem' },
  timerCard: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end' },
  timerLabel: { fontSize: '0.65rem', color: '#64748b', fontWeight: 700, letterSpacing: '0.05em' },
  timerValue: { fontFamily: 'monospace', fontSize: '1.25rem', fontWeight: 700 },
  saveStatus: { fontSize: '0.85rem', fontWeight: 500 },
  pauseBanner: { backgroundColor: '#b45309', color: '#fff', padding: '0.6rem 1rem', textAlign: 'center', fontWeight: 600, fontSize: '0.9rem' },
  submittedBanner: { backgroundColor: '#15803d', color: '#fff', padding: '0.6rem 1rem', textAlign: 'center', fontWeight: 600, fontSize: '0.9rem' },
  mainLayout: { display: 'flex', flex: 1, overflow: 'hidden' },
  leftPanel: { width: '40%', backgroundColor: '#0f172a', borderRight: '1px solid #1e293b', display: 'flex', flexDirection: 'column', overflowY: 'auto' },
  rightPanel: { width: '60%', display: 'flex', flexDirection: 'column', backgroundColor: '#090d16' },
  panelHeader: { padding: '0.75rem 1rem', borderBottom: '1px solid #1e293b', backgroundColor: '#1e293b' },
  descriptionContent: { padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' },
  sectionBox: { backgroundColor: '#1e293b', borderRadius: '8px', padding: '0.85rem', border: '1px solid #334155' },
  sectionTitle: { margin: '0 0 0.4rem 0', color: '#c084fc', fontSize: '0.9rem' },
  sectionText: { margin: 0, color: '#cbd5e1', fontSize: '0.85rem', whiteSpace: 'pre-wrap' },
  testCaseSample: { backgroundColor: '#090d16', padding: '0.6rem', borderRadius: '6px', border: '1px solid #334155', marginTop: '0.5rem' },
  sampleCode: { margin: 0, fontFamily: 'monospace', backgroundColor: '#030712', padding: '0.4rem', borderRadius: '4px', color: '#38bdf8', fontSize: '0.8rem' },
  editorToolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 1rem', backgroundColor: '#0f172a', borderBottom: '1px solid #1e293b' },
  langSelect: { backgroundColor: '#1e293b', color: '#f8fafc', border: '1px solid #334155', borderRadius: '4px', padding: '0.25rem 0.5rem', fontWeight: 600 },
  btnRun: { backgroundColor: '#334155', color: '#f8fafc', border: 'none', padding: '0.4rem 0.9rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' },
  btnSubmit: { backgroundColor: '#9333ea', color: '#fff', border: 'none', padding: '0.4rem 1rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' },
  editorContainer: { display: 'flex', flex: 1, backgroundColor: '#030712', overflow: 'hidden', position: 'relative' },
  lineNumbers: { padding: '1rem 0.5rem', backgroundColor: '#0b0f19', color: '#475569', fontFamily: 'monospace', fontSize: '0.9rem', lineHeight: '1.5', textAlign: 'right', userSelect: 'none', borderRight: '1px solid #1e293b', minWidth: '40px' },
  lineNumber: { height: '1.5em' },
  codeTextarea: { flex: 1, backgroundColor: 'transparent', color: '#c084fc', border: 'none', padding: '1rem', fontFamily: 'Consolas, Monaco, monospace', fontSize: '0.95rem', lineHeight: '1.5', resize: 'none', outline: 'none' },
  consoleContainer: { height: '180px', backgroundColor: '#0b0f19', borderTop: '1px solid #1e293b', display: 'flex', flexDirection: 'column' },
  tabHeader: { display: 'flex', backgroundColor: '#0f172a', borderBottom: '1px solid #1e293b', padding: '0 0.5rem' },
  tabBtn: { background: 'none', border: 'none', padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' },
  tabContent: { flex: 1, padding: '0.75rem', overflowY: 'auto' },
  testResultRow: { display: 'flex', gap: '1rem', padding: '0.4rem 0.6rem', backgroundColor: '#1e293b', borderRadius: '4px', alignItems: 'center', fontSize: '0.85rem' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalContent: { backgroundColor: '#0f172a', padding: '1.5rem', borderRadius: '12px', width: '420px', border: '1px solid #334155' },
  modalButtons: { display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' },
  btnSecondary: { backgroundColor: '#334155', color: '#f8fafc', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer' },
  centered: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem' },
  spinner: { width: '32px', height: '32px', border: '3px solid #1e293b', borderTopColor: '#c084fc', borderRadius: '50%', animation: 'spin 1s linear infinite' },
  errorBox: { padding: '2rem', backgroundColor: '#1e1b4b', borderRadius: '8px', color: '#f8fafc', textAlign: 'center' },
};
