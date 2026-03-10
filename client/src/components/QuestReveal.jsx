import React, { useEffect, useState } from 'react';
import { useGame } from '../context/GameContext';
import './QuestReveal.css';

/*
 * QuestReveal — Full-screen overlay showing quest card results.
 *
 * Triggered by the dedicated 'quest-result' socket event (mirrors 'vote-result').
 * GameBoard renders this when showingResult === 'quest' && questResult.
 *
 * Flow: cards appear one by one (facedown → flip), then result banner.
 * No countdown, no delays — starts immediately on mount.
 *
 * Step timeline (each step = 1 second):
 *   step 0: card 0 slides up facedown
 *   step 1: card 0 flips to reveal
 *   step 2: card 1 slides up facedown
 *   step 3: card 1 flips to reveal
 *   ...
 *   step total*2: result banner appears
 *
 * Server auto-advances everyone after total*2*1000 + 3500ms.
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

    // Drive the animation with a simple 1-second interval
    useEffect(() => {
        if (total === 0) return;

        const id = setInterval(() => {
            setStep(prev => {
                const next = prev + 1;
                if (next > RESULT_STEP) {
                    clearInterval(id);
                    return RESULT_STEP;
                }
                return next;
            });
        }, 1000);

        return () => clearInterval(id);
    }, [total, RESULT_STEP]);

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
                                    <div className="qr-face qr-front">?</div>
                                )}
                                {cs === 'flipped' && (
                                    <div className={`qr-face qr-back qr-back-${action}`}>
                                        <span className="qr-back-icon">{action === 'success' ? '✓' : '✗'}</span>
                                        <span className="qr-back-label">{action === 'success' ? 'SUCCESS' : 'FAIL'}</span>
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
