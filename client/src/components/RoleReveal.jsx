import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import './RoleReveal.css';

const ROLE_ICONS = {
    merlin: '🔮', percival: '🛡️', loyalServant: '⚜️',
    assassin: '🗡️', morgana: '🎭', mordred: '👑', oberon: '👤', minion: '💀',
};

export default function RoleReveal() {
    const { roleInfo, playerReady, readyCount, players } = useGame();
    const [hasConfirmed, setHasConfirmed] = useState(false);

    if (!roleInfo) return null;

    const isGood = roleInfo.team === 'good';

    const handleConfirm = () => {
        setHasConfirmed(true);
        playerReady();
    };

    return (
        <div className="page-center">
            <div className="app-background" />
            <div className={`role-reveal-card glass-card animate-fade-in-scale ${isGood ? 'role-reveal-good' : 'role-reveal-evil'}`}>
                {/* Role icon */}
                <div className="role-reveal-icon">
                    {ROLE_ICONS[roleInfo.roleKey] || '⚔'}
                </div>

                {/* Team badge */}
                <span className={`badge ${isGood ? 'badge-good' : 'badge-evil'}`}>
                    {isGood ? 'Loyal to Arthur' : 'Minion of Mordred'}
                </span>

                {/* Role name */}
                <h1 className="heading-display role-reveal-name">
                    {roleInfo.roleName}
                </h1>

                {/* Description with player names */}
                <p className="role-reveal-desc">{roleInfo.description}</p>

                {/* Known players */}
                {roleInfo.knownPlayers?.length > 0 && (
                    <div className="role-reveal-known">
                        {roleInfo.knownPlayers.map(p => (
                            <div key={p.id} className={`role-reveal-known-player ${isGood ? '' : 'role-reveal-known-evil'}`}>
                                <div className="role-reveal-known-avatar">
                                    {p.name.charAt(0).toUpperCase()}
                                </div>
                                <span>{p.name}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Continue button */}
                {!hasConfirmed ? (
                    <button
                        className={`btn ${isGood ? 'btn-primary' : 'btn-danger'} btn-lg role-reveal-btn`}
                        onClick={handleConfirm}
                    >
                        I Understand — Continue
                    </button>
                ) : (
                    <div className="role-reveal-waiting">
                        <p className="animate-pulse">Waiting for all players to confirm...</p>
                        <p className="role-reveal-count">{readyCount} / {players.length} ready</p>
                    </div>
                )}

                <p className="role-reveal-warning">
                    💡 Tip: You can view your role card anytime during the game by clicking your role badge at the top.
                </p>
            </div>
        </div>
    );
}
