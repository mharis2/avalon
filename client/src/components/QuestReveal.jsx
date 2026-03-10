import React, { useEffect, useState, useRef } from 'react';
import { useGame } from '../context/GameContext';
import './QuestReveal.css';

// ─── Timing Constants (ms) ──────────────────────────────────────────
const INITIAL_PAUSE = 800;       // Dramatic pause before first card
const FLY_UP_DURATION = 700;     // Card flies to center
const FLIP_DELAY = 300;          // Brief pause before card flips
const FLIP_DURATION = 800;       // The 3D flip itself
const HOLD_REVEAL = 1200;        // Time to HOLD the revealed card in center
const SETTLE_DURATION = 500;     // Card shrinks into tray
const GAP_BETWEEN_CARDS = 400;   // Pause between one card settling and next starting
const RESULT_PAUSE = 1200;       // Pause after last card before showing final result

// Phases per card: fly-up → pause → flip → hold → settle → gap
function getCardStartTime(index) {
    const perCard = FLY_UP_DURATION + FLIP_DELAY + FLIP_DURATION + HOLD_REVEAL + SETTLE_DURATION + GAP_BETWEEN_CARDS;
    return INITIAL_PAUSE + index * perCard;
}

function getTotalAnimationTime(totalCards) {
    const perCard = FLY_UP_DURATION + FLIP_DELAY + FLIP_DURATION + HOLD_REVEAL + SETTLE_DURATION + GAP_BETWEEN_CARDS;
    return INITIAL_PAUSE + totalCards * perCard + RESULT_PAUSE;
}

export default function QuestReveal() {
    const { questResult } = useGame();

    // Card animation states: 'hidden' → 'flying' → 'flipping' → 'revealed' → 'settling' → 'settled'
    const [cardStates, setCardStates] = useState([]);
    const [showResult, setShowResult] = useState(false);
    const [bgFlash, setBgFlash] = useState(null);
    const [drumroll, setDrumroll] = useState(true); // Initial suspense text
    const timeoutsRef = useRef([]);

    // Clean up timeouts on unmount
    useEffect(() => {
        return () => {
            timeoutsRef.current.forEach(clearTimeout);
            timeoutsRef.current = [];
        };
    }, []);

    // Main animation effect — depends on questResult so it fires when data arrives
    useEffect(() => {
        if (!questResult?.actions?.length) return;

        const actions = questResult.actions;
        const totalCards = actions.length;

        // Clear any previous animation
        timeoutsRef.current.forEach(clearTimeout);
        timeoutsRef.current = [];

        // Reset all animation state
        setCardStates(Array(totalCards).fill('hidden'));
        setShowResult(false);
        setBgFlash(null);
        setDrumroll(true);

        const schedule = (fn, delay) => {
            const id = setTimeout(fn, delay);
            timeoutsRef.current.push(id);
        };

        // Dismiss drumroll text before first card
        schedule(() => setDrumroll(false), INITIAL_PAUSE - 200);

        actions.forEach((action, i) => {
            const t = getCardStartTime(i);

            // 1. Card flies up from bottom to center
            schedule(() => {
                setCardStates(prev => {
                    const next = [...prev];
                    next[i] = 'flying';
                    return next;
                });
            }, t);

            // 2. Card starts its 3D flip
            schedule(() => {
                setCardStates(prev => {
                    const next = [...prev];
                    next[i] = 'flipping';
                    return next;
                });
            }, t + FLY_UP_DURATION + FLIP_DELAY);

            // 3. Card is fully revealed — hold in center + screen flash
            schedule(() => {
                setCardStates(prev => {
                    const next = [...prev];
                    next[i] = 'revealed';
                    return next;
                });
                // Explosive screen flash
                setBgFlash(action);
                schedule(() => setBgFlash(null), 500);
            }, t + FLY_UP_DURATION + FLIP_DELAY + FLIP_DURATION);

            // 4. Card settles into the tray
            schedule(() => {
                setCardStates(prev => {
                    const next = [...prev];
                    next[i] = 'settling';
                    return next;
                });
            }, t + FLY_UP_DURATION + FLIP_DELAY + FLIP_DURATION + HOLD_REVEAL);

            // 5. Mark as fully settled
            schedule(() => {
                setCardStates(prev => {
                    const next = [...prev];
                    next[i] = 'settled';
                    return next;
                });
            }, t + FLY_UP_DURATION + FLIP_DELAY + FLIP_DURATION + HOLD_REVEAL + SETTLE_DURATION);
        });

        // 6. Show the big dramatic result
        schedule(() => {
            setShowResult(true);
        }, getTotalAnimationTime(totalCards));

    }, [questResult]);

    // ─── Render ──────────────────────────────────────────────────────
    if (!questResult?.actions?.length) {
        // Waiting for data — show a suspenseful loading state instead of null
        return (
            <div className="quest-reveal-container">
                <div className="app-background" />
                <div className="reveal-ambient-bg" />
                <p className="reveal-waiting-text animate-pulse">Gathering quest cards…</p>
            </div>
        );
    }

    const { actions, result } = questResult;
    const { passed, requiresTwoFails, failCount, successCount } = result || {};

    // Determine which card is currently "active" (flying/flipping/revealed)
    const activeIndex = cardStates.findIndex(s => s === 'flying' || s === 'flipping' || s === 'revealed');

    return (
        <div className={`quest-reveal-container ${bgFlash ? `flash-${bgFlash}` : ''}`}>
            <div className="app-background" />
            <div className="reveal-ambient-bg" />

            {!showResult ? (
                <div className="quest-reveal-arena">
                    {/* Drumroll / suspense text */}
                    {drumroll && (
                        <div className="reveal-drumroll animate-fade-in">
                            <h2 className="heading-display reveal-drumroll-title">⚔ Quest Cards Collected</h2>
                            <p className="reveal-drumroll-sub animate-pulse">Preparing to reveal…</p>
                        </div>
                    )}

                    {/* Card counter */}
                    {!drumroll && (
                        <div className="reveal-card-counter animate-fade-in">
                            <span>Card {Math.min(cardStates.filter(s => s !== 'hidden').length, actions.length)} of {actions.length}</span>
                        </div>
                    )}

                    {/* The settled cards tray at the bottom */}
                    <div className="reveal-cards-tray">
                        {actions.map((action, index) => {
                            const isSettled = cardStates[index] === 'settled' || cardStates[index] === 'settling';
                            return (
                                <div
                                    key={`tray-${index}`}
                                    className={`reveal-tray-slot ${isSettled ? 'filled' : ''}`}
                                >
                                    {isSettled && (
                                        <div className={`tray-card tray-card-${action} animate-pop-in`}>
                                            <span className="tray-card-icon">{action === 'success' ? '✓' : '✗'}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* The active focus card in the center */}
                    {actions.map((action, index) => {
                        const state = cardStates[index];
                        if (state !== 'flying' && state !== 'flipping' && state !== 'revealed') return null;

                        return (
                            <div
                                key={`focus-${index}`}
                                className={`reveal-focus-card reveal-${action} focus-state-${state}`}
                            >
                                <div className={`reveal-focus-inner ${state === 'flipping' || state === 'revealed' ? 'do-flip' : ''}`}>
                                    <div className="reveal-focus-front">?</div>
                                    <div className="reveal-focus-back">
                                        <span className="focus-icon">{action === 'success' ? '✓' : '✗'}</span>
                                        <span className="focus-label">{action === 'success' ? 'SUCCESS' : 'FAIL'}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className={`quest-reveal-result ${passed ? 'result-success-theme' : 'result-fail-theme'}`}>
                    <div className="result-backdrop" />
                    <h1 className="heading-display final-result-title">
                        {passed ? '🏰 Quest Succeeded!' : '🔥 Quest Failed!'}
                    </h1>

                    <div className="result-summary-cards">
                        <div className="summary-card-group">
                            <span className="summary-count">{successCount}</span>
                            <span className="summary-icon success-text">✓ Success</span>
                        </div>
                        <div className="summary-card-group">
                            <span className="summary-count">{failCount}</span>
                            <span className="summary-icon fail-text">✗ Fail</span>
                        </div>
                    </div>

                    {requiresTwoFails && (
                        <p className="requires-two-fails-note">⚠ This quest required 2 fails to fail.</p>
                    )}
                </div>
            )}
        </div>
    );
}
