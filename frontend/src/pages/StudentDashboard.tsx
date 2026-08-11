import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../context/SocketContext';
import { Round1QuizView } from '../components/Round1QuizView';
import { Round2CodeEditor } from '../components/Round2CodeEditor';
import { Round3CodeEditor } from '../components/Round3CodeEditor';
import { NetworkStatusBanner } from '../components/NetworkStatusBanner';
import { CompetitionTimerHeader } from '../components/CompetitionTimerHeader';
import { apiFetch } from '../services/api';
import { competitionApi, StudentResultsResponse } from '../services/competitionApi';
import { violationApi, ViolationStatusResponse } from '../services/violationApi';
import { useAntiCheating } from '../hooks/useAntiCheating';

export interface StudentRoundInfo {
  id: string;
  name: string;
  type: string;
  status: 'DRAFT' | 'READY' | 'LIVE' | 'PAUSED' | 'ENDED';
  order: number;
  duration: number;
  isEnabled: boolean;
  startTime?: string | null;
  endTime?: string | null;
}

export const StudentDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const { isConnected, roundState: socketRoundState } = useSocket();
  const [rounds, setRounds] = useState<StudentRoundInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [resultsData, setResultsData] = useState<StudentResultsResponse | null>(null);
  const [fullscreenWarning, setFullscreenWarning] = useState<boolean>(false);
  const [violationState, setViolationState] = useState<ViolationStatusResponse>({
    violationCount: 0,
    maximumAllowed: 3,
    isLocked: false,
  });

  // Invigilator password modal state
  const [invigilatorPassword, setInvigilatorPassword] = useState<string>('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState<boolean>(false);

  const fetchRounds = async () => {
    try {
      const res = await apiFetch('/api/rounds/current');
      if (res.data && Array.isArray(res.data.rounds)) {
        setRounds(res.data.rounds);
      }
    } catch (err) {
      console.error('Failed to fetch current rounds status:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchViolationState = async () => {
    try {
      const status = await violationApi.getViolationStatus();
      setViolationState(status);
    } catch (err) {
      console.error('Failed to fetch violation status:', err);
    }
  };

  const fetchStudentResultsIfPublished = async () => {
    try {
      const res = await competitionApi.getStudentResults();
      setResultsData(res);
    } catch (err) {
      setResultsData(null);
    }
  };

  // Initial fetch and REST fallback interval
  useEffect(() => {
    fetchRounds();
    fetchViolationState();
    const interval = setInterval(() => {
      fetchRounds();
      fetchViolationState();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // React immediately to Socket.IO real-time round state syncs
  useEffect(() => {
    if (socketRoundState) {
      fetchRounds();
      fetchViolationState();
    }
  }, [socketRoundState]);

  const liveRound = rounds.find((r) => r.status === 'LIVE' && r.isEnabled);
  const isRoundLive = !!liveRound && !violationState.isLocked;

  // Anti-cheating monitoring active strictly during LIVE rounds
  useAntiCheating(isRoundLive, (updateData) => {
    if (updateData) {
      setViolationState((prev) => ({
        ...prev,
        violationCount: updateData.violationCount ?? prev.violationCount,
        isLocked: updateData.isLocked ?? prev.isLocked,
        maximumAllowed: updateData.maximumAllowed ?? prev.maximumAllowed,
      }));
    }
  });

  // Request Fullscreen ONLY when a round becomes LIVE
  useEffect(() => {
    if (liveRound && !violationState.isLocked) {
      if (!document.fullscreenElement) {
        document.documentElement
          .requestFullscreen()
          .then(() => setFullscreenWarning(false))
          .catch(() => setFullscreenWarning(true));
      }
    } else {
      setFullscreenWarning(false);
    }
  }, [liveRound?.id, liveRound?.status, violationState.isLocked]);

  // Check results if all enabled rounds ended
  const allEnabledRoundsEnded =
    rounds.length > 0 && rounds.filter((r) => r.isEnabled).every((r) => r.status === 'ENDED');

  useEffect(() => {
    if (allEnabledRoundsEnded) {
      fetchStudentResultsIfPublished();
    }
  }, [allEnabledRoundsEnded]);

  const handleInvigilatorUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invigilatorPassword) return;

    try {
      setUnlocking(true);
      setUnlockError(null);
      await violationApi.invigilatorUnlock(invigilatorPassword);
      setInvigilatorPassword('');
      await fetchViolationState();
      await fetchRounds();
    } catch (err: any) {
      setUnlockError(err.message || 'Invalid invigilator continuation password');
    } finally {
      setUnlocking(false);
    }
  };

  const activeLiveOrPausedRound = rounds.find((r) => r.isEnabled && (r.status === 'LIVE' || r.status === 'PAUSED'));
  const round1 = rounds.find((r) => r.order === 1);
  const round2 = rounds.find((r) => r.order === 2);
  const round3 = rounds.find((r) => r.order === 3);

  const isWideLayout =
    activeLiveOrPausedRound?.type === 'DEBUGGING' ||
    activeLiveOrPausedRound?.type === 'PROGRAMMING' ||
    round2?.status === 'LIVE' ||
    round2?.status === 'PAUSED' ||
    round3?.status === 'LIVE' ||
    round3?.status === 'PAUSED';

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      <NetworkStatusBanner />
      {/* Top Navbar */}
      <header style={{ backgroundColor: '#1e293b', borderBottom: '1px solid #334155', padding: '0.75rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#38bdf8', margin: 0 }}>
            Coding Challenge 2026
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Student Portal</span>
            <span
              style={{
                fontSize: '0.7rem',
                padding: '0.1rem 0.4rem',
                borderRadius: '9999px',
                backgroundColor: isConnected ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: isConnected ? '#22c55e' : '#ef4444',
                fontWeight: 600,
              }}
            >
              {isConnected ? '● REALTIME SYNC' : '○ RECONNECTING'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          {/* Violation warning pill during active competition */}
          {liveRound && (
            <div
              style={{
                backgroundColor: violationState.violationCount > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.15)',
                color: violationState.violationCount > 0 ? '#ef4444' : '#22c55e',
                border: `1px solid ${violationState.violationCount > 0 ? '#ef4444' : '#22c55e'}`,
                padding: '0.3rem 0.75rem',
                borderRadius: '9999px',
                fontSize: '0.8rem',
                fontWeight: 600,
              }}
            >
              Violations: {violationState.violationCount} / {violationState.maximumAllowed}
            </div>
          )}

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{user?.name || 'Student'}</div>
            <div style={{ fontSize: '0.8rem', color: '#38bdf8' }}>{user?.studentId} • Batch {user?.batch}</div>
          </div>

          <button
            onClick={() => logout()}
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', border: '1px solid #ef4444', padding: '0.4rem 0.9rem', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: 500, fontSize: '0.85rem' }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Fullscreen Warning if rejected */}
      {fullscreenWarning && !violationState.isLocked && (
        <div style={{ backgroundColor: '#f59e0b', color: '#0f172a', padding: '0.75rem', textAlign: 'center', fontWeight: 'bold', fontSize: '0.9rem' }}>
          ⚠️ Competition is LIVE. Please click anywhere or press F11 to enter Fullscreen mode for exam compliance.
        </div>
      )}

      {/* COMPETITION LOCKED OVERLAY */}
      {violationState.isLocked ? (
        <div style={{ maxWidth: '600px', margin: '4rem auto', padding: '0 1.5rem' }}>
          <div style={{ backgroundColor: '#1e293b', borderRadius: '1rem', border: '2px solid #ef4444', padding: '3rem', textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(239, 68, 68, 0.2)' }}>
            <div style={{ display: 'inline-block', padding: '0.5rem 1.25rem', borderRadius: '9999px', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '1.5rem', border: '1px solid #ef4444' }}>
              🔒 COMPETITION INTERFACE LOCKED
            </div>

            <h2 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#f8fafc', marginBottom: '1rem' }}>
              Maximum Allowed Violations Reached
            </h2>

            <p style={{ color: '#cbd5e1', fontSize: '1rem', lineHeight: 1.6, marginBottom: '2rem' }}>
              Your competition session has been locked because the anti-cheating system detected {violationState.violationCount} security violations (maximum allowed: {violationState.maximumAllowed}).
              <br />
              <strong style={{ color: '#fca5a5' }}>Please contact an invigilator to authorize continuation.</strong>
            </p>

            {/* Invigilator Password Form */}
            <form onSubmit={handleInvigilatorUnlock} style={{ backgroundColor: '#0f172a', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid #334155', textAlign: 'left' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.5rem' }}>
                INVIGILATOR CONTINUATION PASSWORD
              </label>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <input
                  type="password"
                  value={invigilatorPassword}
                  onChange={(e) => setInvigilatorPassword(e.target.value)}
                  placeholder="Enter invigilator password..."
                  required
                  style={{ flex: 1, padding: '0.6rem 0.9rem', borderRadius: '0.375rem', backgroundColor: '#1e293b', border: '1px solid #475569', color: '#f8fafc', fontSize: '0.9rem' }}
                />
                <button
                  type="submit"
                  disabled={unlocking}
                  style={{ backgroundColor: '#16a34a', color: '#ffffff', border: 'none', padding: '0.6rem 1.25rem', borderRadius: '0.375rem', fontWeight: 600, cursor: unlocking ? 'not-allowed' : 'pointer', fontSize: '0.9rem' }}
                >
                  {unlocking ? 'Verifying...' : 'Unlock Session'}
                </button>
              </div>

              {unlockError && (
                <div style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '0.75rem', fontWeight: 500 }}>
                  ⚠️ {unlockError}
                </div>
              )}
            </form>
          </div>
        </div>
      ) : (
        /* Main Workspace Area */
        <main style={{ maxWidth: isWideLayout ? '1200px' : '850px', margin: '1.5rem auto', padding: '0 1.5rem' }}>
          {/* ACTIVE ROUND INTERFACE BY TYPE */}
          {activeLiveOrPausedRound && activeLiveOrPausedRound.type === 'MCQ' && activeLiveOrPausedRound.status === 'LIVE' ? (
            <Round1QuizView roundId={activeLiveOrPausedRound.id} onSubmitted={fetchRounds} />
          ) : activeLiveOrPausedRound && activeLiveOrPausedRound.type === 'MCQ' && activeLiveOrPausedRound.status === 'PAUSED' ? (
            <div style={{ backgroundColor: '#1e293b', borderRadius: '1rem', border: '1px solid #f59e0b', padding: '3rem', textAlign: 'center', marginTop: '2rem' }}>
              <div style={{ display: 'inline-block', padding: '0.5rem 1.25rem', borderRadius: '9999px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', fontWeight: 600, fontSize: '0.875rem', marginBottom: '1.5rem', border: '1px solid #f59e0b' }}>
                ROUND 1 PAUSED BY ADMIN
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f59e0b', marginBottom: '1rem' }}>
                Quiz is Currently Paused
              </h2>
              <p style={{ color: '#cbd5e1', fontSize: '1rem', maxWidth: '500px', margin: '0 auto' }}>
                Answer modifications are temporarily disabled. The quiz will resume automatically when the admin resumes the round.
              </p>
            </div>
          ) : activeLiveOrPausedRound && activeLiveOrPausedRound.type === 'DEBUGGING' ? (
            <Round2CodeEditor roundId={activeLiveOrPausedRound.id} isPaused={activeLiveOrPausedRound.status === 'PAUSED'} onRefreshRoundState={fetchRounds} />
          ) : activeLiveOrPausedRound && activeLiveOrPausedRound.type === 'PROGRAMMING' ? (
            <Round3CodeEditor roundId={activeLiveOrPausedRound.id} isPaused={activeLiveOrPausedRound.status === 'PAUSED'} onRefreshRoundState={fetchRounds} />
          ) : (
            /* WAITING / STANDBY / COMPLETED DASHBOARD */
            <div>
              <div style={{ backgroundColor: '#1e293b', borderRadius: '1rem', border: '1px solid #334155', padding: '2rem', marginBottom: '2rem', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#f8fafc' }}>
                  Welcome, {user?.name || 'Student'}
                </h2>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', backgroundColor: '#0f172a', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #334155' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Student ID</span>
                    <span style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#38bdf8' }}>{user?.studentId}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Batch Number</span>
                    <span style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#f8fafc' }}>{user?.batch}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Account Role</span>
                    <span style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#10b981' }}>{user?.role}</span>
                  </div>
                </div>
              </div>

              <div style={{ backgroundColor: '#1e293b', borderRadius: '1rem', border: '1px solid #0284c7', padding: '2.5rem', textAlign: 'center', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)' }}>
                <div style={{ display: 'inline-block', padding: '0.5rem 1.25rem', borderRadius: '9999px', backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontWeight: 600, fontSize: '0.875rem', marginBottom: '1.5rem', border: '1px solid #38bdf8' }}>
                  {allEnabledRoundsEnded ? 'STATUS: COMPETITION COMPLETED' : 'STATUS: COMPETITION STANDBY'}
                </div>

                <h3 style={{ fontSize: '1.375rem', fontWeight: 'bold', marginBottom: '0.75rem', color: '#f8fafc' }}>
                  {allEnabledRoundsEnded
                    ? 'All Competition Rounds Completed 🎉'
                    : round2?.status === 'ENDED'
                    ? 'Round 2 Completed — Ready for Round 3'
                    : round1?.status === 'ENDED'
                    ? 'Round 1 Completed — Ready for Round 2'
                    : 'Waiting for Admin to Start Round'}
                </h3>

                <p style={{ color: '#94a3b8', fontSize: '1rem', maxWidth: '550px', margin: '0 auto 1.5rem auto', lineHeight: 1.6 }}>
                  {allEnabledRoundsEnded
                    ? 'Thank you for participating! The competition has concluded. Official results will be displayed below once published by the administrator.'
                    : 'Waiting for the administrator to start the round. Please keep this browser window open.'}
                </p>

                {/* PUBLISHED RESULTS SECTION */}
                {allEnabledRoundsEnded && resultsData?.showResults && resultsData.myResult && (
                  <div style={{ backgroundColor: '#0f172a', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid #10b981', marginTop: '1.5rem', textAlign: 'left' }}>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#10b981', marginBottom: '1rem' }}>
                      🏆 Official Competition Scorecard & Rank
                    </h4>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Final Rank</span>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f59e0b' }}>#{resultsData.myResult.rank}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Total Score</span>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#38bdf8' }}>{resultsData.myResult.totalScore} pts</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Round 1</span>
                        <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc' }}>{resultsData.myResult.round1Score} pts</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Round 2</span>
                        <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc' }}>{resultsData.myResult.round2Score} pts</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Round 3</span>
                        <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc' }}>{resultsData.myResult.round3Score} pts</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ROUND PROGRESSION LIST */}
                <div style={{ backgroundColor: '#0f172a', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #334155', display: 'inline-flex', gap: '2rem', fontSize: '0.875rem', marginTop: '1.5rem' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Round 1: </span>
                    <span style={{ fontWeight: 600, color: round1?.status === 'ENDED' ? '#94a3b8' : '#38bdf8' }}>
                      {round1?.status || 'DRAFT'}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Round 2: </span>
                    <span style={{ fontWeight: 600, color: round2?.status === 'ENDED' ? '#94a3b8' : '#38bdf8' }}>
                      {round2?.status || 'DRAFT'}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Round 3: </span>
                    <span style={{ fontWeight: 600, color: round3?.status === 'ENDED' ? '#94a3b8' : '#38bdf8' }}>
                      {round3?.status || 'DRAFT'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      )}
    </div>
  );
};
