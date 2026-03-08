import React, { useEffect, useState } from 'react';
import { useGame } from '../context/GameContext';
import './QuestReveal.css';

export default function QuestReveal() {
    const { questReveal } = useGame();
    const [revealedCount, setRevealedCount] = useState(0);
    const [showResult, setShowResult] = useState(false);

    useEffect(() => {
        if (!questReveal || !questReveal.actions) return;

        const { actions, elapsed = 0 } = questReveal;
        const totalCards = actions.length;

        const INITIAL_PAUSE = 1000;
        const CARD_DELAY = 1500;
        const RESULT_PAUSE = 1000;

        let initial = 0;
        if (elapsed > INITIAL_PAUSE) {
            initial = Math.floor((elapsed - INITIAL_PAUSE) / CARD_DELAY) + 1;
        }
        if (initial > totalCards) initial = totalCards;

        setRevealedCount(initial);

        const resultTime = INITIAL_PAUSE + (totalCards * CARD_DELAY) + RESULT_PAUSE;
        setShowResult(elapsed >= resultTime);

        const timers = [];

        for (let i = initial; i < totalCards; i++) {
            const targetTime = INITIAL_PAUSE + (i * CARD_DELAY);
            const delay = Math.max(0, targetTime - elapsed);

            const t = setTimeout(() => {
                setRevealedCount(prev => Math.max(prev, i + 1));
            }, delay);
            timers.push(t);
        }

        const resultDelay = Math.max(0, resultTime - elapsed);
        if (elapsed < resultTime) {
            const t = setTimeout(() => {
                setShowResult(true);
            }, resultDelay);
            timers.push(t);
        }

        return () => timers.forEach(clearTimeout);
    }, [questReveal]);

    if (!questReveal || !questReveal.actions) return null;

    const { actions, result } = questReveal;
    const { passed, requiresTwoFails, failCount, successCount } = result || {};

    return (
        <div className="quest-reveal-container">
            <div className="app-background" />

            {!showResult ? (
                <div className="quest-reveal-arena">
                    <h2 className="heading-display reveal-title animate-pulse">Revealing Quest Cards...</h2>
                    <div className="reveal-cards-container">
                        {actions.map((action, index) => {
                            const isRevealed = index < revealedCount;
                            return (
                                <div
                                    key={index}
                                    className={`reveal-card ${isRevealed ? 'animate-reveal reveal-' + action : 'hidden'}`}
                                >
                                    <div className="reveal-card-inner">
                                        <div className="reveal-card-front">?</div>
                                        <div className="reveal-card-back">
                                            <span className="reveal-icon">{action === 'success' ? '✓' : '✗'}</span>
                                            <span className="reveal-label">{action === 'success' ? 'Success' : 'Fail'}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className={`quest-reveal-result animate-fade-in-scale ${passed ? 'result-success-theme' : 'result-fail-theme'}`}>
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
