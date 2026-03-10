import React, { useEffect, useState } from 'react';
import { useGame } from '../context/GameContext';
import './QuestReveal.css';

/*
 * QuestReveal — Full-screen overlay showing quest card results.
 *
 * Flow: cards appear one by one (facedown → flip), then result banner.
 * No countdown, no delays — starts immediately on mount.
 *
 * Step timeline (Dynamic to build suspense):
 *   - Each card appears facedown for 1.2s, except the FINAL card which waits 2.5s for drama!
 *   - Flipped cards stay for 1.5s before moving to the tray / next card.
 *   - Result banner appears after the final card.
 *
 * Server auto-advances everyone smoothly.
 */

export default function QuestReveal() {
    const { currentQuestReveal } = useGame();

    // Freeze data at mount so context updates don't interfere
    const [data] = useState(() => currentQuestReveal);
    const actions = data?.actions || [];
    const result = data?.result || {};

    console.log('[QUEST-REVEAL] Mounted!', {
        hasData: !!data,
        actionsCount: actions.length,
        passed: result.passed,
    });
    const total = actions.length;

    const RESULT_STEP = total * 2;
    const [step, setStep] = useState(0);

    // Drive the animation with dynamic timeouts
    useEffect(() => {
        if (total === 0 || step > RESULT_STEP) return;

        let delay = 0;
        const isFacedownStep = step % 2 === 0;
        const cardIndex = Math.floor(step / 2);

        if (isFacedownStep && step < RESULT_STEP) {
            // It's sliding up facedown.
            // If it's the very last card (the suspense card), wait longer!
            if (cardIndex === total - 1) {
                delay = 2500;
            } else {
                delay = 1200;
            }
        } else if (!isFacedownStep && step < RESULT_STEP) {
            // It just flipped. Wait before sliding the next one up.
            delay = 1500;
        }

        if (delay > 0) {
            const id = setTimeout(() => {
                setStep(prev => prev + 1);
            }, delay);
            return () => clearTimeout(id);
        }
    }, [step, total, RESULT_STEP]);

    // Loading state (should rarely be seen since data is frozen at mount)
    if (total === 0) {
        return (
            <div className="qr-overlay">
                <div className="qr-bg" />
                <p className="qr-loading">Loading quest results…</p>
            </div>
        );
    }

    const { passed, failCount, successCount, requiresTwoFails } = result;
    const isResult = step >= RESULT_STEP;

    // Card state helper
    const cardState = (i) => {
        const facedownAt = i * 2;
        const flipAt = i * 2 + 1;
        if (step < facedownAt) return 'hidden';
        if (step === facedownAt) return 'facedown';
        if (step === flipAt) return 'flipped';
        return 'done'; // moved to tray
    };

    // Running tally of revealed cards
    let successSoFar = 0, failSoFar = 0;
    for (let i = 0; i < total; i++) {
        if (step >= i * 2 + 1) {
            if (actions[i] === 'success') successSoFar++;
            else failSoFar++;
        }
    }

    // Screen shake when a fail card is revealed
    const justFlippedIdx = step % 2 === 1 ? Math.floor(step / 2) : -1;
    const shaking = justFlippedIdx >= 0 && justFlippedIdx < total && actions[justFlippedIdx] === 'fail';

    return (
        <div className={`qr-overlay ${shaking ? 'qr-shake' : ''} ${isResult ? (passed ? 'qr-glow-pass' : 'qr-glow-fail') : ''}`}>
            <div className="qr-bg" />

            {/* ── Cards Phase ── */}
            {!isResult && (
                <div className="qr-cards-area">
                    {/* Running tally */}
                    {(successSoFar + failSoFar > 0) && (
                        <div className="qr-tally">
                            <span className="qr-tally-s">✓ {successSoFar}</span>
                            <span className="qr-tally-sep">|</span>
                            <span className="qr-tally-f">✗ {failSoFar}</span>
                        </div>
                    )}

                    {/* Active center card */}
                    {actions.map((action, i) => {
                        const cs = cardState(i);
                        if (cs === 'hidden' || cs === 'done') return null;

                        return (
                            <div key={i} className={`qr-card qr-card-${cs}`}>
                                {cs === 'facedown' && (
                                    <div className="qr-face qr-front">
                                        <span className="qr-watermark">⚔️</span>
                                        ?
                                    </div>
                                )}
                                {cs === 'flipped' && (
                                    <div className={`qr-face qr-back qr-back-${action}`}>
                                        <div className="qr-card-ornament top">⚜</div>
                                        <span className="qr-back-icon">{action === 'success' ? '✓' : '✗'}</span>
                                        <span className="qr-back-label">{action === 'success' ? 'SUCCESS' : 'FAIL'}</span>
                                        <div className="qr-card-ornament bottom">⚜</div>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Bottom tray: settled cards */}
                    <div className="qr-tray">
                        {actions.map((action, i) => {
                            const inTray = cardState(i) === 'done';
                            return (
                                <div key={i} className={`qr-slot ${inTray ? 'qr-slot-filled' : ''}`}>
                                    {inTray && (
                                        <div className={`qr-mini qr-mini-${action}`}>
                                            {action === 'success' ? '✓' : '✗'}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Result Banner ── */}
            {isResult && (
                <div className={`qr-result ${passed ? 'qr-result-pass' : 'qr-result-fail'}`}>
                    <h1 className="qr-result-title">
                        {passed ? '🏰 Quest Succeeded!' : '🔥 Quest Failed!'}
                    </h1>
                    <div className="qr-result-counts">
                        <div className="qr-count-box">
                            <span className="qr-count-num">{successCount}</span>
                            <span className="qr-count-label qr-clr-s">✓ Success</span>
                        </div>
                        <div className="qr-count-box">
                            <span className="qr-count-num">{failCount}</span>
                            <span className="qr-count-label qr-clr-f">✗ Fail</span>
                        </div>
                    </div>
                    {requiresTwoFails && (
                        <p className="qr-note">⚠ This quest required 2 fails to fail.</p>
                    )}
                </div>
            )}
        </div>
    );
}
