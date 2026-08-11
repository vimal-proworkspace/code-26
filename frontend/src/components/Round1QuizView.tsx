import React, { useState, useEffect, useRef } from 'react';
import { round1Api, StudentSanitizedQuestion, StudentQuizResponse, SubmitRound1Response } from '../services/round1Api';

interface Round1QuizViewProps {
  roundId: string;
  onSubmitted?: () => void;
}

export const Round1QuizView: React.FC<Round1QuizViewProps> = ({ roundId, onSubmitted }) => {
  const [data, setData] = useState<StudentQuizResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [saveStatus, setSaveStatus] = useState<Record<string, 'saved' | 'saving' | 'error'>>({});

  const [isConfirmSubmitOpen, setIsConfirmSubmitOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitResult, setSubmitResult] = useState<SubmitRound1Response | null>(null);

  const saveDebounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

  // 1. Fetch Quiz Data on Mount
  const fetchQuiz = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await round1Api.getStudentQuiz(roundId);
      setData(res);

      if (res.isSubmitted) {
        setSubmitResult({
          status: 'SUBMITTED',
          score: res.score || 0,
          maximumScore: res.maximumScore || 0,
          submittedAt: res.submittedAt || new Date().toISOString(),
          correctCount: 0,
          incorrectCount: 0,
          unansweredCount: 0,
        });
      } else {
        setRemainingSeconds(res.round?.remainingSeconds || 0);

        // Populate initial saved answers map
        const initialMap: Record<string, string> = {};
        if (res.savedAnswers) {
          for (const sa of res.savedAnswers) {
            initialMap[sa.questionId] = sa.answer;
          }
        }
        setAnswers(initialMap);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load Round 1 quiz');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuiz();
  }, [roundId]);

  // 2. Countdown Timer Effect
  useEffect(() => {
    if (data?.isSubmitted || submitResult || remainingSeconds <= 0) return;

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // Auto submit on time expiry
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [data?.isSubmitted, submitResult, remainingSeconds > 0]);

  // 3. Debounced Save Answer Handler
  const handleAnswerChange = (questionId: string, value: string) => {
    // Immediate local UI state update
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setSaveStatus((prev) => ({ ...prev, [questionId]: 'saving' }));

    // Clear existing timer for this question
    if (saveDebounceTimers.current[questionId]) {
      clearTimeout(saveDebounceTimers.current[questionId]);
    }

    // Schedule debounced API call (500ms)
    saveDebounceTimers.current[questionId] = setTimeout(async () => {
      try {
        await round1Api.saveAnswer(roundId, questionId, value);
        setSaveStatus((prev) => ({ ...prev, [questionId]: 'saved' }));
      } catch (err) {
        console.error(`Failed to auto-save answer for ${questionId}:`, err);
        setSaveStatus((prev) => ({ ...prev, [questionId]: 'error' }));
      }
    }, 500);
  };

  // 4. Submit Handlers
  const handleAutoSubmit = async () => {
    if (submitting || submitResult) return;
    try {
      setSubmitting(true);
      const res = await round1Api.submitRound1(roundId);
      setSubmitResult(res);
      if (onSubmitted) onSubmitted();
    } catch (err: any) {
      console.error('Auto-submit failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualSubmit = async () => {
    try {
      setSubmitting(true);
      const res = await round1Api.submitRound1(roundId);
      setSubmitResult(res);
      setIsConfirmSubmitOpen(false);
      if (onSubmitted) onSubmitted();
    } catch (err: any) {
      alert(err.message || 'Failed to submit Round 1');
    } finally {
      setSubmitting(false);
    }
  };

  // Format seconds to MM:SS
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '60vh', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
        <p style={{ fontSize: '1.25rem' }}>Loading Round 1 Live Quiz...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#fca5a5', padding: '1.5rem', borderRadius: '0.75rem', margin: '2rem auto', maxWidth: '600px', textAlign: 'center' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Round 1 Unavailable</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (submitResult) {
    return (
      <div style={{ maxWidth: '600px', margin: '3rem auto', backgroundColor: '#1e293b', borderRadius: '1rem', border: '1px solid #10b981', padding: '2.5rem', textAlign: 'center', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)' }}>
        <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.2)', border: '2px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto', fontSize: '1.75rem', color: '#10b981' }}>
          ✓
        </div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#10b981', marginBottom: '0.5rem' }}>
          Round 1 Submitted Successfully!
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '1rem', marginBottom: '2rem' }}>
          Your answers have been securely evaluated and recorded.
        </p>

        <div style={{ backgroundColor: '#0f172a', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid #334155', display: 'inline-flex', gap: '3rem', textAlign: 'center' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Submission Status</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#10b981' }}>COMPLETED</span>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Submitted At</span>
            <span style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc' }}>
              {new Date(submitResult.submittedAt).toLocaleTimeString()}
            </span>
          </div>
        </div>

        <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '2rem' }}>
          Please keep your browser window open and wait for the administrator to initiate the next round.
        </p>
      </div>
    );
  }

  const questions = data?.questions || [];
  const currentQuestion: StudentSanitizedQuestion | undefined = questions[currentIndex];
  const answeredCount = Object.keys(answers).filter((k) => answers[k] && answers[k].trim().length > 0).length;

  return (
    <div style={{ maxWidth: '900px', margin: '1.5rem auto', padding: '0 1rem', color: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      {/* Top Banner with Server Timer & Progress */}
      <div style={{ backgroundColor: '#1e293b', borderRadius: '1rem', border: '1px solid #334155', padding: '1rem 1.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)' }}>
        <div>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 'bold', margin: 0, color: '#38bdf8' }}>
            {data?.round?.name || 'ROUND 1'}
          </h2>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            Question {questions.length > 0 ? currentIndex + 1 : 0} of {questions.length}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Time Remaining</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 'bold', fontFamily: 'monospace', color: remainingSeconds < 300 ? '#ef4444' : '#10b981' }}>
              {formatTimer(remainingSeconds)}
            </span>
          </div>

          <button
            onClick={() => setIsConfirmSubmitOpen(true)}
            style={{ backgroundColor: '#0284c7', color: '#ffffff', border: 'none', padding: '0.625rem 1.25rem', borderRadius: '0.5rem', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}
          >
            SUBMIT ROUND
          </button>
        </div>
      </div>

      {/* Question Grid Navigator */}
      <div style={{ backgroundColor: '#1e293b', borderRadius: '0.75rem', border: '1px solid #334155', padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', fontSize: '0.8rem', color: '#94a3b8' }}>
          <span>Question Navigation:</span>
          <span>Progress: <strong style={{ color: '#38bdf8' }}>{answeredCount} / {questions.length} Answered</strong></span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {questions.map((q, idx) => {
            const isAnswered = answers[q.id] && answers[q.id].trim().length > 0;
            const isCurrent = idx === currentIndex;
            return (
              <button
                key={q.id}
                onClick={() => setCurrentIndex(idx)}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '0.375rem',
                  border: isCurrent ? '2px solid #38bdf8' : '1px solid #475569',
                  backgroundColor: isAnswered ? '#0284c7' : '#0f172a',
                  color: '#ffffff',
                  fontWeight: isCurrent ? 700 : 500,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Question Display Card */}
      {currentQuestion && (
        <div style={{ backgroundColor: '#1e293b', borderRadius: '1rem', border: '1px solid #334155', padding: '2rem', marginBottom: '1.5rem', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid #38bdf8', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>
              {currentQuestion.questionType}
            </span>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Marks: <strong style={{ color: '#10b981' }}>+{currentQuestion.marks}</strong>
              {currentQuestion.negativeMarks > 0 && <span style={{ color: '#ef4444', marginLeft: '0.5rem' }}>(-{currentQuestion.negativeMarks})</span>}
              {saveStatus[currentQuestion.id] === 'saving' && <span style={{ marginLeft: '1rem', color: '#fbbf24' }}>Saving...</span>}
              {saveStatus[currentQuestion.id] === 'saved' && <span style={{ marginLeft: '1rem', color: '#10b981' }}>✓ Saved</span>}
            </div>
          </div>

          <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.25rem', color: '#f8fafc', lineHeight: 1.5 }}>
            {currentIndex + 1}. {currentQuestion.questionText}
          </h3>

          {/* Code Snippet formatted block if present */}
          {currentQuestion.code && (
            <pre style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '1rem', color: '#38bdf8', fontFamily: 'Consolas, Monaco, monospace', fontSize: '0.9rem', overflowX: 'auto', marginBottom: '1.5rem' }}>
              <code>{currentQuestion.code}</code>
            </pre>
          )}

          {/* MCQ Options Display */}
          {currentQuestion.questionType === 'MCQ' || currentQuestion.questionType === 'MULTIPLE_CHOICE' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {currentQuestion.options.map((opt) => {
                const isSelected = answers[currentQuestion.id] === opt.optionKey;
                return (
                  <label
                    key={opt.id || opt.optionKey}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      backgroundColor: isSelected ? 'rgba(2, 132, 199, 0.2)' : '#0f172a',
                      border: isSelected ? '1px solid #38bdf8' : '1px solid #334155',
                      padding: '0.875rem 1.25rem',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      transition: 'border-color 0.2s, background-color 0.2s',
                    }}
                  >
                    <input
                      type="radio"
                      name={`question-${currentQuestion.id}`}
                      value={opt.optionKey}
                      checked={isSelected}
                      onChange={() => handleAnswerChange(currentQuestion.id, opt.optionKey)}
                      style={{ accentColor: '#38bdf8', width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span style={{ fontWeight: 'bold', color: '#38bdf8', minWidth: '24px' }}>{opt.optionKey}.</span>
                    <span style={{ color: '#f8fafc', fontSize: '1rem' }}>{opt.optionText}</span>
                  </label>
                );
              })}
            </div>
          ) : (
            /* Output Prediction Input */
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#cbd5e1', marginBottom: '0.5rem' }}>
                Enter your predicted output:
              </label>
              <textarea
                value={answers[currentQuestion.id] || ''}
                onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                placeholder="Type exact predicted output here..."
                rows={4}
                style={{ width: '100%', padding: '0.875rem', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '0.5rem', color: '#f8fafc', fontFamily: 'monospace', fontSize: '1rem', outline: 'none' }}
              />
            </div>
          )}
        </div>
      )}

      {/* Prev / Next Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3rem' }}>
        <button
          disabled={currentIndex === 0}
          onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
          style={{ backgroundColor: '#334155', color: '#f8fafc', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', fontWeight: 600, cursor: currentIndex === 0 ? 'not-allowed' : 'pointer', opacity: currentIndex === 0 ? 0.5 : 1 }}
        >
          ← Previous
        </button>

        <button
          disabled={currentIndex === questions.length - 1}
          onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
          style={{ backgroundColor: '#0284c7', color: '#ffffff', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', fontWeight: 600, cursor: currentIndex === questions.length - 1 ? 'not-allowed' : 'pointer', opacity: currentIndex === questions.length - 1 ? 0.5 : 1 }}
        >
          Next →
        </button>
      </div>

      {/* Confirm Submission Modal */}
      {isConfirmSubmitOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 60 }}>
          <div style={{ width: '100%', maxWidth: '440px', backgroundColor: '#1e293b', borderRadius: '1rem', border: '1px solid #0284c7', padding: '2rem', color: '#f8fafc', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#38bdf8', marginBottom: '1rem' }}>
              Submit Round 1?
            </h3>
            <p style={{ color: '#cbd5e1', fontSize: '0.95rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              You have answered <strong>{answeredCount}</strong> of <strong>{questions.length}</strong> questions.
              {questions.length - answeredCount > 0 && (
                <span style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', border: '1px solid #f59e0b', color: '#f59e0b', padding: '0.4rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.85rem', display: 'block', marginTop: '0.75rem', fontWeight: 600 }}>
                  ⚠️ You still have {questions.length - answeredCount} unanswered questions.
                </span>
              )}
              <span style={{ color: '#fca5a5', fontSize: '0.85rem', display: 'block', marginTop: '0.5rem' }}>
                ⚠️ You will not be able to modify your answers after submitting.
              </span>
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
              <button
                onClick={() => setIsConfirmSubmitOpen(false)}
                style={{ backgroundColor: '#334155', color: '#f8fafc', border: 'none', padding: '0.625rem 1.25rem', borderRadius: '0.375rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleManualSubmit}
                disabled={submitting}
                style={{ backgroundColor: '#0284c7', color: '#ffffff', border: 'none', padding: '0.625rem 1.25rem', borderRadius: '0.375rem', fontWeight: 600, cursor: 'pointer' }}
              >
                {submitting ? 'Submitting...' : 'CONFIRM SUBMIT'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
