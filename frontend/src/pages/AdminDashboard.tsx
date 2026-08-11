import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../context/SocketContext';
import { adminApi, AdminRound, AdminRoundsResponse } from '../services/adminApi';
import { Round1QuestionManager } from '../components/Round1QuestionManager';
import { Round1AdminInspection } from '../components/Round1AdminInspection';
import { Round2ProblemManager } from '../components/Round2ProblemManager';
import { Round2AdminInspection } from '../components/Round2AdminInspection';
import { Round3ProblemManager } from '../components/Round3ProblemManager';
import { Round3AdminInspection } from '../components/Round3AdminInspection';
import { CompetitionLeaderboard } from '../components/CompetitionLeaderboard';
import { SecurityViolationsTab } from '../components/SecurityViolationsTab';
import { StudentManagementTab } from '../components/StudentManagementTab';

export const AdminDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const { isConnected, adminMetrics } = useSocket();

  const [data, setData] = useState<AdminRoundsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState<
    | 'ROUNDS'
    | 'STUDENTS'
    | 'ROUND1_QUESTIONS'
    | 'ROUND1_INSPECTION'
    | 'ROUND2_PROBLEMS'
    | 'ROUND2_INSPECTION'
    | 'ROUND3_PROBLEMS'
    | 'ROUND3_INSPECTION'
    | 'LEADERBOARD'
    | 'SECURITY'
  >('ROUNDS');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRound, setEditingRound] = useState<AdminRound | null>(null);
  const [restartingRound, setRestartingRound] = useState<AdminRound | null>(null);
  const [restartReason, setRestartReason] = useState<string>('');
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
  }>({ isOpen: false, title: '', message: '', onConfirm: async () => {} });

  // Form State
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<'MCQ' | 'OUTPUT_PREDICTION' | 'DEBUGGING' | 'PROGRAMMING'>('MCQ');
  const [formDescription, setFormDescription] = useState('');
  const [formDuration, setFormDuration] = useState<number>(20);
  const [formMarks, setFormMarks] = useState<number>(100);
  const [formEnabled, setFormEnabled] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchRounds = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminApi.getRounds();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load round controls');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRounds();
  }, []);

  const openCreateModal = () => {
    setFormName('');
    setFormType('MCQ');
    setFormDescription('');
    setFormDuration(20);
    setFormMarks(100);
    setFormEnabled(true);
    setIsCreateModalOpen(true);
  };

  const openEditModal = (round: AdminRound) => {
    setEditingRound(round);
    setFormName(round.name);
    setFormType(round.type);
    setFormDescription(round.description || '');
    setFormDuration(round.duration);
    setFormMarks(round.maximumMarks);
    setFormEnabled(round.isEnabled);
  };

  const handleCreateRound = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await adminApi.createRound({
        name: formName,
        type: formType,
        description: formDescription,
        duration: formDuration,
        maximumMarks: formMarks,
        isEnabled: formEnabled,
      });
      setIsCreateModalOpen(false);
      await fetchRounds();
    } catch (err: any) {
      alert(err.message || 'Failed to create round');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateRound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRound) return;
    try {
      setSubmitting(true);
      await adminApi.updateRound(editingRound.id, {
        name: formName,
        type: formType,
        description: formDescription,
        duration: formDuration,
        maximumMarks: formMarks,
        isEnabled: formEnabled,
      });
      setEditingRound(null);
      await fetchRounds();
    } catch (err: any) {
      alert(err.message || 'Failed to update round');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartRound = async (round: AdminRound) => {
    try {
      await adminApi.startRound(round.id);
      await fetchRounds();
    } catch (err: any) {
      alert(err.message || 'Failed to start round');
    }
  };

  const handlePauseRound = async (round: AdminRound) => {
    try {
      await adminApi.pauseRound(round.id);
      await fetchRounds();
    } catch (err: any) {
      alert(err.message || 'Failed to pause round');
    }
  };

  const handleResumeRound = async (round: AdminRound) => {
    try {
      await adminApi.resumeRound(round.id);
      await fetchRounds();
    } catch (err: any) {
      alert(err.message || 'Failed to resume round');
    }
  };

  const openRestartModal = (round: AdminRound) => {
    setRestartingRound(round);
    setRestartReason('');
  };

  const handleRestartSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restartingRound) return;
    try {
      setSubmitting(true);
      await adminApi.restartRound(restartingRound.id, restartReason);
      setRestartingRound(null);
      setRestartReason('');
      await fetchRounds();
    } catch (err: any) {
      alert(err.message || 'Failed to restart round');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEndRoundConfirm = (round: AdminRound) => {
    setConfirmDialog({
      isOpen: true,
      title: 'End Round Confirmation',
      message: `Are you sure you want to END ${round.name}? This will stop accepting further student work for this round.`,
      onConfirm: async () => {
        try {
          await adminApi.endRound(round.id);
          await fetchRounds();
        } catch (err: any) {
          alert(err.message || 'Failed to end round');
        }
      },
    });
  };

  const handleDeleteRoundConfirm = (round: AdminRound) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Round Confirmation',
      message: `Are you sure you want to DELETE ${round.name}? This operation cannot be undone.`,
      onConfirm: async () => {
        try {
          await adminApi.deleteRound(round.id);
          await fetchRounds();
        } catch (err: any) {
          alert(err.message || 'Failed to delete round');
        }
      },
    });
  };

  const handleToggleEnabled = async (round: AdminRound) => {
    const nextState = !round.isEnabled;
    if (!nextState && (round.status === 'LIVE' || round.status === 'PAUSED')) {
      alert('Cannot disable a LIVE or PAUSED round');
      return;
    }
    try {
      await adminApi.toggleRound(round.id, nextState);
      await fetchRounds();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle round status');
    }
  };

  const handleMove = async (index: number, direction: 'UP' | 'DOWN') => {
    if (!data) return;
    const rounds = [...data.rounds];
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= rounds.length) return;

    // Swap rounds
    const temp = rounds[index];
    rounds[index] = rounds[targetIndex];
    rounds[targetIndex] = temp;

    const reorderedIds = rounds.map((r) => r.id);
    try {
      await adminApi.reorderRounds(reorderedIds);
      await fetchRounds();
    } catch (err: any) {
      alert(err.message || 'Failed to reorder rounds');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'LIVE':
        return <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#10b981', border: '1px solid #10b981', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>LIVE</span>;
      case 'PAUSED':
        return <span style={{ backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', border: '1px solid #f59e0b', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>PAUSED</span>;
      case 'ENDED':
        return <span style={{ backgroundColor: 'rgba(100, 116, 139, 0.2)', color: '#94a3b8', border: '1px solid #64748b', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>ENDED</span>;
      default:
        return <span style={{ backgroundColor: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', border: '1px solid #38bdf8', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>DRAFT / READY</span>;
    }
  };

  const round1Obj = data?.rounds.find((r) => r.order === 1);
  const round2Obj = data?.rounds.find((r) => r.order === 2);
  const round3Obj = data?.rounds.find((r) => r.order === 3);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      {/* Top Navbar */}
      <header style={{ backgroundColor: '#1e293b', borderBottom: '1px solid #334155', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#a855f7', margin: 0 }}>
            Coding Challenge 2026
          </h1>
          <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Admin Control Dashboard</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Administrator</div>
            <div style={{ fontSize: '0.8rem', color: '#c084fc' }}>{user?.username || 'admin@it.com'}</div>
          </div>

          <button
            onClick={() => logout()}
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', border: '1px solid #ef4444', padding: '0.5rem 1rem', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: 500, fontSize: '0.875rem' }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ maxWidth: '1250px', margin: '2rem auto', padding: '0 1.5rem' }}>
        {error && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#fca5a5', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
            {error}
          </div>
        )}

        {/* Event Banner */}
        <div style={{ backgroundColor: '#1e293b', borderRadius: '1rem', border: '1px solid #334155', padding: '1.5rem 2rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: '0 0 0.5rem 0', color: '#f8fafc' }}>
              {data?.event.name || 'Coding Challenge 2026'}
            </h2>
            <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.875rem', color: '#94a3b8', alignItems: 'center' }}>
              <span>Event Status: <strong style={{ color: '#c084fc' }}>{data?.event.status || 'DRAFT'}</strong></span>
              <span>Rounds: <strong style={{ color: '#38bdf8' }}>{data?.rounds.length || 0}</strong></span>
              <span>Online Students: <strong style={{ color: '#22c55e' }}>{adminMetrics?.onlineCount ?? 0} / {adminMetrics?.totalStudents ?? 60}</strong></span>
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '9999px',
                  backgroundColor: isConnected ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: isConnected ? '#22c55e' : '#ef4444',
                  fontWeight: 600,
                }}
              >
                {isConnected ? '● REALTIME ACTIVE' : '○ DISCONNECTED'}
              </span>
            </div>
          </div>

          <button
            onClick={openCreateModal}
            style={{ backgroundColor: '#9333ea', color: '#ffffff', border: 'none', padding: '0.75rem 1.25rem', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}
          >
            + Add New Round
          </button>
        </div>

        {/* Navigation Tabs Bar */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1.5rem', borderBottom: '1px solid #334155', paddingBottom: '0.75rem' }}>
          <button
            onClick={() => setActiveTab('ROUNDS')}
            style={{
              backgroundColor: activeTab === 'ROUNDS' ? '#9333ea' : '#1e293b',
              color: activeTab === 'ROUNDS' ? '#ffffff' : '#94a3b8',
              border: activeTab === 'ROUNDS' ? 'none' : '1px solid #334155',
              padding: '0.5rem 0.85rem',
              borderRadius: '0.5rem',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            Rounds Control
          </button>

          <button
            onClick={() => setActiveTab('STUDENTS')}
            style={{
              backgroundColor: activeTab === 'STUDENTS' ? '#0284c7' : '#1e293b',
              color: activeTab === 'STUDENTS' ? '#ffffff' : '#94a3b8',
              border: activeTab === 'STUDENTS' ? 'none' : '1px solid #334155',
              padding: '0.5rem 0.85rem',
              borderRadius: '0.5rem',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            👥 Student Management
          </button>

          <button
            onClick={() => setActiveTab('ROUND1_QUESTIONS')}
            style={{
              backgroundColor: activeTab === 'ROUND1_QUESTIONS' ? '#9333ea' : '#1e293b',
              color: activeTab === 'ROUND1_QUESTIONS' ? '#ffffff' : '#94a3b8',
              border: activeTab === 'ROUND1_QUESTIONS' ? 'none' : '1px solid #334155',
              padding: '0.5rem 0.85rem',
              borderRadius: '0.5rem',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            R1 Questions
          </button>

          <button
            onClick={() => setActiveTab('ROUND1_INSPECTION')}
            style={{
              backgroundColor: activeTab === 'ROUND1_INSPECTION' ? '#9333ea' : '#1e293b',
              color: activeTab === 'ROUND1_INSPECTION' ? '#ffffff' : '#94a3b8',
              border: activeTab === 'ROUND1_INSPECTION' ? 'none' : '1px solid #334155',
              padding: '0.5rem 0.85rem',
              borderRadius: '0.5rem',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            R1 Scores
          </button>

          <button
            onClick={() => setActiveTab('ROUND2_PROBLEMS')}
            style={{
              backgroundColor: activeTab === 'ROUND2_PROBLEMS' ? '#0284c7' : '#1e293b',
              color: activeTab === 'ROUND2_PROBLEMS' ? '#ffffff' : '#94a3b8',
              border: activeTab === 'ROUND2_PROBLEMS' ? 'none' : '1px solid #334155',
              padding: '0.5rem 0.85rem',
              borderRadius: '0.5rem',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            R2 Bug Hunt Problems
          </button>

          <button
            onClick={() => setActiveTab('ROUND2_INSPECTION')}
            style={{
              backgroundColor: activeTab === 'ROUND2_INSPECTION' ? '#0284c7' : '#1e293b',
              color: activeTab === 'ROUND2_INSPECTION' ? '#ffffff' : '#94a3b8',
              border: activeTab === 'ROUND2_INSPECTION' ? 'none' : '1px solid #334155',
              padding: '0.5rem 0.85rem',
              borderRadius: '0.5rem',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            R2 Scores & Code
          </button>

          <button
            onClick={() => setActiveTab('ROUND3_PROBLEMS')}
            style={{
              backgroundColor: activeTab === 'ROUND3_PROBLEMS' ? '#c084fc' : '#1e293b',
              color: activeTab === 'ROUND3_PROBLEMS' ? '#ffffff' : '#94a3b8',
              border: activeTab === 'ROUND3_PROBLEMS' ? 'none' : '1px solid #334155',
              padding: '0.5rem 0.85rem',
              borderRadius: '0.5rem',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            R3 Programming Problems
          </button>

          <button
            onClick={() => setActiveTab('ROUND3_INSPECTION')}
            style={{
              backgroundColor: activeTab === 'ROUND3_INSPECTION' ? '#c084fc' : '#1e293b',
              color: activeTab === 'ROUND3_INSPECTION' ? '#ffffff' : '#94a3b8',
              border: activeTab === 'ROUND3_INSPECTION' ? 'none' : '1px solid #334155',
              padding: '0.5rem 0.85rem',
              borderRadius: '0.5rem',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            R3 Scores & Submissions
          </button>

          <button
            onClick={() => setActiveTab('LEADERBOARD')}
            style={{
              backgroundColor: activeTab === 'LEADERBOARD' ? '#22c55e' : '#1e293b',
              color: activeTab === 'LEADERBOARD' ? '#ffffff' : '#94a3b8',
              border: activeTab === 'LEADERBOARD' ? 'none' : '1px solid #334155',
              padding: '0.5rem 0.85rem',
              borderRadius: '0.5rem',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            🏆 Leaderboard & Results
          </button>

          <button
            onClick={() => setActiveTab('SECURITY')}
            style={{
              backgroundColor: activeTab === 'SECURITY' ? '#ef4444' : '#1e293b',
              color: activeTab === 'SECURITY' ? '#ffffff' : '#94a3b8',
              border: activeTab === 'SECURITY' ? 'none' : '1px solid #334155',
              padding: '0.5rem 0.85rem',
              borderRadius: '0.5rem',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            🛡️ Security & Violations
          </button>
        </div>

        {/* Tab 2: Round 1 Questions Manager */}
        {activeTab === 'ROUND1_QUESTIONS' && round1Obj && (
          <Round1QuestionManager roundId={round1Obj.id} />
        )}

        {/* Tab 3: Round 1 Student Scores & Inspection */}
        {activeTab === 'ROUND1_INSPECTION' && round1Obj && (
          <Round1AdminInspection roundId={round1Obj.id} />
        )}

        {/* Tab 4: Round 2 Problems Manager */}
        {activeTab === 'ROUND2_PROBLEMS' && round2Obj && (
          <Round2ProblemManager roundId={round2Obj.id} />
        )}

        {/* Tab 5: Round 2 Student Scores & Submissions Inspection */}
        {activeTab === 'ROUND2_INSPECTION' && round2Obj && (
          <Round2AdminInspection roundId={round2Obj.id} />
        )}

        {/* Tab 6: Round 3 Programming Problems Manager */}
        {activeTab === 'ROUND3_PROBLEMS' && round3Obj && (
          <Round3ProblemManager roundId={round3Obj.id} />
        )}

        {/* Tab 7: Round 3 Student Scores & Submissions Inspection */}
        {activeTab === 'ROUND3_INSPECTION' && round3Obj && (
          <Round3AdminInspection roundId={round3Obj.id} />
        )}

        {/* Tab 8: Final Leaderboard & Results Control */}
        {activeTab === 'LEADERBOARD' && (
          <CompetitionLeaderboard />
        )}

        {/* Tab 9: Security & Violation Dashboard */}
        {activeTab === 'SECURITY' && (
          <SecurityViolationsTab />
        )}

        {activeTab === 'STUDENTS' && (
          <StudentManagementTab />
        )}

        {/* Tab 1: Rounds Management Section */}
        {activeTab === 'ROUNDS' && (
        <div style={{ backgroundColor: '#1e293b', borderRadius: '1rem', border: '1px solid #334155', padding: '2rem' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#f8fafc' }}>
            Competition Rounds Control
          </h3>

          {loading ? (
            <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Loading rounds configuration...</p>
          ) : !data || data.rounds.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>No rounds configured yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {data.rounds.map((round, index) => (
                <div
                  key={round.id}
                  style={{
                    backgroundColor: '#0f172a',
                    borderRadius: '0.75rem',
                    border: '1px solid #334155',
                    padding: '1.25rem 1.5rem',
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr auto',
                    gap: '1.5rem',
                    alignItems: 'center',
                  }}
                >
                  {/* Order & Controls */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                    <button
                      disabled={index === 0}
                      onClick={() => handleMove(index, 'UP')}
                      style={{ background: 'none', border: 'none', color: index === 0 ? '#475569' : '#94a3b8', cursor: index === 0 ? 'default' : 'pointer', fontSize: '0.75rem' }}
                    >
                      ▲
                    </button>
                    <span style={{ fontWeight: 'bold', color: '#38bdf8', fontSize: '1.125rem' }}>#{round.order}</span>
                    <button
                      disabled={index === data.rounds.length - 1}
                      onClick={() => handleMove(index, 'DOWN')}
                      style={{ background: 'none', border: 'none', color: index === data.rounds.length - 1 ? '#475569' : '#94a3b8', cursor: index === data.rounds.length - 1 ? 'default' : 'pointer', fontSize: '0.75rem' }}
                    >
                      ▼
                    </button>
                  </div>

                  {/* Round Details */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.375rem' }}>
                      <h4 style={{ fontSize: '1.125rem', fontWeight: 'bold', margin: 0, color: '#f8fafc' }}>
                        {round.name}
                      </h4>
                      {getStatusBadge(round.status)}
                      <span style={{ backgroundColor: '#1e293b', color: '#cbd5e1', border: '1px solid #475569', padding: '0.25rem 0.5rem', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 500 }}>
                        {round.type}
                      </span>
                    </div>

                    <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: '#94a3b8' }}>
                      {round.description || 'No description provided.'}
                    </p>

                    <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8rem', color: '#cbd5e1' }}>
                      <span>Duration: <strong>{round.duration} mins</strong></span>
                      <span>Max Marks: <strong>{round.maximumMarks} pts</strong></span>
                      <span>Enabled: <strong style={{ color: round.isEnabled ? '#10b981' : '#ef4444' }}>{round.isEnabled ? 'Yes' : 'No'}</strong></span>
                    </div>
                  </div>

                  {/* Control Buttons */}
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {/* Start Button */}
                    {(round.status === 'DRAFT' || round.status === 'READY') && (
                      <button
                        onClick={() => handleStartRound(round)}
                        disabled={!round.isEnabled}
                        style={{ backgroundColor: round.isEnabled ? '#10b981' : '#475569', color: '#ffffff', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.375rem', fontWeight: 600, fontSize: '0.875rem', cursor: round.isEnabled ? 'pointer' : 'not-allowed' }}
                      >
                        Start
                      </button>
                    )}

                    {/* Pause Button */}
                    {round.status === 'LIVE' && (
                      <button
                        onClick={() => handlePauseRound(round)}
                        style={{ backgroundColor: '#f59e0b', color: '#ffffff', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.375rem', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}
                      >
                        Pause
                      </button>
                    )}

                    {/* Resume Button */}
                    {round.status === 'PAUSED' && (
                      <button
                        onClick={() => handleResumeRound(round)}
                        style={{ backgroundColor: '#10b981', color: '#ffffff', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.375rem', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}
                      >
                        Resume
                      </button>
                    )}

                    {/* End Button */}
                    {(round.status === 'LIVE' || round.status === 'PAUSED') && (
                      <button
                        onClick={() => handleEndRoundConfirm(round)}
                        style={{ backgroundColor: '#ef4444', color: '#ffffff', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.375rem', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}
                      >
                        End
                      </button>
                    )}

                    {/* Restart Round Button */}
                    {(round.status === 'LIVE' || round.status === 'PAUSED' || round.status === 'ENDED') && (
                      <button
                        onClick={() => openRestartModal(round)}
                        style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid #f59e0b', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}
                      >
                        Restart Round
                      </button>
                    )}

                    {/* Edit Button */}
                    <button
                      onClick={() => openEditModal(round)}
                      style={{ backgroundColor: '#334155', color: '#f8fafc', border: '1px solid #475569', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.875rem', cursor: 'pointer' }}
                    >
                      Edit
                    </button>

                    {/* Enable/Disable Toggle */}
                    <button
                      onClick={() => handleToggleEnabled(round)}
                      style={{ backgroundColor: '#334155', color: round.isEnabled ? '#fca5a5' : '#86efac', border: '1px solid #475569', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.875rem', cursor: 'pointer' }}
                    >
                      {round.isEnabled ? 'Disable' : 'Enable'}
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={() => handleDeleteRoundConfirm(round)}
                      style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', border: '1px solid #ef4444', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.875rem', cursor: 'pointer' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        )}
      </main>

      {/* Create / Edit Round Modal */}
      {(isCreateModalOpen || editingRound) && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 50 }}>
          <div style={{ width: '100%', maxWidth: '500px', backgroundColor: '#1e293b', borderRadius: '1rem', border: '1px solid #334155', padding: '2rem', color: '#f8fafc' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#38bdf8' }}>
              {editingRound ? 'Edit Round Configuration' : 'Create New Competition Round'}
            </h3>

            <form onSubmit={editingRound ? handleUpdateRound : handleCreateRound}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', color: '#cbd5e1', marginBottom: '0.375rem' }}>Round Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. ROUND 3 — Code Sprint"
                  required
                  style={{ width: '100%', padding: '0.625rem 0.875rem', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '0.375rem', color: '#f8fafc', outline: 'none' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', color: '#cbd5e1', marginBottom: '0.375rem' }}>Round Type</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as any)}
                  disabled={editingRound?.status === 'LIVE'}
                  style={{ width: '100%', padding: '0.625rem 0.875rem', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '0.375rem', color: '#f8fafc', outline: 'none' }}
                >
                  <option value="MCQ">MCQ (Multiple Choice Questions)</option>
                  <option value="OUTPUT_PREDICTION">OUTPUT_PREDICTION</option>
                  <option value="DEBUGGING">DEBUGGING (Bug Hunt)</option>
                  <option value="PROGRAMMING">PROGRAMMING (Code Sprint)</option>
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', color: '#cbd5e1', marginBottom: '0.375rem' }}>Description</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Brief summary of round objectives"
                  rows={3}
                  style={{ width: '100%', padding: '0.625rem 0.875rem', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '0.375rem', color: '#f8fafc', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: '#cbd5e1', marginBottom: '0.375rem' }}>Duration (Mins)</label>
                  <input
                    type="number"
                    value={formDuration}
                    onChange={(e) => setFormDuration(parseInt(e.target.value, 10) || 0)}
                    disabled={editingRound?.status === 'LIVE'}
                    min={1}
                    required
                    style={{ width: '100%', padding: '0.625rem 0.875rem', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '0.375rem', color: '#f8fafc', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: '#cbd5e1', marginBottom: '0.375rem' }}>Max Marks</label>
                  <input
                    type="number"
                    value={formMarks}
                    onChange={(e) => setFormMarks(parseInt(e.target.value, 10) || 0)}
                    min={1}
                    required
                    style={{ width: '100%', padding: '0.625rem 0.875rem', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '0.375rem', color: '#f8fafc', outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => { setIsCreateModalOpen(false); setEditingRound(null); }}
                  style={{ backgroundColor: '#334155', color: '#f8fafc', border: 'none', padding: '0.625rem 1.25rem', borderRadius: '0.375rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ backgroundColor: '#9333ea', color: '#ffffff', border: 'none', padding: '0.625rem 1.25rem', borderRadius: '0.375rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  {submitting ? 'Saving...' : 'Save Round'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Destructive Action Confirmation Dialog */}
      {confirmDialog.isOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 60 }}>
          <div style={{ width: '100%', maxWidth: '440px', backgroundColor: '#1e293b', borderRadius: '1rem', border: '1px solid #ef4444', padding: '2rem', color: '#f8fafc', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#ef4444', marginBottom: '1rem' }}>
              {confirmDialog.title}
            </h3>
            <p style={{ color: '#cbd5e1', fontSize: '0.95rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              {confirmDialog.message}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
              <button
                onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
                style={{ backgroundColor: '#334155', color: '#f8fafc', border: 'none', padding: '0.625rem 1.25rem', borderRadius: '0.375rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const fn = confirmDialog.onConfirm;
                  setConfirmDialog({ ...confirmDialog, isOpen: false });
                  await fn();
                }}
                style={{ backgroundColor: '#ef4444', color: '#ffffff', border: 'none', padding: '0.625rem 1.25rem', borderRadius: '0.375rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Confirm Action
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Restart Round Modal Dialog */}
      {restartingRound && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 60 }}>
          <div style={{ width: '100%', maxWidth: '480px', backgroundColor: '#1e293b', borderRadius: '1rem', border: '1px solid #f59e0b', padding: '2rem', color: '#f8fafc' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#f59e0b', marginBottom: '1rem' }}>
              Restart {restartingRound.name}?
            </h3>

            <div style={{ backgroundColor: '#0f172a', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #334155', marginBottom: '1.25rem', fontSize: '0.875rem', color: '#cbd5e1' }}>
              <div>Current Status: <strong style={{ color: '#f59e0b' }}>{restartingRound.status}</strong></div>
              {restartingRound.startTime && (
                <div>Current Start: <strong style={{ color: '#f8fafc' }}>{new Date(restartingRound.startTime).toLocaleTimeString()}</strong></div>
              )}
              {restartingRound.endTime && (
                <div>Current Deadline: <strong style={{ color: '#f8fafc' }}>{new Date(restartingRound.endTime).toLocaleTimeString()}</strong></div>
              )}
            </div>

            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#fca5a5', padding: '0.875rem 1rem', borderRadius: '0.5rem', fontSize: '0.875rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              ⚠️ <strong>Warning:</strong> Restarting this round will reset its active competition state and timing. Students currently participating in this round will be returned to the waiting state.
            </div>

            <form onSubmit={handleRestartSubmit}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', color: '#cbd5e1', marginBottom: '0.5rem' }}>
                  Reason for Restart (Optional)
                </label>
                <input
                  type="text"
                  value={restartReason}
                  onChange={(e) => setRestartReason(e.target.value)}
                  placeholder="e.g. Accidentally started round"
                  style={{ width: '100%', padding: '0.625rem 0.875rem', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '0.375rem', color: '#f8fafc', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setRestartingRound(null)}
                  style={{ backgroundColor: '#334155', color: '#f8fafc', border: 'none', padding: '0.625rem 1.25rem', borderRadius: '0.375rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ backgroundColor: '#f59e0b', color: '#ffffff', border: 'none', padding: '0.625rem 1.25rem', borderRadius: '0.375rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  {submitting ? 'Restarting...' : 'RESTART ROUND'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
