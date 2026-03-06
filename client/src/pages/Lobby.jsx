import React from 'react';
import { useGame } from '../context/GameContext';
import './Lobby.css';

const PLAYER_DISTRIBUTION = {
    5: { good: 3, evil: 2 }, 6: { good: 4, evil: 2 }, 7: { good: 4, evil: 3 },
    8: { good: 5, evil: 3 }, 9: { good: 6, evil: 3 }, 10: { good: 6, evil: 4 },
};

const ROLE_INFO = {
    merlin: { name: 'Merlin', team: 'good', desc: 'Knows evil players (except Mordred)', dep: 'Requires Assassin' },
    percival: { name: 'Percival', team: 'good', desc: 'Sees Merlin and Morgana', dep: 'Requires Morgana & Merlin' },
    assassin: { name: 'Assassin', team: 'evil', desc: 'Can kill Merlin if Good wins', dep: 'Requires Merlin' },
    morgana: { name: 'Morgana', team: 'evil', desc: 'Appears as Merlin to Percival', dep: 'Requires Percival & Merlin' },
    mordred: { name: 'Mordred', team: 'evil', desc: 'Hidden from Merlin' },
    oberon: { name: 'Oberon', team: 'evil', desc: 'Unknown to other evil players' },
};

const DEFAULT_ROLES = [
    { key: 'loyal', name: 'Loyal Servant', team: 'good', desc: 'Default Good player. No special abilities.' },
    { key: 'minion', name: 'Minion of Mordred', team: 'evil', desc: 'Default Evil player. Knows other evil (except Oberon).' },
];

export default function Lobby() {
    const { players, enabledRoles, roomCode, isHost, toggleRole, startGame, hostId } = useGame();
    const playerCount = players.length;
    const dist = PLAYER_DISTRIBUTION[playerCount];
    const canStart = playerCount >= 5 && playerCount <= 10;

    const handleStart = () => {
        startGame((res) => {
            if (res?.error) alert(res.error);
        });
    };

    const handleCopyCode = () => {
        navigator.clipboard?.writeText(roomCode);
    };

    return (
        <div className="page-center">
            <div className="app-background" />
            <div className="lobby-container">
                {/* Room Code */}
                <div className="lobby-header animate-fade-in">
                    <p className="lobby-label">Room Code</p>
                    <div className="lobby-code-row" onClick={handleCopyCode} title="Click to copy">
                        <h2 className="lobby-code">{roomCode}</h2>
                        <span className="lobby-copy-icon">📋</span>
                    </div>
                    <p className="lobby-hint">Share this code with friends to join</p>
                </div>

                {/* Players */}
                <div className="glass-card lobby-section animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                    <h3 className="lobby-section-title">
                        Players <span className="lobby-count">{playerCount}/10</span>
                    </h3>
                    <div className="lobby-players">
                        {players.map((p, i) => (
                            <div key={p.id} className="lobby-player" style={{ animationDelay: `${i * 0.05}s` }}>
                                <div className="lobby-player-avatar">
                                    {p.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="lobby-player-name">{p.name}</span>
                                {p.id === hostId && <span className="badge badge-gold">Host</span>}
                            </div>
                        ))}
                        {playerCount < 10 && (
                            <div className="lobby-player lobby-player-empty">
                                <div className="lobby-player-avatar lobby-player-avatar-empty">+</div>
                                <span className="lobby-player-name" style={{ color: 'var(--text-muted)' }}>
                                    Waiting...
                                </span>
                            </div>
                        )}
                    </div>
                    {dist && (
                        <div className="lobby-dist">
                            <span className="badge badge-good">Good: {dist.good}</span>
                            <span className="badge badge-evil">Evil: {dist.evil}</span>
                        </div>
                    )}
                </div>

                {/* Role Settings */}
                <div className="glass-card lobby-section animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                    <h3 className="lobby-section-title">Characters</h3>
                    <p className="lobby-roles-hint">
                        {isHost ? 'Tap to toggle optional characters' : 'Host controls character selection'}
                    </p>
                    <div className="lobby-roles">
                        {/* Default roles (always on) */}
                        {DEFAULT_ROLES.map((info) => (
                            <button
                                key={info.key}
                                className={`lobby-role lobby-role-active lobby-role-locked ${info.team === 'good' ? 'lobby-role-good' : 'lobby-role-evil'}`}
                                disabled={true}
                                title={info.desc}
                            >
                                <div className="lobby-role-header">
                                    <span className="lobby-role-name">{info.name}</span>
                                    <span className={`badge ${info.team === 'good' ? 'badge-good' : 'badge-evil'}`}>
                                        {info.team}
                                    </span>
                                </div>
                                <p className="lobby-role-desc">{info.desc}</p>
                                <p className="lobby-role-dep">🔒 Always Enabled</p>
                                <div className="lobby-role-toggle lobby-role-toggle-on lobby-role-toggle-locked">
                                    <div className="lobby-role-toggle-dot" />
                                </div>
                            </button>
                        ))}

                        {/* Optional roles */}
                        {Object.entries(ROLE_INFO).map(([key, info]) => {
                            const enabled = enabledRoles[key];
                            return (
                                <button
                                    key={key}
                                    className={`lobby-role ${enabled ? 'lobby-role-active' : ''} ${info.team === 'good' ? 'lobby-role-good' : 'lobby-role-evil'
                                        }`}
                                    onClick={() => isHost && toggleRole(key)}
                                    disabled={!isHost}
                                    title={info.desc}
                                >
                                    <div className="lobby-role-header">
                                        <span className="lobby-role-name">{info.name}</span>
                                        <span className={`badge ${info.team === 'good' ? 'badge-good' : 'badge-evil'}`}>
                                            {info.team}
                                        </span>
                                    </div>
                                    <p className="lobby-role-desc">{info.desc}</p>
                                    {info.dep && enabled && (
                                        <p className="lobby-role-dep">🔗 {info.dep}</p>
                                    )}
                                    <div className={`lobby-role-toggle ${enabled ? 'lobby-role-toggle-on' : ''}`}>
                                        <div className="lobby-role-toggle-dot" />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Start Button */}
                {isHost && (
                    <div className="lobby-start animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                        <button
                            className="btn btn-gold btn-lg lobby-start-btn"
                            onClick={handleStart}
                            disabled={!canStart}
                        >
                            {canStart ? '⚔ Start Game' : `Need ${5 - playerCount} more players`}
                        </button>
                    </div>
                )}

                {!isHost && (
                    <div className="lobby-waiting animate-pulse">
                        Waiting for host to start the game...
                    </div>
                )}
            </div>
        </div>
    );
}
