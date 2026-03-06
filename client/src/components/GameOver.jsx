import React from 'react';
import { useGame } from '../context/GameContext';
import './GameOver.css';

const WIN_REASON_TEXT = {
    three_quests_passed: '3 quests were completed successfully',
    three_quests_failed: '3 quests failed',
    five_rejections: '5 consecutive team proposals were rejected',
    merlin_assassinated: 'The Assassin correctly identified Merlin',
    merlin_survived: 'The Assassin failed to identify Merlin',
};

export default function GameOver() {
    const { winner, winReason, fullReveal, players, isHost, returnToLobby, restartGame } = useGame();

    const isGoodWin = winner === 'good';

    const handleReturnToLobby = () => {
        returnToLobby((res) => {
            if (res?.error) alert(res.error);
        });
    };

    const handleRestart = () => {
        restartGame((res) => {
            if (res?.error) alert(res.error);
        });
    };

    return (
        <div className="page-center">
            <div className="app-background" />
            <div className={`glass-card game-over-card animate-fade-in-scale ${isGoodWin ? 'game-over-good' : 'game-over-evil'}`}>
                <div className="game-over-banner">
                    {isGoodWin ? '🏰' : '🔥'}
                </div>
                <h1 className="heading-display game-over-title">
                    {isGoodWin ? 'Good Wins!' : 'Evil Wins!'}
                </h1>
                <p className="game-over-reason">
                    {WIN_REASON_TEXT[winReason] || winReason}
                </p>

                {/* Full role reveal */}
                {fullReveal?.roleAssignments && (
                    <div className="game-over-reveal">
                        <h3 className="game-over-reveal-title">Role Reveal</h3>
                        <div className="game-over-reveal-list">
                            {Object.entries(fullReveal.roleAssignments).map(([id, role]) => (
                                <div key={id} className={`game-over-reveal-item ${role.team === 'good' ? 'game-over-reveal-good' : 'game-over-reveal-evil'}`}>
                                    <span className="game-over-reveal-name">{role.playerName}</span>
                                    <span className={`badge ${role.team === 'good' ? 'badge-good' : 'badge-evil'}`}>
                                        {role.name}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Host actions */}
                {isHost && (
                    <div className="game-over-actions">
                        <button className="btn btn-gold btn-lg" onClick={handleRestart}>
                            🔄 Play Again
                        </button>
                        <button className="btn btn-ghost" onClick={handleReturnToLobby}>
                            Back to Lobby
                        </button>
                    </div>
                )}

                {!isHost && (
                    <p className="game-over-wait animate-pulse">Waiting for host...</p>
                )}
            </div>
        </div>
    );
}
