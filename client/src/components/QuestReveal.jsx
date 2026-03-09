import React, { useEffect, useState } from 'react';
import { useGame } from '../context/GameContext';
import './QuestReveal.css';

export default function QuestReveal() {
    const { questResult } = useGame();
    // cardState matches actions.length. Each index can be:
    // 'hidden' -> 'focus' (fly up + flip centrally) -> 'settled' (results tray)
    const [cardStates, setCardStates] = useState(() => {
        return questResult && questResult.actions
            ? Array(questResult.actions.length).fill('hidden')
            : [];
    });

    const [showResult, setShowResult] = useState(false);
    const [bgFlash, setBgFlash] = useState(null);

    useEffect(() => {
        if (!questResult || !questResult.actions) return;

        const totalCards = questResult.actions.length;
        if (totalCards === 0) return;

        let timeouts = [];

        // Timing Constants
        const NEXT_CARD_DELAY = 1500; // time between starting each card
        const FLIP_FLASH_OFFSET = 600; // When to trigger the screen flash after the card starts
        const SETTLE_OFFSET = 1200; // When to settle the card into the grid
        const RESULT_DELAY = (totalCards * NEXT_CARD_DELAY) + 1000;

        questResult.actions.forEach((action, i) => {
            const startTime = i * NEXT_CARD_DELAY;

            // 1. Trigger the card to fly up and flip centrally
            timeouts.push(setTimeout(() => {
                setCardStates(prev => {
                    // Sanity check just in case prev is suddenly empty
                    const next = prev.length === totalCards ? [...prev] : Array(totalCards).fill('hidden');
                    next[i] = 'focus';
                    return next;
                });
            }, startTime));

            // 2. Trigger the explosive screen color flash as the card flips
            timeouts.push(setTimeout(() => {
                setBgFlash(action);
                // Clear flash after 400ms
                timeouts.push(setTimeout(() => setBgFlash(null), 400));
            }, startTime + FLIP_FLASH_OFFSET));

            // 3. Shrink the card down into the results tray
            timeouts.push(setTimeout(() => {
                setCardStates(prev => {
                    const next = prev.length === totalCards ? [...prev] : Array(totalCards).fill('hidden');
                    next[i] = 'settled';
                    return next;
                });
            }, startTime + SETTLE_OFFSET));
        });

        // 4. Finally show the big overlay result
        timeouts.push(setTimeout(() => {
            setShowResult(true);
        }, RESULT_DELAY));

        return () => timeouts.forEach(clearTimeout);
    }, []); // Empty dependency array because we only want to mount this sequence ONCE

    if (!questResult || !questResult.actions) return null;

    const { actions, result } = questResult;
    const { passed, requiresTwoFails, failCount, successCount } = result || {};

    return (
        <div className={`quest-reveal-container ${bgFlash ? `flash-${bgFlash}` : ''}`}>
            {/* Cinematic Background overlay */}
            <div className="app-background" />
            <div className="reveal-ambient-bg" />

            {!showResult ? (
                <div className="quest-reveal-arena">
                    {/* The settled cards row */}
                    <div className="reveal-cards-tray">
                        {actions.map((action, index) => (
                            <div
                                key={`tray-${index}`}
                                className={`reveal-tray-slot ${cardStates[index] === 'settled' ? 'filled' : ''}`}
                            >
                                {cardStates[index] === 'settled' && (
                                    <div className={`tray-card tray-card-${action} animate-pop-in`}>
                                        <span className="tray-card-icon">{action === 'success' ? '✓' : '✗'}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* The active focus card that flies from bottom center */}
                    {actions.map((action, index) => {
                        if (cardStates[index] !== 'focus') return null;

                        return (
                            <div key={`focus-${index}`} className={`reveal-focus-card reveal-${action}`}>
                                <div className="reveal-focus-inner">
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
