import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import VotingPhase from './VotingPhase';
import QuestPhase from './QuestPhase';
import QuestReveal from './QuestReveal';
import Assassination from './Assassination';
import GameOver from './GameOver';
import VoteHistory from './VoteHistory';
import './GameBoard.css';

const ROLE_ICONS = {
    merlin: '🧥', percival: '🛡️', loyalServant: '⚜️',
    assassin: '🗡️', morgana: '🎭', mordred: '👑', oberon: '👤', minion: '💀',
};

const PHASE_RULES = {
    TEAM_PROPOSAL: {
        title: '👑 Team Proposal',
        rule: 'The leader selects players for this quest. Discuss openly — but remember, Evil players may try to get on the team!',
    },
    VOTING: {
        title: '🗳️ Vote',
        rule: 'All players vote to approve or reject. Majority rules — ties reject. The leader\'s vote automatically counts as Approve. If 5 proposals in a row are rejected, Evil wins!',
    },
    QUEST: {
        title: '⚔ Quest',
        rule: 'Team members secretly play Success or Fail. Good MUST play Success. Evil can choose either. Just 1 Fail card fails the quest (2 needed on Quest 4 with 7+ players).',
    },
    ASSASSINATION: {
        title: '🗡️ Assassination',
        rule: 'Good passed 3 quests! But the Assassin gets one shot to identify Merlin. If correct, Evil steals the win!',
    },
};

export default function GameBoard() {
    const {
        phase, players, playerId, currentLeader, currentQuestIndex,
        rejectionTrack, maxRejections, questResults, proposedTeam,
        questTeamSizes, roleInfo, isLeader, isHost, proposeTeam, endGame,
        showingResult, voteResult, questResult,
        winner, fullReveal, voteHistory, leaveRoom,
    } = useGame();

    const [selectedTeam, setSelectedTeam] = useState([]);
    const [showVoteHistory, setShowVoteHistory] = useState(false);
    const [showRoleCard, setShowRoleCard] = useState(false);
    const [showEndConfirm, setShowEndConfirm] = useState(false);
    const [resultTimer, setResultTimer] = useState(0);

    const isGood = roleInfo?.team === 'good';
    const requiredTeamSize = questTeamSizes?.[currentQuestIndex] || 0;

    // Reset selected team when phase changes or leader changes
    useEffect(() => {
        setSelectedTeam([]);
    }, [phase, currentLeader?.id]);

    // Auto-dismiss countdown for result overlays
    useEffect(() => {
        if (showingResult) {
            const total = showingResult === 'vote' ? 4 : 5;
            setResultTimer(total);
            const interval = setInterval(() => {
                setResultTimer(prev => {
                    if (prev <= 1) {
                        clearInterval(interval);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [showingResult]);

    // Compute quest progress
    const goodWins = questResults.filter(q => q && q.passed).length;
    const evilWins = questResults.filter(q => q && !q.passed).length;
    const goodNeed = 3 - goodWins;
    const evilNeed = 3 - evilWins;

    const toggleTeamMember = (id) => {
        setSelectedTeam(prev => {
            if (prev.includes(id)) return prev.filter(x => x !== id);
            if (prev.length >= requiredTeamSize) return prev;
            return [...prev, id];
        });
    };

    const handlePropose = () => {
        proposeTeam(selectedTeam, (res) => {
            if (res?.error) alert(res.error);
            else setSelectedTeam([]);
        });
    };

    const handleEndGame = () => {
        endGame((res) => {
            if (res?.error) alert(res.error);
            setShowEndConfirm(false);
        });
    };

    // ─── Auto-advancing Result Overlays (no Continue button) ─────
    if (showingResult === 'vote' && voteResult) {
        return (
            <div className="page-center">
                <div className="app-background" />
                <div className="glass-card result-card animate-fade-in-scale">
                    <h2 className="heading-display result-title">
                        {voteResult.approved ? '✅ Team Approved' : '❌ Team Rejected'}
                    </h2>
                    <div className="result-votes">
                        {players.map(p => {
                            const v = voteResult.votes[p.id];
                            return (
                                <div key={p.id} className={`result-vote-chip ${v === 'approve' ? 'result-vote-approve' : 'result-vote-reject'}`}>
                                    <span className="result-vote-name">{p.name}</span>
                                    <span className="result-vote-icon">{v === 'approve' ? '👍' : '👎'}</span>
                                </div>
                            );
                        })}
                    </div>
                    {!voteResult.approved && (
                        <p className="result-rejection-info">
                            Rejection Track: {rejectionTrack} / {maxRejections}
                            {rejectionTrack >= 4 && <span className="result-danger"> — ⚠ One more = Evil wins!</span>}
                        </p>
                    )}
                    {voteResult.approved && (
                        <p className="result-info">Team heads to the quest!</p>
                    )}
                    <div className="result-timer-bar">
                        <div className="result-timer-fill" style={{ animationDuration: '4s' }} />
                    </div>
                    <span className="result-timer-text">Auto-continuing in {resultTimer}s</span>
                </div>
            </div>
        );
    }

    if (showingResult === 'quest' && questResult) {
        return <QuestReveal />;
    }

    if (phase === 'ASSASSINATION') {
        return <Assassination />;
    }

    if (phase === 'GAME_OVER') {
        return <GameOver />;
    }

    const phaseRule = PHASE_RULES[phase];

    return (
        <div className="gameboard">
            <div className="app-background" />

            {/* Top bar */}
            <div className="gb-topbar">
                <button className="gb-role-badge-btn" onClick={() => setShowRoleCard(!showRoleCard)}>
                    <span className={`badge ${isGood ? 'badge-good' : 'badge-evil'}`}>
                        {roleInfo?.roleName || 'Unknown'}
                    </span>
                    <span className="gb-peek-hint">{showRoleCard ? '▲' : '▼'}</span>
                </button>
                <div className="gb-topbar-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowVoteHistory(true)}>📊</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => {
                        if (confirm("Are you sure you want to leave the room? You will not be able to interact unless you rejoin.")) {
                            leaveRoom((res) => {
                                if (res?.error) alert(res.error);
                            });
                        }
                    }}>🚪 Leave</button>
                    {isHost && (
                        <button className="btn btn-ghost btn-sm gb-end-btn" onClick={() => setShowEndConfirm(true)}>✕ End</button>
                    )}
                </div>
            </div>

            {/* Role card peek */}
            {showRoleCard && (
                <div className={`gb-role-peek glass-card animate-fade-in ${isGood ? 'gb-role-peek-good' : 'gb-role-peek-evil'}`}>
                    <div className="gb-role-peek-header">
                        <span className="gb-role-peek-icon">{ROLE_ICONS[roleInfo?.roleKey] || '⚔'}</span>
                        <div>
                            <strong>{roleInfo?.roleName}</strong>
                            <span className={`badge ${isGood ? 'badge-good' : 'badge-evil'}`} style={{ marginLeft: 8 }}>
                                {isGood ? 'Good' : 'Evil'}
                            </span>
                        </div>
                    </div>
                    <p className="gb-role-peek-desc">{roleInfo?.description}</p>
                    {roleInfo?.knownPlayers?.length > 0 && (
                        <div className="gb-role-peek-known">
                            {roleInfo.knownPlayers.map(p => (
                                <span key={p.id} className="gb-role-peek-player">{p.name}</span>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Quest Progress Scoreboard */}
            <div className="gb-scoreboard">
                <div className="gb-score gb-score-good">
                    <span className="gb-score-label">🏰 Good</span>
                    <span className="gb-score-value">{goodWins}/3</span>
                    <span className="gb-score-need">{goodNeed > 0 ? `${goodNeed} more` : 'DONE!'}</span>
                </div>
                <div className="gb-score-vs">VS</div>
                <div className="gb-score gb-score-evil">
                    <span className="gb-score-label">🔥 Evil</span>
                    <span className="gb-score-value">{evilWins}/3</span>
                    <span className="gb-score-need">{evilNeed > 0 ? `${evilNeed} more` : 'DONE!'}</span>
                </div>
            </div>

            {/* Quest tracker */}
            <div className="gb-quest-tracker">
                {(questTeamSizes || []).map((size, i) => {
                    const result = questResults[i];
                    const isCurrent = i === currentQuestIndex;
                    let cls = 'gb-quest-dot';
                    if (result) cls += result.passed ? ' gb-quest-pass' : ' gb-quest-fail';
                    else if (isCurrent) cls += ' gb-quest-current';

                    const isTwoFail = i === 3 && players.length >= 7;
                    return (
                        <div key={i} className={cls}>
                            <span className="gb-quest-number">{i + 1}</span>
                            <span className="gb-quest-size">{size}{isTwoFail ? '*' : ''}</span>
                            {result && (
                                <span className="gb-quest-result-icon">{result.passed ? '✓' : '✗'}</span>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Rejection tracker */}
            <div className="gb-rejection-tracker">
                <span className="gb-rejection-label">Rejections</span>
                <div className="gb-rejection-pips">
                    {Array.from({ length: maxRejections }).map((_, i) => (
                        <div key={i} className={`gb-rejection-pip ${i < rejectionTrack ? 'gb-rejection-pip-active' : ''}`} />
                    ))}
                </div>
                {rejectionTrack >= 4 && (
                    <span className="gb-rejection-warning">⚠ 1 more rejection = Evil wins!</span>
                )}
            </div>

            {/* Game State Clarity Banner */}
            <div className="gb-clarity-banner glass-card animate-fade-in">
                <div className="gb-clarity-row">
                    <span className="gb-clarity-label">👑 Leader:</span>
                    <span className="gb-clarity-value">{currentLeader?.name || 'Loading...'}</span>
                    <span className="gb-clarity-sub">({requiredTeamSize} players needed)</span>
                </div>
                {voteHistory.length > 0 && (
                    <div className="gb-clarity-row">
                        <span className="gb-clarity-label">⬅️ Last Team:</span>
                        <span className="gb-clarity-value">
                            {voteHistory[voteHistory.length - 1].team.map(p => p.name).join(', ')}
                        </span>
                    </div>
                )}
                <div className="gb-clarity-row gb-clarity-quest-needs">
                    <span className="gb-clarity-label">⚔ Current Quest Needs:</span>
                    <span className="gb-clarity-value">
                        {requiredTeamSize} cards.
                        {currentQuestIndex === 3 && players.length >= 7
                            ? ' 🛡️ 2 Fails required to fail.'
                            : ' 🛡️ 1 Fail required to fail.'}
                    </span>
                </div>
                {currentQuestIndex < 4 && (
                    <div className="gb-clarity-row">
                        <span className="gb-clarity-label">⏭ Next Quest:</span>
                        <span className="gb-clarity-value">Needs {questTeamSizes?.[currentQuestIndex + 1]} players</span>
                    </div>
                )}
            </div>

            {/* Phase rule banner */}
            {phaseRule && (
                <div className="gb-phase-tip animate-fade-in">
                    <span className="gb-phase-tip-label">{phaseRule.title}</span>
                    <p className="gb-phase-tip-text">{phaseRule.rule}</p>
                </div>
            )}

            {/* Player ring */}
            <div className="gb-players">
                {players.map((p) => {
                    const isOnTeam = proposedTeam.includes(p.id);
                    const isSelected = selectedTeam.includes(p.id);
                    const isCurrentLeader = currentLeader?.id === p.id;
                    const isMe = p.id === playerId;

                    return (
                        <button
                            key={p.id}
                            className={`gb-player-chip ${isOnTeam ? 'gb-player-on-team' : ''} ${isSelected ? 'gb-player-selected' : ''} ${isMe ? 'gb-player-me' : ''}`}
                            onClick={() => phase === 'TEAM_PROPOSAL' && isLeader && toggleTeamMember(p.id)}
                            disabled={phase !== 'TEAM_PROPOSAL' || !isLeader}
                        >
                            <div className="gb-player-avatar">
                                {p.name.charAt(0).toUpperCase()}
                                {isCurrentLeader && <span className="gb-leader-crown">👑</span>}
                            </div>
                            <span className="gb-player-name">{isMe ? `${p.name} (You)` : p.name}</span>
                            {isOnTeam && <span className="gb-team-marker">⚔</span>}
                        </button>
                    );
                })}
            </div>

            {/* Action panel */}
            <div className="gb-action-panel glass-card">
                {phase === 'TEAM_PROPOSAL' && (
                    <div className="gb-action animate-fade-in">
                        <h3 className="gb-action-title">
                            {isLeader
                                ? `Select ${requiredTeamSize} players for Quest ${currentQuestIndex + 1}`
                                : `👑 ${currentLeader?.name} is choosing...`
                            }
                        </h3>
                        {isLeader && (
                            <>
                                <p className="gb-action-subtitle">
                                    Selected: {selectedTeam.length} / {requiredTeamSize}
                                </p>
                                <button
                                    className="btn btn-gold btn-lg"
                                    disabled={selectedTeam.length !== requiredTeamSize}
                                    onClick={handlePropose}
                                >
                                    ⚔ Propose Team
                                </button>
                                <p className="gb-action-note">Your vote will auto-count as Approve</p>
                            </>
                        )}
                        {!isLeader && <p className="animate-pulse gb-action-subtitle">Waiting for {currentLeader?.name}...</p>}
                    </div>
                )}

                {phase === 'VOTING' && <VotingPhase key={`vote-${voteHistory.length}`} />}

                {phase === 'QUEST' && <QuestPhase key={`quest-${currentQuestIndex}-${voteHistory.length}`} />}
            </div>

            {/* End game confirm */}
            {showEndConfirm && (
                <div className="gb-overlay" onClick={() => setShowEndConfirm(false)}>
                    <div className="gb-overlay-content glass-card" onClick={e => e.stopPropagation()}>
                        <h3 className="heading-display" style={{ color: 'var(--evil-primary)' }}>End Game?</h3>
                        <p style={{ color: 'var(--text-secondary)' }}>This will end for all players.</p>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                            <button className="btn btn-danger btn-lg" onClick={handleEndGame}>End Game</button>
                            <button className="btn btn-ghost btn-lg" onClick={() => setShowEndConfirm(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Vote History Modal */}
            {showVoteHistory && (
                <div className="gb-overlay" onClick={() => setShowVoteHistory(false)}>
                    <div className="gb-overlay-content glass-card" onClick={e => e.stopPropagation()}>
                        <VoteHistory />
                        <button className="btn btn-ghost" onClick={() => setShowVoteHistory(false)}>Close</button>
                    </div>
                </div>
            )}
        </div>
    );
}
