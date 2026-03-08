import React, { useEffect, useState } from 'react';
import { useGame } from '../context/GameContext';
import './QuestReveal.css';

export default function QuestReveal() {
    const { questReveal } = useGame();
    const [revealedCount, setRevealedCount] = useState(0);
    const [showResult, setShowResult] = useState(false);

    useEffect(() => {
        if (!questReveal || !questReveal.actions) return;

        const totalCards = questReveal.actions.length;
        if (totalCards === 0) return;

        // Use the absolute start time of the phase, offset by any server elapsed time
        const startTime = Date.now() - (questReveal.elapsed || 0);
        let animationFrameId;

        const checkTime = () => {
            const elapsed = Date.now() - startTime;

            // Calculate how many cards should be revealed based on elapsed time.
            // First card flies in at 1000ms. Subsequent cards every 1500ms.
            let expectedCount = 0;
            if (elapsed >= 1000) {
                expectedCount = 1 + Math.floor((elapsed - 1000) / 1500);
            }

            // Clamp to totalCards
            if (expectedCount > totalCards) expectedCount = totalCards;

            setRevealedCount(expectedCount);

            // Show result exactly 1000ms after the last card flies in.
            // Time of last card = 1000 + (totalCards - 1) * 1500.
            // +1000ms for result = 2000 + (totalCards - 1) * 1500.
            const timeToResult = 2000 + (totalCards - 1) * 1500;

            if (elapsed >= timeToResult) {
                setShowResult(true);
            } else {
                animationFrameId = requestAnimationFrame(checkTime);
            }
        };

        animationFrameId = requestAnimationFrame(checkTime);

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
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
                            if (index >= revealedCount) return null;

                            return (
                                <div
                                    key={`card-${index}`}
                                    className={`reveal-card animate-reveal reveal-${action}`}
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
