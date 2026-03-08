import React, { useRef, useEffect, useState, useCallback } from 'react';
import './MiniGame.css';

const CANVAS_W = 320;
const CANVAS_H = 480;

// Physics
const GRAVITY = 0.65;
const FLAP_STRENGTH = -9;
const SKULL_SIZE = 28;

// Pipes
const PIPE_WIDTH = 48;
const PIPE_GAP = 140;
const PIPE_SPEED = 4.5;
const PIPE_SPAWN_INTERVAL = 60; // frames

// Colors matching Avalon theme
const COLORS = {
    bg: '#06060c',
    pipe: '#1a1a33',
    pipeEdge: '#4f8cff',
    pipeShadow: 'rgba(79, 140, 255, 0.15)',
    scoreText: '#ffd700',
    gameOverBg: 'rgba(6, 6, 12, 0.88)',
    gameOverText: '#e8e8f0',
    highScoreText: '#4f8cff',
    groundLine: 'rgba(79, 140, 255, 0.2)',
    particle: '#ff4f6d',
};

export default function MiniGame({ onClose, highScore, onNewHighScore }) {
    const canvasRef = useRef(null);
    const gameStateRef = useRef(null);
    const animFrameRef = useRef(null);
    const lastFlapRef = useRef(0);
    const [displayScore, setDisplayScore] = useState(0);
    const [gameOver, setGameOver] = useState(false);
    const [started, setStarted] = useState(false);

    // Initialize game state
    const initGame = useCallback(() => {
        gameStateRef.current = {
            skull: { x: 80, y: CANVAS_H / 2, vy: 0, rotation: 0 },
            pipes: [],
            score: 0,
            frameCount: 0,
            gameOver: false,
            started: false,
            particles: [],
        };
        setDisplayScore(0);
        setGameOver(false);
        setStarted(false);
    }, []);

    // Flap action
    const flap = useCallback(() => {
        const now = Date.now();
        if (now - lastFlapRef.current < 150) return; // strong 150ms debounce to prevent double fast fires/ghost clicks
        lastFlapRef.current = now;

        const gs = gameStateRef.current;
        if (!gs) return;

        if (gs.gameOver) {
            initGame();
            return;
        }

        if (!gs.started) {
            gs.started = true;
            setStarted(true);
        }

        gs.skull.vy = FLAP_STRENGTH;
    }, [initGame]);

    // Spawn particles on death
    const spawnParticles = useCallback((x, y) => {
        const gs = gameStateRef.current;
        for (let i = 0; i < 12; i++) {
            gs.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6,
                life: 1,
                size: Math.random() * 4 + 2,
            });
        }
    }, []);

    // Main game loop
    useEffect(() => {
        initGame();
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        const loop = () => {
            const gs = gameStateRef.current;
            if (!gs) return;

            // ── UPDATE ──
            if (gs.started && !gs.gameOver) {
                // Skull physics
                gs.skull.vy += GRAVITY;
                gs.skull.y += gs.skull.vy;
                gs.skull.rotation = Math.min(gs.skull.vy * 3, 70);

                // Spawn pipes
                gs.frameCount++;
                if (gs.frameCount % PIPE_SPAWN_INTERVAL === 0) {
                    const gapY = Math.random() * (CANVAS_H - PIPE_GAP - 120) + 60;
                    gs.pipes.push({ x: CANVAS_W + PIPE_WIDTH, gapY, scored: false });
                }

                // Move pipes
                for (let i = gs.pipes.length - 1; i >= 0; i--) {
                    gs.pipes[i].x -= PIPE_SPEED;

                    // Score
                    if (!gs.pipes[i].scored && gs.pipes[i].x + PIPE_WIDTH < gs.skull.x) {
                        gs.pipes[i].scored = true;
                        gs.score++;
                        setDisplayScore(gs.score);
                    }

                    // Remove off-screen pipes
                    if (gs.pipes[i].x < -PIPE_WIDTH) {
                        gs.pipes.splice(i, 1);
                    }
                }

                // Collision detection
                const s = gs.skull;
                const r = SKULL_SIZE / 2;

                // Floor / ceiling
                if (s.y - r < 0 || s.y + r > CANVAS_H) {
                    gs.gameOver = true;
                }

                // Pipe collision
                for (const pipe of gs.pipes) {
                    if (s.x + r > pipe.x && s.x - r < pipe.x + PIPE_WIDTH) {
                        if (s.y - r < pipe.gapY || s.y + r > pipe.gapY + PIPE_GAP) {
                            gs.gameOver = true;
                        }
                    }
                }

                if (gs.gameOver) {
                    spawnParticles(s.x, s.y);
                    setGameOver(true);
                    if (gs.score > highScore) {
                        onNewHighScore(gs.score);
                    }
                }
            }

            // Update particles
            for (let i = gs.particles.length - 1; i >= 0; i--) {
                const p = gs.particles[i];
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.15;
                p.life -= 0.025;
                if (p.life <= 0) gs.particles.splice(i, 1);
            }

            // ── DRAW ──
            // Background
            ctx.fillStyle = COLORS.bg;
            ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

            // Background grid lines (subtle)
            ctx.strokeStyle = 'rgba(79, 140, 255, 0.03)';
            ctx.lineWidth = 1;
            for (let y = 0; y < CANVAS_H; y += 40) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(CANVAS_W, y);
                ctx.stroke();
            }

            // Ground line
            ctx.strokeStyle = COLORS.groundLine;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, CANVAS_H - 1);
            ctx.lineTo(CANVAS_W, CANVAS_H - 1);
            ctx.stroke();

            // Ceiling line
            ctx.beginPath();
            ctx.moveTo(0, 1);
            ctx.lineTo(CANVAS_W, 1);
            ctx.stroke();

            // Pipes
            for (const pipe of gs.pipes) {
                // Top pipe
                const topGrad = ctx.createLinearGradient(pipe.x, 0, pipe.x + PIPE_WIDTH, 0);
                topGrad.addColorStop(0, '#111133');
                topGrad.addColorStop(0.5, '#1a1a44');
                topGrad.addColorStop(1, '#111133');
                ctx.fillStyle = topGrad;
                ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.gapY);

                // Bottom pipe
                ctx.fillRect(pipe.x, pipe.gapY + PIPE_GAP, PIPE_WIDTH, CANVAS_H - pipe.gapY - PIPE_GAP);

                // Pipe edges (glowing)
                ctx.strokeStyle = COLORS.pipeEdge;
                ctx.lineWidth = 2;
                ctx.shadowColor = COLORS.pipeEdge;
                ctx.shadowBlur = 8;

                // Top pipe bottom edge
                ctx.beginPath();
                ctx.moveTo(pipe.x, pipe.gapY);
                ctx.lineTo(pipe.x + PIPE_WIDTH, pipe.gapY);
                ctx.stroke();

                // Bottom pipe top edge
                ctx.beginPath();
                ctx.moveTo(pipe.x, pipe.gapY + PIPE_GAP);
                ctx.lineTo(pipe.x + PIPE_WIDTH, pipe.gapY + PIPE_GAP);
                ctx.stroke();

                // Side edges
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(pipe.x, 0);
                ctx.lineTo(pipe.x, pipe.gapY);
                ctx.moveTo(pipe.x + PIPE_WIDTH, 0);
                ctx.lineTo(pipe.x + PIPE_WIDTH, pipe.gapY);
                ctx.moveTo(pipe.x, pipe.gapY + PIPE_GAP);
                ctx.lineTo(pipe.x, CANVAS_H);
                ctx.moveTo(pipe.x + PIPE_WIDTH, pipe.gapY + PIPE_GAP);
                ctx.lineTo(pipe.x + PIPE_WIDTH, CANVAS_H);
                ctx.stroke();

                ctx.shadowBlur = 0;
            }

            // Particles
            for (const p of gs.particles) {
                ctx.globalAlpha = p.life;
                ctx.fillStyle = COLORS.particle;
                ctx.shadowColor = COLORS.particle;
                ctx.shadowBlur = 6;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.globalAlpha = 1;
            }

            // Skull (Safari explicit color reset)
            ctx.save();
            ctx.translate(gs.skull.x, gs.skull.y);
            ctx.rotate((gs.skull.rotation * Math.PI) / 180);
            ctx.font = `${SKULL_SIZE}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#ffffff'; // explicitly reset so Safari doesn't inherit pipe gradients on emoji
            ctx.fillText('💀', 0, 0);
            ctx.restore();

            // Score (top center)
            if (gs.started && !gs.gameOver) {
                ctx.font = 'bold 36px "Inter", sans-serif';
                ctx.fillStyle = COLORS.scoreText;
                ctx.textAlign = 'center';
                ctx.shadowColor = 'rgba(255, 215, 0, 0.5)';
                ctx.shadowBlur = 12;
                ctx.fillText(gs.score, CANVAS_W / 2, 50);
                ctx.shadowBlur = 0;
            }

            // Start screen
            if (!gs.started) {
                ctx.fillStyle = 'rgba(6, 6, 12, 0.5)';
                ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

                ctx.font = '44px serif';
                ctx.textAlign = 'center';
                ctx.fillText('💀', CANVAS_W / 2, CANVAS_H / 2 - 50);

                ctx.font = 'bold 20px "Inter", sans-serif';
                ctx.fillStyle = COLORS.scoreText;
                ctx.shadowColor = 'rgba(255, 215, 0, 0.4)';
                ctx.shadowBlur = 10;
                ctx.fillText('SKULL DODGE', CANVAS_W / 2, CANVAS_H / 2 + 5);
                ctx.shadowBlur = 0;

                ctx.font = '14px "Inter", sans-serif';
                ctx.fillStyle = '#8888aa';
                ctx.fillText('Tap or press Space to start', CANVAS_W / 2, CANVAS_H / 2 + 35);

                // Bouncing skull animation
                gs.skull.y = CANVAS_H / 2 - 50 + Math.sin(Date.now() / 300) * 8;
            }

            // Game over screen
            if (gs.gameOver) {
                ctx.fillStyle = COLORS.gameOverBg;
                ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

                ctx.font = '40px serif';
                ctx.textAlign = 'center';
                ctx.fillText('☠️', CANVAS_W / 2, CANVAS_H / 2 - 65);

                ctx.font = 'bold 22px "Inter", sans-serif';
                ctx.fillStyle = COLORS.gameOverText;
                ctx.fillText('WASTED', CANVAS_W / 2, CANVAS_H / 2 - 20);

                ctx.font = 'bold 32px "Inter", sans-serif';
                ctx.fillStyle = COLORS.scoreText;
                ctx.shadowColor = 'rgba(255, 215, 0, 0.5)';
                ctx.shadowBlur = 12;
                ctx.fillText(gs.score, CANVAS_W / 2, CANVAS_H / 2 + 22);
                ctx.shadowBlur = 0;

                ctx.font = '13px "Inter", sans-serif';
                ctx.fillStyle = COLORS.highScoreText;
                const best = Math.max(gs.score, highScore);
                ctx.fillText(`🏆 Best: ${best}`, CANVAS_W / 2, CANVAS_H / 2 + 52);

                ctx.font = '13px "Inter", sans-serif';
                ctx.fillStyle = '#555577';
                ctx.fillText('Tap to retry', CANVAS_W / 2, CANVAS_H / 2 + 80);
            }

            animFrameRef.current = requestAnimationFrame(loop);
        };

        animFrameRef.current = requestAnimationFrame(loop);

        return () => {
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        };
    }, [initGame, highScore, onNewHighScore, spawnParticles]);

    // Input handlers
    useEffect(() => {
        const handleKey = (e) => {
            if (e.code === 'Space' || e.key === ' ') {
                e.preventDefault();
                flap();
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [flap]);

    return (
        <div className="minigame-overlay" onClick={(e) => e.stopPropagation()}>
            <div className="minigame-container animate-fade-in-scale">
                {/* Header */}
                <div className="minigame-header">
                    <div className="minigame-title">
                        <span>💀 Skull Dodge</span>
                        {highScore > 0 && (
                            <span className="minigame-highscore">🏆 {highScore}</span>
                        )}
                    </div>
                    <button className="minigame-close" onClick={onClose} title="Close">
                        ✕
                    </button>
                </div>

                {/* Canvas */}
                <canvas
                    ref={canvasRef}
                    width={CANVAS_W}
                    height={CANVAS_H}
                    className="minigame-canvas"
                    style={{ touchAction: 'none' }}
                    onTouchStart={(e) => { e.preventDefault(); flap(); }}
                    onMouseDown={(e) => { e.preventDefault(); flap(); }}
                />

                {/* Footer hint */}
                <div className="minigame-footer">
                    <span>Your game is still running — this is just for fun! 🎮</span>
                </div>
            </div>
        </div>
    );
}
