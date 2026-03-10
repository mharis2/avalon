import React, { useEffect, useState, useMemo } from 'react';
import { useGame } from '../context/GameContext';
import './QuestReveal.css';

/**
 * QuestReveal — CSS-driven cinematic card reveal overlay.
 *
 * Architecture (completely different from the old approach):
 *   - ALL visual animation is driven by CSS @keyframes + animation-delay
 *   - Cards are rendered once at mount; CSS auto-staggers them via --i custom property
 *   - React manages only 3 lightweight states: phase, revealedCount, flash
 *   - No per-card state arrays, no 5-state-per-card timeout chains
 *   - JS timeouts only track metadata (counter/tally), NOT visual animation
 *   - This makes animation immune to React re-render timing issues
 *
 * Timing constants MUST match the CSS animation durations/delays below.
 */

// ─── Timing (ms) ────────────────────────────────────────────────────
const INTRO_MS    = 1800;   // Suspenseful intro duration
const PER_CARD_MS = 3200;   // Full card cycle: fly(700) + pause(300) + flip(800) + hold(900) + exit(500)
const FLIP_DONE   = 1800;   // Within-card offset when flip completes (700+300+800)
const CARD_EXIT   = 2800;   // Within-card offset when card exits → tray fills
const RESULT_WAIT = 1200;   // Pause after last card before result banner

export default function QuestReveal() {
    const { questResult } = useGame();

    // ── Freeze data at mount — immune to context updates ────────
    const [data] = useState(() => questResult);
    const actions = data?.actions || [];
    const result  = data?.result  || {};
    const total   = actions.length;

    // ── Minimal state: phase + counter + screen flash ───────────
    const [phase, setPhase]            = useState('intro');
    const [revealedCount, setRevealed] = useState(0);
    const [flash, setFlash]            = useState('');

    // ── Pre-compute running success/fail totals ─────────────────
    const runningTotals = useMemo(() => {
        let s = 0, f = 0;
        return actions.map(a => {
            if (a === 'success') s++; else f++;
            return { s, f };
        });
    }, [actions]);

    // ── Effect 1: Intro → Cards transition ──────────────────────
    useEffect(() => {
        if (!total) return;
        const t = setTimeout(() => setPhase('cards'), INTRO_MS);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Effect 2: Cards phase — sync JS metadata with CSS ───────
    //    Starts when 'cards' phase mounts, so JS timers and CSS
    //    animation-delay both measure from the same origin point.
    useEffect(() => {
        if (phase !== 'cards' || !total) return;
        const timers = [];
        const sched = (fn, ms) => timers.push(setTimeout(fn, ms));

        actions.forEach((action, i) => {
            const base = i * PER_CARD_MS;
            // Screen flash when flip completes
            sched(() => setFlash(action),    base + FLIP_DONE);
            sched(() => setFlash(''),        base + FLIP_DONE + 600);
            // Tray fills when card exits
            sched(() => setRevealed(i + 1),  base + CARD_EXIT);
        });

        // Transition to result banner
        sched(() => setPhase('result'), total * PER_CARD_MS + RESULT_WAIT);

        return () => timers.forEach(clearTimeout);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase]);

    // ── Empty / loading state ───────────────────────────────────
    if (!total) {
        return (
            <div className="qr-overlay">
                <div className="qr-bg" />
                <p className="qr-loading animate-pulse">Gathering quest cards…</p>
            </div>
        );
    }

    const { passed, failCount, successCount, requiresTwoFails } = result;
    const totals = revealedCount > 0 ? runningTotals[revealedCount - 1] : null;

    const overlayClass = [
        'qr-overlay',
        flash && `qr-flash-${flash}`,
        phase === 'result' && (passed ? 'qr-bg-pass' : 'qr-bg-fail'),
    ].filter(Boolean).join(' ');

    return (
        <div className={overlayClass}>
            <div className="qr-bg" />

            {/* ═══ INTRO ═══════════════════════════════════════════════ */}
            {phase === 'intro' && (
                <div className="qr-intro">
                    <h2 className="qr-intro-title heading-display">⚔ The Quest Cards Are In</h2>
                    <p className="qr-intro-sub animate-pulse">Preparing to reveal…</p>
                </div>
            )}

            {/* ═══ CARDS (CSS-animated) ═════════════════════════════════ */}
            {phase === 'cards' && (
                <>
                    {/* HUD: card counter + running tally */}
                    <div className="qr-hud">
                        <div className="qr-counter">
                            Card {Math.min(revealedCount + (revealedCount < total ? 1 : 0), total)} of {total}
                        </div>
                        {totals && (
                            <div className="qr-tally" key={revealedCount}>
                                <span className="qr-tally-s">✓ {totals.s} Success</span>
                                <span className="qr-tally-f">✗ {totals.f} Fail</span>
                            </div>
                        )}
                    </div>

                    {/* Cards — ALL rendered at once; CSS staggers via --i */}
                    {actions.map((action, i) => (
                        <div key={i} className="qr-card" style={{ '--i': i }}>
                            <div className="qr-flipper">
                                <div className="qr-face qr-front">
                                    <span className="qr-front-symbol">?</span>
                                </div>
                                <div className={`qr-face qr-back qr-back-${action}`}>
                                    <span className="qr-back-icon">{action === 'success' ? '✓' : '✗'}</span>
                                    <span className="qr-back-text">{action === 'success' ? 'SUCCESS' : 'FAIL'}</span>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Settled-cards tray */}
                    <div className="qr-tray">
                        {actions.map((action, i) => (
                            <div key={i} className={`qr-tray-slot ${i < revealedCount ? 'filled' : ''}`}>
                                {i < revealedCount && (
                                    <div className={`qr-mini qr-mini-${action}`}>
                                        {action === 'success' ? '✓' : '✗'}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* ═══ RESULT ══════════════════════════════════════════════ */}
            {phase === 'result' && (
                <div className={`qr-result ${passed ? 'qr-pass' : 'qr-fail'}`}>
                    <h1 className="qr-result-title heading-display">
                        {passed ? '🏰 Quest Succeeded!' : '🔥 Quest Failed!'}
                    </h1>
                    <div className="qr-result-counts">
                        <div className="qr-count-group">
                            <span className="qr-count-num">{successCount}</span>
                            <span className="qr-count-lbl qr-s-clr">✓ Success</span>
                        </div>
                        <div className="qr-count-group">
                            <span className="qr-count-num">{failCount}</span>
                            <span className="qr-count-lbl qr-f-clr">✗ Fail</span>
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
