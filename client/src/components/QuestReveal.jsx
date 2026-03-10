import React, { useEffect, useState } from 'react';
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
const PER_CARD = FLY_UP_DURATION + FLIP_DELAY + FLIP_DURATION + HOLD_REVEAL + SETTLE_DURATION + GAP_BETWEEN_CARDS;

/**
 * QuestReveal — Cinematic card-flip overlay.
 *
 * IMPORTANT: This component is rendered conditionally by App.jsx via:
 *   {questResult && phase === 'QUEST_REVEAL' && <QuestReveal />}
 * So `questResult` is GUARANTEED to be set when this component mounts.
 *
 * We freeze the data at mount time with useState(initializer) to be
 * completely immune to context updates and React StrictMode double-mounting.
 * The animation runs from a single useEffect([], ...) with its own cleanup.
 */
export default function QuestReveal() {
    const { questResult } = useGame();

    // ── Freeze data at mount time ──────────────────────────────────
    const [data] = useState(() => questResult);
    const actions = data?.actions || [];
    const result = data?.result || {};
    const totalCards = actions.length;

    // ── Animation states ──────────────────────────────────────────
    const [cardStates, setCardStates] = useState(() => Array(totalCards).fill('hidden'));
    const [showResult, setShowResult] = useState(false);
    const [bgFlash, setBgFlash] = useState(null);
    const [drumroll, setDrumroll] = useState(true);

    // ── Single mount-only effect — drives the entire animation ────
    useEffect(() => {
        if (totalCards === 0) return;

        const timeouts = [];
        const schedule = (fn, delay) => {
            timeouts.push(setTimeout(fn, delay));
        };

        // Dismiss drumroll just before first card
        schedule(() => setDrumroll(false), Math.max(INITIAL_PAUSE - 200, 100));

        actions.forEach((action, i) => {
            const t = INITIAL_PAUSE + i * PER_CARD;

            // 1. Card flies up from bottom to center
            schedule(() => {
                setCardStates(prev => { const n = [...prev]; n[i] = 'flying'; return n; });
            }, t);

            // 2. Card starts its 3D flip
            schedule(() => {
                setCardStates(prev => { const n = [...prev]; n[i] = 'flipping'; return n; });
            }, t + FLY_UP_DURATION + FLIP_DELAY);

            // 3. Card is fully revealed — hold in center + screen flash
            schedule(() => {
                setCardStates(prev => { const n = [...prev]; n[i] = 'revealed'; return n; });
                setBgFlash(action);
                schedule(() => setBgFlash(null), 500);
            }, t + FLY_UP_DURATION + FLIP_DELAY + FLIP_DURATION);

            // 4. Card settles into the tray
            schedule(() => {
                setCardStates(prev => { const n = [...prev]; n[i] = 'settling'; return n; });
            }, t + FLY_UP_DURATION + FLIP_DELAY + FLIP_DURATION + HOLD_REVEAL);

            // 5. Mark as fully settled
            schedule(() => {
                setCardStates(prev => { const n = [...prev]; n[i] = 'settled'; return n; });
            }, t + FLY_UP_DURATION + FLIP_DELAY + FLIP_DURATION + HOLD_REVEAL + SETTLE_DURATION);
        });

        // 6. Show the big dramatic result banner
        schedule(() => setShowResult(true), INITIAL_PAUSE + totalCards * PER_CARD + RESULT_PAUSE);

        return () => timeouts.forEach(clearTimeout);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Mount-only: data is frozen via useState initializer above

    // ── Render ────────────────────────────────────────────────────
    if (totalCards === 0) {
        return (
            <div className="quest-reveal-container">
                <div className="app-background" />
                <div className="reveal-ambient-bg" />
                <p className="reveal-waiting-text animate-pulse">Gathering quest cards…</p>
            </div>
        );
    }

    const { passed, requiresTwoFails, failCount, successCount } = result;

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
                            <span>Card {Math.min(cardStates.filter(s => s !== 'hidden').length, totalCards)} of {totalCards}</span>
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
