import React, { useState, useEffect } from 'react';
import { round1Api, AdminQuestion } from '../services/round1Api';

interface Round1QuestionManagerProps {
  roundId: string;
}

export const Round1QuestionManager: React.FC<Round1QuestionManagerProps> = ({ roundId }) => {
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Create / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingQuestion, setEditingQuestion] = useState<AdminQuestion | null>(null);

  const [questionText, setQuestionText] = useState<string>('');
  const [questionType, setQuestionType] = useState<'MCQ' | 'OUTPUT_PREDICTION'>('MCQ');
  const [marks, setMarks] = useState<number>(2);
  const [negativeMarks, setNegativeMarks] = useState<number>(0);
  const [code, setCode] = useState<string>('');
  const [correctOutput, setCorrectOutput] = useState<string>('');
  const [comparisonMethod, setComparisonMethod] = useState<'EXACT' | 'TRIM' | 'EXACT_IGNORE_CASE'>('TRIM');

  // MCQ Options
  const [options, setOptions] = useState<{ optionKey: string; optionText: string }[]>([
    { optionKey: 'A', optionText: '' },
    { optionKey: 'B', optionText: '' },
    { optionKey: 'C', optionText: '' },
    { optionKey: 'D', optionText: '' },
  ]);
  const [correctAnswer, setCorrectAnswer] = useState<string>('A');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await round1Api.getAdminQuestions(roundId);
      setQuestions(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, [roundId]);

  const openCreateModal = () => {
    setEditingQuestion(null);
    setQuestionText('');
    setQuestionType('MCQ');
    setMarks(2);
    setNegativeMarks(0);
    setCode('');
    setCorrectOutput('');
    setComparisonMethod('TRIM');
    setOptions([
      { optionKey: 'A', optionText: '' },
      { optionKey: 'B', optionText: '' },
      { optionKey: 'C', optionText: '' },
      { optionKey: 'D', optionText: '' },
    ]);
    setCorrectAnswer('A');
    setIsModalOpen(true);
  };

  const openEditModal = (q: AdminQuestion) => {
    setEditingQuestion(q);
    setQuestionText(q.questionText);
    setQuestionType(q.questionType === 'OUTPUT_PREDICTION' ? 'OUTPUT_PREDICTION' : 'MCQ');
    setMarks(q.marks);
    setNegativeMarks(q.negativeMarks);
    setCode(q.code || '');
    setCorrectOutput(q.correctOutput || '');
    setComparisonMethod((q.comparisonMethod as any) || 'TRIM');
    if (q.options && q.options.length > 0) {
      setOptions(q.options.map((o) => ({ optionKey: o.optionKey, optionText: o.optionText })));
    } else {
      setOptions([
        { optionKey: 'A', optionText: '' },
        { optionKey: 'B', optionText: '' },
      ]);
    }
    setCorrectAnswer(q.correctAnswer || 'A');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      if (editingQuestion) {
        await round1Api.updateQuestion(editingQuestion.id, {
          questionText,
          questionType,
          marks,
          negativeMarks,
          code: code || undefined,
          correctOutput: correctOutput || undefined,
          comparisonMethod,
          correctAnswer,
          options: questionType === 'MCQ' ? options.map((o, idx) => ({ ...o, order: idx + 1 })) : undefined,
        });
      } else {
        await round1Api.createQuestion(roundId, {
          questionText,
          questionType,
          marks,
          negativeMarks,
          code: code || undefined,
          correctOutput: correctOutput || undefined,
          comparisonMethod,
          correctAnswer,
          options: questionType === 'MCQ' ? options.map((o, idx) => ({ ...o, order: idx + 1 })) : undefined,
        });
      }
      setIsModalOpen(false);
      await fetchQuestions();
    } catch (err: any) {
      alert(err.message || 'Failed to save question');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (q: AdminQuestion) => {
    if (!window.confirm(`Delete or deactivate question ${q.order}?`)) return;
    try {
      await round1Api.deleteQuestion(q.id);
      await fetchQuestions();
    } catch (err: any) {
      alert(err.message || 'Failed to delete question');
    }
  };

  const handleToggle = async (q: AdminQuestion) => {
    try {
      await round1Api.toggleQuestion(q.id, !q.isActive);
      await fetchQuestions();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle question');
    }
  };

  const handleMove = async (index: number, direction: 'UP' | 'DOWN') => {
    const targetIdx = direction === 'UP' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= questions.length) return;

    const reordered = [...questions];
    const temp = reordered[index];
    reordered[index] = reordered[targetIdx];
    reordered[targetIdx] = temp;

    const orderedIds = reordered.map((q) => q.id);
    try {
      const updated = await round1Api.reorderQuestions(roundId, orderedIds);
      setQuestions(updated);
    } catch (err: any) {
      alert(err.message || 'Failed to reorder questions');
    }
  };

  return (
    <div style={{ backgroundColor: '#1e293b', borderRadius: '1rem', border: '1px solid #334155', padding: '1.5rem', color: '#f8fafc' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0, color: '#a855f7' }}>
            Round 1 Question Management
          </h3>
          <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            Total Questions Configured: <strong>{questions.length}</strong>
          </span>
        </div>

        <button
          onClick={openCreateModal}
          style={{ backgroundColor: '#9333ea', color: '#ffffff', border: 'none', padding: '0.625rem 1.25rem', borderRadius: '0.375rem', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}
        >
          + Add Question
        </button>
      </div>

      {error && (
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#fca5a5', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: '#94a3b8' }}>Loading Round 1 questions...</p>
      ) : questions.length === 0 ? (
        <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>No questions configured for Round 1 yet. Click "+ Add Question" to begin.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {questions.map((q, idx) => (
            <div key={q.id} style={{ backgroundColor: '#0f172a', borderRadius: '0.5rem', border: '1px solid #334155', padding: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              {/* Order Controls */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <button
                  disabled={idx === 0}
                  onClick={() => handleMove(idx, 'UP')}
                  style={{ background: 'none', border: 'none', color: idx === 0 ? '#475569' : '#94a3b8', cursor: idx === 0 ? 'default' : 'pointer' }}
                >
                  ▲
                </button>
                <span style={{ fontWeight: 'bold', fontSize: '1rem', color: '#38bdf8', margin: '0.25rem 0' }}>#{q.order}</span>
                <button
                  disabled={idx === questions.length - 1}
                  onClick={() => handleMove(idx, 'DOWN')}
                  style={{ background: 'none', border: 'none', color: idx === questions.length - 1 ? '#475569' : '#94a3b8', cursor: idx === questions.length - 1 ? 'default' : 'pointer' }}
                >
                  ▼
                </button>
              </div>

              {/* Content */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <span style={{ backgroundColor: q.questionType === 'MCQ' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(168, 85, 247, 0.2)', color: q.questionType === 'MCQ' ? '#38bdf8' : '#c084fc', border: `1px solid ${q.questionType === 'MCQ' ? '#38bdf8' : '#c084fc'}`, padding: '0.2rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: 600 }}>
                    {q.questionType}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>+{q.marks} pts</span>
                  {q.negativeMarks > 0 && <span style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 600 }}>(-{q.negativeMarks})</span>}
                  <span style={{ fontSize: '0.75rem', color: q.isActive ? '#10b981' : '#64748b', marginLeft: 'auto' }}>
                    {q.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600, color: '#f8fafc', fontSize: '1rem' }}>
                  {q.questionText}
                </p>

                {q.code && (
                  <pre style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '0.375rem', padding: '0.75rem', color: '#38bdf8', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                    <code>{q.code}</code>
                  </pre>
                )}

                {q.questionType === 'MCQ' ? (
                  <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                    Correct Answer: <strong style={{ color: '#10b981' }}>{q.correctAnswer}</strong> | Options: {q.options.map((o) => `${o.optionKey}: ${o.optionText}`).join(' | ')}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                    Expected Output: <strong style={{ color: '#10b981' }}>"{q.correctOutput}"</strong> ({q.comparisonMethod})
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => openEditModal(q)} style={{ backgroundColor: '#334155', color: '#f8fafc', border: '1px solid #475569', padding: '0.375rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                  Edit
                </button>
                <button onClick={() => handleToggle(q)} style={{ backgroundColor: '#334155', color: q.isActive ? '#fca5a5' : '#86efac', border: '1px solid #475569', padding: '0.375rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                  {q.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button onClick={() => handleDelete(q)} style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', border: '1px solid #ef4444', padding: '0.375rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Question Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 60 }}>
          <div style={{ width: '100%', maxWidth: '640px', backgroundColor: '#1e293b', borderRadius: '1rem', border: '1px solid #475569', padding: '2rem', color: '#f8fafc', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#a855f7', marginBottom: '1.5rem' }}>
              {editingQuestion ? 'Edit Question' : 'Add New Round 1 Question'}
            </h3>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.25rem' }}>Question Type</label>
                  <select
                    value={questionType}
                    onChange={(e) => setQuestionType(e.target.value as any)}
                    style={{ width: '100%', padding: '0.5rem', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '0.375rem', color: '#f8fafc' }}
                  >
                    <option value="MCQ">Multiple Choice (MCQ)</option>
                    <option value="OUTPUT_PREDICTION">Output Prediction</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.25rem' }}>Marks (+)</label>
                  <input
                    type="number"
                    value={marks}
                    onChange={(e) => setMarks(Number(e.target.value))}
                    min={1}
                    required
                    style={{ width: '100%', padding: '0.5rem', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '0.375rem', color: '#f8fafc' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.25rem' }}>Negative Marks (-)</label>
                <input
                  type="number"
                  value={negativeMarks}
                  onChange={(e) => setNegativeMarks(Number(e.target.value))}
                  min={0}
                  step={0.5}
                  style={{ width: '100%', padding: '0.5rem', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '0.375rem', color: '#f8fafc' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.25rem' }}>Question Text</label>
                <textarea
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  required
                  rows={3}
                  style={{ width: '100%', padding: '0.5rem', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '0.375rem', color: '#f8fafc' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.25rem' }}>Code Snippet (Optional)</label>
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  rows={4}
                  placeholder="#include <stdio.h>..."
                  style={{ width: '100%', padding: '0.5rem', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '0.375rem', color: '#38bdf8', fontFamily: 'monospace' }}
                />
              </div>

              {/* MCQ Options Config */}
              {questionType === 'MCQ' ? (
                <div style={{ marginBottom: '1.5rem', backgroundColor: '#0f172a', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 'bold', color: '#38bdf8', marginBottom: '0.75rem' }}>
                    MCQ Options & Select Correct Answer:
                  </label>
                  {options.map((opt, idx) => (
                    <div key={opt.optionKey} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                      <input
                        type="radio"
                        name="correctAnswerSelect"
                        value={opt.optionKey}
                        checked={correctAnswer === opt.optionKey}
                        onChange={() => setCorrectAnswer(opt.optionKey)}
                        style={{ accentColor: '#10b981' }}
                      />
                      <span style={{ fontWeight: 'bold', color: '#38bdf8', minWidth: '20px' }}>{opt.optionKey}.</span>
                      <input
                        type="text"
                        value={opt.optionText}
                        onChange={(e) => {
                          const updated = [...options];
                          updated[idx].optionText = e.target.value;
                          setOptions(updated);
                        }}
                        placeholder={`Option ${opt.optionKey} text`}
                        required
                        style={{ flex: 1, padding: '0.5rem', backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '0.25rem', color: '#f8fafc' }}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                /* Output Prediction Config */
                <div style={{ marginBottom: '1.5rem', backgroundColor: '#0f172a', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.25rem' }}>Expected Correct Output</label>
                    <textarea
                      value={correctOutput}
                      onChange={(e) => setCorrectOutput(e.target.value)}
                      required
                      rows={2}
                      placeholder="e.g. 15"
                      style={{ width: '100%', padding: '0.5rem', backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '0.25rem', color: '#10b981', fontFamily: 'monospace' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.25rem' }}>Comparison Method</label>
                    <select
                      value={comparisonMethod}
                      onChange={(e) => setComparisonMethod(e.target.value as any)}
                      style={{ width: '100%', padding: '0.5rem', backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '0.25rem', color: '#f8fafc' }}
                    >
                      <option value="TRIM">TRIM (Trim whitespace before compare)</option>
                      <option value="EXACT">EXACT (Exact character match)</option>
                      <option value="EXACT_IGNORE_CASE">EXACT_IGNORE_CASE (Case insensitive)</option>
                    </select>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{ backgroundColor: '#334155', color: '#f8fafc', border: 'none', padding: '0.625rem 1.25rem', borderRadius: '0.375rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ backgroundColor: '#9333ea', color: '#ffffff', border: 'none', padding: '0.625rem 1.25rem', borderRadius: '0.375rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  {submitting ? 'Saving...' : 'Save Question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
