import React, { useState, useEffect } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import Countdown from './components/Countdown';
import RoleReveal from './components/RoleReveal';
import GameBoard from './components/GameBoard';
import RulesDrawer from './components/RulesDrawer';
import MiniGame from './components/MiniGame';
import './App.css';

function AppContent() {
    const { phase, roomCode, isHost, miniGameEnabled, toggleMiniGame } = useGame();
    const [showRules, setShowRules] = useState(false);
    const [showMiniGame, setShowMiniGame] = useState(false);
    const [miniGameHighScore, setMiniGameHighScore] = useState(0);
    const [miniGameDisabledMsg, setMiniGameDisabledMsg] = useState(false);

    // Auto-close mini-game if host disables it
    useEffect(() => {
        if (!miniGameEnabled && showMiniGame) {
            setShowMiniGame(false);
            setMiniGameDisabledMsg(true);
            setTimeout(() => setMiniGameDisabledMsg(false), 3000);
        }
    }, [miniGameEnabled, showMiniGame]);

    // Not in a room → show Home
    if (!roomCode || !phase) {
        return (
            <>
                <Home />
                <div className="global-bottom-buttons">
                    <button className="global-rules-btn btn btn-ghost btn-sm" onClick={() => setShowRules(true)}>
                        📖 How to Play
                    </button>
                </div>
                {showRules && <RulesDrawer onClose={() => setShowRules(false)} />}
            </>
        );
    }

    // Determine the main content view
    let content;
    switch (phase) {
        case 'LOBBY':
            content = <Lobby />;
            break;
        case 'COUNTDOWN':
            content = <Countdown />;
            break;
        case 'ROLE_REVEAL':
            content = <RoleReveal />;
            break;
        case 'TEAM_PROPOSAL':
        case 'VOTING':
        case 'QUEST':
        case 'ASSASSINATION':
        case 'GAME_OVER':
            content = <GameBoard />;
            break;
        default:
            content = <Home />;
    }

    return (
        <>
            {content}
            {/* Persistent buttons — available on ALL screens */}
            {phase !== 'COUNTDOWN' && (
                <div className="global-bottom-buttons">
                    {miniGameEnabled && (
                        <button className="global-minigame-btn btn btn-ghost btn-sm" onClick={() => setShowMiniGame(true)}>
                            🎮 Bored? Play Brainrot
                        </button>
                    )}
                    {isHost && (
                        <button
                            className={`global-toggle-minigame-btn btn btn-ghost btn-sm ${!miniGameEnabled ? 'minigame-disabled' : ''}`}
                            onClick={() => toggleMiniGame()}
                            title={miniGameEnabled ? 'Disable mini-game for all players' : 'Enable mini-game for all players'}
                        >
                            {miniGameEnabled ? '🚫 Off' : '✅ On'}
                        </button>
                    )}
                    <button className="global-rules-btn btn btn-ghost btn-sm" onClick={() => setShowRules(true)}>
                        📖 How to Play
                    </button>
                </div>
            )}
            {showRules && <RulesDrawer onClose={() => setShowRules(false)} />}
            {showMiniGame && miniGameEnabled && (
                <MiniGame
                    onClose={() => setShowMiniGame(false)}
                    highScore={miniGameHighScore}
                    onNewHighScore={(score) => setMiniGameHighScore(score)}
                />
            )}
            {/* Toast: host disabled the mini-game */}
            {miniGameDisabledMsg && (
                <div className="minigame-disabled-toast animate-fade-in">
                    🚫 The host has disabled the mini-game
                </div>
            )}
        </>
    );
}

export default function App() {
    return (
        <GameProvider>
            <AppContent />
        </GameProvider>
    );
}
