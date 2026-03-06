const { v4: uuidv4 } = require('crypto');
const { PHASES } = require('./constants');

function generateId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// ─── Auto-advance helpers ────────────────────────────────────────────
const VOTE_RESULT_DELAY = 4000;   // Show vote result for 4 seconds
const QUEST_RESULT_DELAY = 5000;  // Show quest result for 5 seconds

function resolveVotesAndBroadcast(io, room) {
    const result = room.resolveVotes();

    io.to(room.code).emit('vote-result', {
        votes: room.voteHistory[room.voteHistory.length - 1].votes,
        approved: result.approved,
        approvals: result.approvals,
        rejections: result.rejections,
        rejectionTrack: room.rejectionTrack,
        gameOver: result.gameOver,
        winner: result.winner,
        winReason: result.winReason,
        state: room.getPublicState(),
    });

    if (result.gameOver) {
        setTimeout(() => {
            io.to(room.code).emit('game-over', {
                winner: room.winner,
                winReason: room.winReason,
                reveal: room.getFullReveal(),
                state: room.getPublicState(),
            });
        }, VOTE_RESULT_DELAY);
    } else {
        // Auto-advance to next phase after delay
        setTimeout(() => {
            io.to(room.code).emit('phase-change', {
                phase: room.phase,
                state: room.getPublicState(),
            });
        }, VOTE_RESULT_DELAY);
    }
}

function resolveQuestAndBroadcast(io, room) {
    const result = room.resolveQuest();

    io.to(room.code).emit('quest-result', {
        passed: result.passed,
        failCount: result.failCount,
        successCount: result.successCount,
        requiresTwoFails: result.requiresTwoFails,
        goToAssassination: result.goToAssassination,
        gameOver: result.gameOver,
        winner: result.winner,
        winReason: result.winReason,
        state: room.getPublicState(),
    });

    if (result.gameOver && !result.goToAssassination) {
        setTimeout(() => {
            io.to(room.code).emit('game-over', {
                winner: room.winner,
                winReason: room.winReason,
                reveal: room.getFullReveal(),
                state: room.getPublicState(),
            });
        }, QUEST_RESULT_DELAY);
    } else {
        // Auto-advance: to assassination or next team proposal
        setTimeout(() => {
            io.to(room.code).emit('phase-change', {
                phase: room.phase,
                state: room.getPublicState(),
            });
        }, QUEST_RESULT_DELAY);
    }
}

function setupSocketHandlers(io, roomManager) {
    io.on('connection', (socket) => {
        console.log(`[Socket] Connected: ${socket.id}`);

        // ═══════════════════════════════════════════════════════════════
        //  LOBBY: Create Room
        // ═══════════════════════════════════════════════════════════════
        socket.on('create-room', ({ playerName }, callback) => {
            try {
                if (!playerName || playerName.trim().length === 0) {
                    return callback({ error: 'Name is required' });
                }
                if (playerName.trim().length > 20) {
                    return callback({ error: 'Name must be 20 characters or less' });
                }

                const playerId = generateId();
                const player = { id: playerId, name: playerName.trim(), socketId: socket.id };
                const room = roomManager.createRoom(player, socket.id);

                socket.join(room.code);
                callback({ success: true, roomCode: room.code, playerId, state: room.getPublicState() });
            } catch (err) {
                callback({ error: err.message });
            }
        });

        // ═══════════════════════════════════════════════════════════════
        //  LOBBY: Join Room
        // ═══════════════════════════════════════════════════════════════
        socket.on('join-room', ({ roomCode, playerName }, callback) => {
            try {
                if (!playerName || playerName.trim().length === 0) {
                    return callback({ error: 'Name is required' });
                }
                if (!roomCode || roomCode.trim().length === 0) {
                    return callback({ error: 'Room code is required' });
                }

                const playerId = generateId();
                const player = { id: playerId, name: playerName.trim(), socketId: socket.id };
                const room = roomManager.joinRoom(roomCode.trim().toUpperCase(), player, socket.id);

                socket.join(room.code);
                callback({ success: true, roomCode: room.code, playerId, state: room.getPublicState() });

                // Notify other players
                socket.to(room.code).emit('player-joined', {
                    player: { id: playerId, name: playerName.trim() },
                    state: room.getPublicState(),
                });
            } catch (err) {
                callback({ error: err.message });
            }
        });

        // ═══════════════════════════════════════════════════════════════
        //  LOBBY: Toggle Role
        // ═══════════════════════════════════════════════════════════════
        socket.on('toggle-role', ({ roleKey }, callback) => {
            try {
                const room = roomManager.getRoomBySocket(socket.id);
                if (!room) return callback?.({ error: 'Not in a room' });

                const mapping = roomManager.getPlayerMapping(socket.id);
                if (mapping.playerId !== room.hostId) {
                    return callback?.({ error: 'Only the host can toggle roles' });
                }

                room.toggleRole(roleKey);
                io.to(room.code).emit('roles-updated', {
                    enabledRoles: room.enabledRoles,
                    state: room.getPublicState(),
                });
                callback?.({ success: true });
            } catch (err) {
                callback?.({ error: err.message });
            }
        });

        // ═══════════════════════════════════════════════════════════════
        //  LOBBY: Start Game
        // ═══════════════════════════════════════════════════════════════
        socket.on('start-game', (_, callback) => {
            try {
                const room = roomManager.getRoomBySocket(socket.id);
                if (!room) return callback?.({ error: 'Not in a room' });

                const mapping = roomManager.getPlayerMapping(socket.id);
                if (mapping.playerId !== room.hostId) {
                    return callback?.({ error: 'Only the host can start the game' });
                }

                room.startGame();

                // Broadcast countdown start
                io.to(room.code).emit('game-countdown', {
                    countdownStartTime: room.countdownStartTime,
                    state: room.getPublicState(),
                });

                // After countdown (4 seconds: 3, 2, 1, GO), transition to role reveal
                setTimeout(() => {
                    room.transitionToRoleReveal();

                    // Send each player their private role info
                    room.players.forEach(player => {
                        const roleInfo = room.getRoleInfoForPlayer(player.id);
                        // Find socket for this player
                        for (const [sId, m] of roomManager.playerRoomMap.entries()) {
                            if (m.playerId === player.id && m.roomCode === room.code) {
                                io.to(sId).emit('role-reveal', {
                                    roleInfo,
                                    state: room.getPublicState(),
                                });
                                break;
                            }
                        }
                    });
                }, 4500);

                callback?.({ success: true });
            } catch (err) {
                callback?.({ error: err.message });
            }
        });

        // ═══════════════════════════════════════════════════════════════
        //  GAME: Ready (after role reveal)
        // ═══════════════════════════════════════════════════════════════
        socket.on('player-ready', (_, callback) => {
            try {
                const room = roomManager.getRoomBySocket(socket.id);
                if (!room) return callback?.({ error: 'Not in a room' });

                const mapping = roomManager.getPlayerMapping(socket.id);
                if (!room._readyPlayers) room._readyPlayers = new Set();
                room._readyPlayers.add(mapping.playerId);

                io.to(room.code).emit('player-ready-update', {
                    readyCount: room._readyPlayers.size,
                    totalPlayers: room.players.length,
                });

                // All ready → move to team proposal
                if (room._readyPlayers.size >= room.players.length) {
                    room.transitionToTeamProposal();
                    delete room._readyPlayers;
                    io.to(room.code).emit('phase-change', {
                        phase: room.phase,
                        state: room.getPublicState(),
                    });
                }

                callback?.({ success: true });
            } catch (err) {
                callback?.({ error: err.message });
            }
        });

        // ═══════════════════════════════════════════════════════════════
        //  GAME: Propose Team
        // ═══════════════════════════════════════════════════════════════
        socket.on('propose-team', ({ team }, callback) => {
            try {
                const room = roomManager.getRoomBySocket(socket.id);
                if (!room) return callback?.({ error: 'Not in a room' });

                const mapping = roomManager.getPlayerMapping(socket.id);
                room.proposeTeam(mapping.playerId, team);

                // Leader auto-votes approve
                room.submitVote(mapping.playerId, 'approve');

                io.to(room.code).emit('team-proposed', {
                    leader: room.getCurrentLeader(),
                    team: room.proposedTeam,
                    state: room.getPublicState(),
                });

                // Broadcast that leader has already voted
                io.to(room.code).emit('vote-submitted', {
                    votedCount: Object.keys(room.votes).length,
                    totalPlayers: room.players.length,
                });

                // Check if all votes are in (possible in small games if leader is the only player... edge case)
                if (room.allVotesIn()) {
                    resolveVotesAndBroadcast(io, room, roomManager);
                }

                callback?.({ success: true });
            } catch (err) {
                callback?.({ error: err.message });
            }
        });

        // ═══════════════════════════════════════════════════════════════
        //  GAME: Submit Vote
        // ═══════════════════════════════════════════════════════════════
        socket.on('submit-vote', ({ vote }, callback) => {
            try {
                const room = roomManager.getRoomBySocket(socket.id);
                if (!room) return callback?.({ error: 'Not in a room' });

                const mapping = roomManager.getPlayerMapping(socket.id);
                room.submitVote(mapping.playerId, vote);

                // Notify that someone voted
                io.to(room.code).emit('vote-submitted', {
                    votedCount: Object.keys(room.votes).length,
                    totalPlayers: room.players.length,
                });

                // All votes in → resolve
                if (room.allVotesIn()) {
                    resolveVotesAndBroadcast(io, room, roomManager);
                }

                callback?.({ success: true });
            } catch (err) {
                callback?.({ error: err.message });
            }
        });

        // ═══════════════════════════════════════════════════════════════
        //  GAME: Submit Quest Action
        // ═══════════════════════════════════════════════════════════════
        socket.on('submit-quest-action', ({ action }, callback) => {
            try {
                const room = roomManager.getRoomBySocket(socket.id);
                if (!room) return callback?.({ error: 'Not in a room' });

                const mapping = roomManager.getPlayerMapping(socket.id);
                room.submitQuestAction(mapping.playerId, action);

                // Notify progress
                io.to(room.code).emit('quest-action-submitted', {
                    submittedCount: Object.keys(room.questActions).length,
                    totalTeamSize: room.proposedTeam.length,
                });

                // All actions in → resolve
                if (room.allQuestActionsIn()) {
                    resolveQuestAndBroadcast(io, room, roomManager);
                }

                callback?.({ success: true });
            } catch (err) {
                callback?.({ error: err.message });
            }
        });

        // ═══════════════════════════════════════════════════════════════
        //  GAME: Assassinate
        // ═══════════════════════════════════════════════════════════════
        socket.on('assassinate', ({ targetId }, callback) => {
            try {
                const room = roomManager.getRoomBySocket(socket.id);
                if (!room) return callback?.({ error: 'Not in a room' });

                const mapping = roomManager.getPlayerMapping(socket.id);
                const result = room.assassinate(mapping.playerId, targetId);

                io.to(room.code).emit('assassination-result', {
                    ...result,
                    reveal: room.getFullReveal(),
                    state: room.getPublicState(),
                });

                io.to(room.code).emit('game-over', {
                    winner: room.winner,
                    winReason: room.winReason,
                    reveal: room.getFullReveal(),
                    state: room.getPublicState(),
                });

                callback?.({ success: true });
            } catch (err) {
                callback?.({ error: err.message });
            }
        });

        // ═══════════════════════════════════════════════════════════════
        //  GAME: Return to Lobby
        // ═══════════════════════════════════════════════════════════════
        socket.on('return-to-lobby', (_, callback) => {
            try {
                const room = roomManager.getRoomBySocket(socket.id);
                if (!room) return callback?.({ error: 'Not in a room' });

                const mapping = roomManager.getPlayerMapping(socket.id);
                if (mapping.playerId !== room.hostId) {
                    return callback?.({ error: 'Only the host can return to lobby' });
                }

                room.resetForNewGame();

                io.to(room.code).emit('returned-to-lobby', {
                    state: room.getPublicState(),
                });

                callback?.({ success: true });
            } catch (err) {
                callback?.({ error: err.message });
            }
        });

        // ═══════════════════════════════════════════════════════════════
        //  GAME: Phase advance (after viewing results)
        // ═══════════════════════════════════════════════════════════════
        socket.on('advance-phase', (_, callback) => {
            try {
                const room = roomManager.getRoomBySocket(socket.id);
                if (!room) return callback?.({ error: 'Not in a room' });

                // Send current state to advance UI
                io.to(room.code).emit('phase-change', {
                    phase: room.phase,
                    state: room.getPublicState(),
                });

                callback?.({ success: true });
            } catch (err) {
                callback?.({ error: err.message });
            }
        });

        // ═══════════════════════════════════════════════════════════════
        //  GAME: End Game (host only, from any phase)
        // ═══════════════════════════════════════════════════════════════
        socket.on('end-game', (_, callback) => {
            try {
                const room = roomManager.getRoomBySocket(socket.id);
                if (!room) return callback?.({ error: 'Not in a room' });

                const mapping = roomManager.getPlayerMapping(socket.id);
                if (mapping.playerId !== room.hostId) {
                    return callback?.({ error: 'Only the host can end the game' });
                }

                room.resetForNewGame();

                io.to(room.code).emit('returned-to-lobby', {
                    state: room.getPublicState(),
                });

                callback?.({ success: true });
            } catch (err) {
                callback?.({ error: err.message });
            }
        });

        // ═══════════════════════════════════════════════════════════════
        //  GAME: Restart Game (host only, starts fresh with same players)
        // ═══════════════════════════════════════════════════════════════
        socket.on('restart-game', (_, callback) => {
            try {
                const room = roomManager.getRoomBySocket(socket.id);
                if (!room) return callback?.({ error: 'Not in a room' });

                const mapping = roomManager.getPlayerMapping(socket.id);
                if (mapping.playerId !== room.hostId) {
                    return callback?.({ error: 'Only the host can restart the game' });
                }

                // Reset and immediately start a new game
                room.resetForNewGame();
                room.startGame();

                // Broadcast countdown
                io.to(room.code).emit('game-countdown', {
                    countdownStartTime: room.countdownStartTime,
                    state: room.getPublicState(),
                });

                // After countdown, transition to role reveal
                setTimeout(() => {
                    room.transitionToRoleReveal();
                    room.players.forEach(player => {
                        const roleInfo = room.getRoleInfoForPlayer(player.id);
                        for (const [sId, m] of roomManager.playerRoomMap.entries()) {
                            if (m.playerId === player.id && m.roomCode === room.code) {
                                io.to(sId).emit('role-reveal', {
                                    roleInfo,
                                    state: room.getPublicState(),
                                });
                                break;
                            }
                        }
                    });
                }, 4500);

                callback?.({ success: true });
            } catch (err) {
                callback?.({ error: err.message });
            }
        });

        // ═══════════════════════════════════════════════════════════════
        //  MINI-GAME: Toggle (host only)
        // ═══════════════════════════════════════════════════════════════
        socket.on('toggle-minigame', (_, callback) => {
            try {
                const room = roomManager.getRoomBySocket(socket.id);
                if (!room) return callback?.({ error: 'Not in a room' });

                const mapping = roomManager.getPlayerMapping(socket.id);
                if (mapping.playerId !== room.hostId) {
                    return callback?.({ error: 'Only the host can toggle the mini-game' });
                }

                room.miniGameEnabled = !room.miniGameEnabled;
                io.to(room.code).emit('minigame-toggled', {
                    miniGameEnabled: room.miniGameEnabled,
                });
                callback?.({ success: true, miniGameEnabled: room.miniGameEnabled });
            } catch (err) {
                callback?.({ error: err.message });
            }
        });

        // ═══════════════════════════════════════════════════════════════
        //  Disconnect
        // ═══════════════════════════════════════════════════════════════
        socket.on('disconnect', () => {
            console.log(`[Socket] Disconnected: ${socket.id}`);
            const result = roomManager.leaveRoom(socket.id);
            if (result && result.room) {
                io.to(result.roomCode).emit('player-left', {
                    state: result.room.getPublicState(),
                });
            }
        });

        // ═══════════════════════════════════════════════════════════════
        //  Reconnect
        // ═══════════════════════════════════════════════════════════════
        socket.on('reconnect-player', ({ roomCode, playerId }, callback) => {
            try {
                const room = roomManager.reconnectPlayer(socket.id, roomCode.toUpperCase(), playerId);
                if (!room) return callback?.({ error: 'Room not found' });

                socket.join(room.code);

                const roleInfo = room.phase !== PHASES.LOBBY && room.phase !== PHASES.COUNTDOWN
                    ? room.getRoleInfoForPlayer(playerId)
                    : null;

                callback?.({
                    success: true,
                    state: room.getPublicState(),
                    roleInfo,
                });
            } catch (err) {
                callback?.({ error: err.message });
            }
        });
    });
}

module.exports = setupSocketHandlers;
