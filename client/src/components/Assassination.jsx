import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import './Assassination.css';

export default function Assassination() {
    const { players, playerId, roleInfo, assassinate } = useGame();
    const [selectedTarget, setSelectedTarget] = useState(null);
    const [submitted, setSubmitted] = useState(false);

    const isAssassin = roleInfo?.roleKey === 'assassin';

    const goodPlayers = players.filter(p => p.id !== playerId || !isAssassin);

    const handleAssassinate = () => {
        if (!selectedTarget) return;
        setSubmitted(true);
        assassinate(selectedTarget, (res) => {
            if (res?.error) {
                setSubmitted(false);
                alert(res.error);
            }
        });
    };

    if (!isAssassin) {
        return (
            <div className="page-center">
                <div className="app-background" />
                <div className="glass-card assassination-card animate-fade-in-scale">
                    <div className="assassination-icon">🗡️</div>
                    <h2 className="heading-display assassination-title">Assassination Phase</h2>
                    <p className="assassination-desc animate-pulse">
                        Good has completed 3 quests! But the Assassin now has a chance to identify Merlin...
                    </p>
                    <p className="assassination-waiting">Waiting for the Assassin to choose a target...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page-center">
            <div className="app-background" />
            <div className="glass-card assassination-card animate-fade-in-scale">
                <div className="assassination-icon">🗡️</div>
                <h2 className="heading-display assassination-title">You Are the Assassin</h2>
                <p className="assassination-desc">
                    Good has passed 3 quests, but you can still win! Identify and assassinate Merlin.
                </p>

                <div className="assassination-targets">
                    {players.filter(p => p.id !== playerId).map(p => (
                        <button
                            key={p.id}
                            className={`assassination-target ${selectedTarget === p.id ? 'assassination-target-selected' : ''}`}
                            onClick={() => !submitted && setSelectedTarget(p.id)}
                            disabled={submitted}
                        >
                            <div className="assassination-target-avatar">
                                {p.name.charAt(0).toUpperCase()}
                            </div>
                            <span>{p.name}</span>
                        </button>
                    ))}
                </div>

                <button
                    className="btn btn-danger btn-lg"
                    disabled={!selectedTarget || submitted}
                    onClick={handleAssassinate}
                >
                    {submitted ? 'Assassinating...' : '🗡️ Assassinate'}
                </button>
            </div>
        </div>
    );
}
