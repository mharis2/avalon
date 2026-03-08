import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import './QuestPhase.css';

export default function QuestPhase() {
    const { submitQuestAction, roleInfo, isOnQuestTeam, questSubmittedCount, proposedTeam, players, currentQuestIndex } = useGame();
    const [submitted, setSubmitted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isGood = roleInfo?.team === 'good';
    const teamNames = proposedTeam.map(id => {
        const p = players.find(pl => pl.id === id);
        return p ? p.name : 'Unknown';
    });

    const handleAction = (action) => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        submitQuestAction(action, (res) => {
            setIsSubmitting(false);
            if (res?.error) {
                alert(res.error);
            } else {
                setSubmitted(true);
            }
        });
    };

    if (!isOnQuestTeam) {
        return (
            <div className="quest-phase animate-fade-in">
                <h3 className="gb-action-title">Quest {currentQuestIndex + 1} in Progress</h3>
                <div className="quest-team-list">
                    <p className="quest-team-label">Quest Team:</p>
                    <div className="quest-team-names">
                        {teamNames.map((name, i) => (
                            <span key={i} className="voting-team-member">{name}</span>
                        ))}
                    </div>
                </div>
                <p className="gb-action-subtitle animate-pulse">
                    Waiting for quest team to play their cards...
                </p>
                <p className="quest-count">{questSubmittedCount} / {proposedTeam.length} submitted</p>
            </div>
        );
    }

    if (submitted) {
        return (
            <div className="quest-phase animate-fade-in">
                <h3 className="gb-action-title">Card Played ✓</h3>
                <p className="gb-action-subtitle animate-pulse">Waiting for team members...</p>
                <p className="quest-count">{questSubmittedCount} / {proposedTeam.length} submitted</p>
            </div>
        );
    }

    return (
        <div className="quest-phase animate-fade-in">
            <h3 className="gb-action-title">You are on the Quest Team!</h3>
            <p className="gb-action-subtitle">Play your card secretly. {isGood ? 'As a loyal servant, you must play Success.' : 'Choose wisely...'}</p>

            <div className="quest-cards">
                <button
                    className="quest-card quest-card-success"
                    onClick={() => handleAction('success')}
                    disabled={isSubmitting}
                >
                    <span className="quest-card-icon">✓</span>
                    <span className="quest-card-label">{isSubmitting ? '...' : 'Success'}</span>
                </button>

                {!isGood && (
                    <button
                        className="quest-card quest-card-fail"
                        onClick={() => handleAction('fail')}
                        disabled={isSubmitting}
                    >
                        <span className="quest-card-icon">✗</span>
                        <span className="quest-card-label">{isSubmitting ? '...' : 'Fail'}</span>
                    </button>
                )}
            </div>
        </div>
    );
}
