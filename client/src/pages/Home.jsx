import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import './Home.css';

export default function Home() {
    const { createRoom, joinRoom } = useGame();
    const [mode, setMode] = useState(null); // 'create' | 'join'
    const [name, setName] = useState('');
    const [roomCode, setRoomCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleCreate = () => {
        if (!name.trim()) return setError('Enter your name');
        setLoading(true);
        setError('');
        createRoom(name.trim(), (res) => {
            setLoading(false);
            if (res.error) setError(res.error);
        });
    };

    const handleJoin = () => {
        if (!name.trim()) return setError('Enter your name');
        if (!roomCode.trim()) return setError('Enter a room code');
        setLoading(true);
        setError('');
        joinRoom(roomCode.trim(), name.trim(), (res) => {
            setLoading(false);
            if (res.error) setError(res.error);
        });
    };

    return (
        <div className="page-center">
            <div className="app-background" />
            <div className="home-container">
                {/* Logo */}
                <div className="home-logo animate-fade-in-up">
                    <div className="home-logo-icon">⚔</div>
                    <h1 className="heading-display home-title">AVALON</h1>
                    <p className="home-subtitle">The Resistance</p>
                </div>

                {/* Action Area */}
                {!mode ? (
                    <div className="home-actions animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                        <button className="btn btn-primary btn-lg home-btn" onClick={() => setMode('create')}>
                            Create Game
                        </button>
                        <button className="btn btn-ghost btn-lg home-btn" onClick={() => setMode('join')}>
                            Join Game
                        </button>
                    </div>
                ) : (
                    <div className="home-form glass-card animate-fade-in-scale">
                        <h2 className="home-form-title">
                            {mode === 'create' ? 'Create a New Game' : 'Join a Game'}
                        </h2>

                        <div className="home-form-fields">
                            <input
                                className="input"
                                type="text"
                                placeholder="Your name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                maxLength={20}
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        mode === 'create' ? handleCreate() : handleJoin();
                                    }
                                }}
                            />

                            {mode === 'join' && (
                                <input
                                    className="input"
                                    type="text"
                                    placeholder="Room code"
                                    value={roomCode}
                                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                                    maxLength={6}
                                    style={{ textTransform: 'uppercase', letterSpacing: '0.2em', textAlign: 'center' }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleJoin();
                                    }}
                                />
                            )}
                        </div>

                        {error && <p className="home-error">{error}</p>}

                        <div className="home-form-actions">
                            <button
                                className="btn btn-primary btn-lg"
                                onClick={mode === 'create' ? handleCreate : handleJoin}
                                disabled={loading}
                            >
                                {loading ? 'Connecting...' : mode === 'create' ? 'Create Room' : 'Join Room'}
                            </button>
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => { setMode(null); setError(''); }}
                            >
                                ← Back
                            </button>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <p className="home-footer animate-fade-in" style={{ animationDelay: '0.5s' }}>
                    5–10 Players • Social Deduction
                </p>
            </div>
        </div>
    );
}
