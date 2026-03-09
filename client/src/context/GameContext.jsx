import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import socket from '../socket';

const GameContext = createContext(null);

const initialState = {
    connected: false,
    playerId: null,
    playerName: null,
    roomCode: null,
    phase: null,
    players: [],
    hostId: null,
    enabledRoles: {},
    currentLeader: null,
    currentQuestIndex: 0,
    currentQuestTeamSize: 0,
    rejectionTrack: 0,
    maxRejections: 5,
    questResults: [],
    questTeamSizes: [],
    proposedTeam: [],
    voteHistory: [],
    winner: null,
    winReason: null,
    roleInfo: null,
    countdownStartTime: null,
    // UI state
    votes: null,
    voteResult: null,
    questResult: null,
    assassinationResult: null,
    fullReveal: null,
    readyCount: 0,
    votedCount: 0,
    questSubmittedCount: 0,
    error: null,
    showingResult: null, // 'vote' | 'quest' | null
    miniGameEnabled: true,
};

function reducer(state, action) {
    switch (action.type) {
        case 'SET_CONNECTED':
            return { ...state, connected: action.payload };
        case 'SET_PLAYER':
            return { ...state, playerId: action.payload.playerId, playerName: action.payload.playerName };
        case 'SET_ROOM':
            return { ...state, roomCode: action.payload };
        case 'UPDATE_STATE':
            return {
                ...state,
                phase: action.payload.phase,
                players: action.payload.players || state.players,
                hostId: action.payload.hostId || state.hostId,
                enabledRoles: action.payload.enabledRoles || state.enabledRoles,
                currentLeader: action.payload.currentLeader || state.currentLeader,
                currentQuestIndex: action.payload.currentQuestIndex ?? state.currentQuestIndex,
                currentQuestTeamSize: action.payload.currentQuestTeamSize ?? state.currentQuestTeamSize,
                rejectionTrack: action.payload.rejectionTrack ?? state.rejectionTrack,
                maxRejections: action.payload.maxRejections ?? state.maxRejections,
                questResults: action.payload.questResults || state.questResults,
                questTeamSizes: action.payload.questTeamSizes || state.questTeamSizes,
                proposedTeam: action.payload.proposedTeam || state.proposedTeam,
                voteHistory: action.payload.voteHistory || state.voteHistory,
                winner: action.payload.winner ?? state.winner,
                winReason: action.payload.winReason ?? state.winReason,
                countdownStartTime: action.payload.countdownStartTime ?? state.countdownStartTime,
                miniGameEnabled: action.payload.miniGameEnabled ?? state.miniGameEnabled,
            };
        case 'SET_ROLE_INFO':
            return { ...state, roleInfo: action.payload };
        case 'SET_VOTES':
            return { ...state, votes: action.payload };
        case 'SET_VOTE_RESULT':
            return { ...state, voteResult: action.payload, showingResult: 'vote' };
        case 'SET_QUEST_RESULT':
            return { ...state, questResult: action.payload, showingResult: 'quest' };
        case 'SET_ASSASSINATION_RESULT':
            return { ...state, assassinationResult: action.payload };
        case 'SET_FULL_REVEAL':
            return { ...state, fullReveal: action.payload };
        case 'SET_READY_COUNT':
            return { ...state, readyCount: action.payload };
        case 'SET_VOTED_COUNT':
            return { ...state, votedCount: action.payload };
        case 'SET_QUEST_SUBMITTED_COUNT':
            return { ...state, questSubmittedCount: action.payload };
        case 'CLEAR_SHOWING_RESULT':
            return { ...state, showingResult: null };
        case 'SET_ERROR':
            return { ...state, error: action.payload };
        case 'SET_MINIGAME_ENABLED':
            return { ...state, miniGameEnabled: action.payload };
        case 'RESET':
            return {
                ...initialState,
                connected: state.connected,
                miniGameEnabled: state.miniGameEnabled
            };
        default:
            return state;
    }
}

export function GameProvider({ children }) {
    const [state, dispatch] = useReducer(reducer, initialState);
    const stateRef = useRef(state);
    stateRef.current = state;

    useEffect(() => {
        socket.on('connect', () => {
            dispatch({ type: 'SET_CONNECTED', payload: true });

            // Auto-reconnect if we have old state credentials or localStorage from a swipe-out
            let { roomCode, playerId } = stateRef.current;

            if (!roomCode || !playerId) {
                try {
                    const saved = sessionStorage.getItem('avalonSession');
                    if (saved) {
                        const parsed = JSON.parse(saved);
                        if (parsed && parsed.roomCode && parsed.playerId) {
                            roomCode = parsed.roomCode;
                            playerId = parsed.playerId;
                        }
                    }
                } catch (e) {
                    console.error('Failed to parse localStorage session', e);
                }
            }

            if (roomCode && playerId) {
                socket.emit('reconnect-player', { roomCode, playerId }, (res) => {
                    if (res && res.success) {
                        dispatch({ type: 'SET_ROOM', payload: roomCode });
                        const me = res.state.players.find(p => p.id === playerId);
                        if (me) {
                            dispatch({ type: 'SET_PLAYER', payload: { playerId, playerName: me.name } });
                        }
                        dispatch({ type: 'UPDATE_STATE', payload: res.state });
                        if (res.roleInfo) {
                            dispatch({ type: 'SET_ROLE_INFO', payload: res.roleInfo });
                        }
                        // Update stateRefs
                        stateRef.current.roomCode = roomCode;
                        stateRef.current.playerId = playerId;
                    } else {
                        // Reconnect failed (room deleted or player kicked)
                        sessionStorage.removeItem('avalonSession');
                        dispatch({ type: 'RESET' });
                        dispatch({ type: 'SET_ERROR', payload: 'Room was closed due to inactivity.' });
                    }
                });
            }
        });

        socket.on('disconnect', () => dispatch({ type: 'SET_CONNECTED', payload: false }));

        socket.on('player-joined', ({ state: s }) => {
            dispatch({ type: 'UPDATE_STATE', payload: s });
        });

        socket.on('player-left', ({ state: s }) => {
            dispatch({ type: 'UPDATE_STATE', payload: s });

            // Check if WE were the player removed from the state entirely
            const me = s.players.find(p => p.id === stateRef.current.playerId);
            if (!me) {
                // The server formally removed us (kicked or timeout)
                sessionStorage.removeItem('avalonSession');
                dispatch({ type: 'RESET' });
                dispatch({ type: 'SET_ERROR', payload: 'You were removed from the room due to inactivity.' });
            }
        });

        socket.on('roles-updated', ({ state: s }) => {
            dispatch({ type: 'UPDATE_STATE', payload: s });
        });

        socket.on('game-countdown', ({ countdownStartTime, state: s }) => {
            dispatch({ type: 'UPDATE_STATE', payload: { ...s, countdownStartTime } });
        });

        socket.on('role-reveal', ({ roleInfo, state: s }) => {
            dispatch({ type: 'SET_ROLE_INFO', payload: roleInfo });
            dispatch({ type: 'UPDATE_STATE', payload: s });
        });

        socket.on('player-ready-update', ({ readyCount }) => {
            dispatch({ type: 'SET_READY_COUNT', payload: readyCount });
        });

        socket.on('phase-change', ({ state: s }) => {
            dispatch({ type: 'CLEAR_SHOWING_RESULT' });
            dispatch({ type: 'UPDATE_STATE', payload: s });
            dispatch({ type: 'SET_VOTED_COUNT', payload: 0 });
            dispatch({ type: 'SET_QUEST_SUBMITTED_COUNT', payload: 0 });
        });

        socket.on('team-proposed', ({ state: s }) => {
            dispatch({ type: 'UPDATE_STATE', payload: s });
        });

        socket.on('vote-submitted', ({ votedCount }) => {
            dispatch({ type: 'SET_VOTED_COUNT', payload: votedCount });
        });

        socket.on('vote-result', (data) => {
            dispatch({ type: 'SET_VOTES', payload: data.votes });
            dispatch({ type: 'SET_VOTE_RESULT', payload: data });
            dispatch({ type: 'UPDATE_STATE', payload: data.state });
        });

        socket.on('quest-result', (data) => {
            dispatch({ type: 'SET_QUEST_RESULT', payload: data });
            dispatch({ type: 'UPDATE_STATE', payload: data.state });
        });

        socket.on('quest-action-submitted', ({ submittedCount }) => {
            dispatch({ type: 'SET_QUEST_SUBMITTED_COUNT', payload: submittedCount });
        });

        socket.on('assassination-result', (data) => {
            dispatch({ type: 'SET_ASSASSINATION_RESULT', payload: data });
            dispatch({ type: 'SET_FULL_REVEAL', payload: data.reveal });
            dispatch({ type: 'UPDATE_STATE', payload: data.state });
        });

        socket.on('game-over', (data) => {
            dispatch({ type: 'SET_FULL_REVEAL', payload: data.reveal });
            dispatch({ type: 'UPDATE_STATE', payload: data.state });
        });

        socket.on('returned-to-lobby', ({ state: s }) => {
            dispatch({ type: 'UPDATE_STATE', payload: s });
            dispatch({ type: 'SET_ROLE_INFO', payload: null });
            dispatch({ type: 'SET_FULL_REVEAL', payload: null });
            dispatch({ type: 'SET_VOTES', payload: null });
            dispatch({ type: 'SET_VOTE_RESULT', payload: null });
            dispatch({ type: 'SET_ASSASSINATION_RESULT', payload: null });
            dispatch({ type: 'CLEAR_SHOWING_RESULT' });
        });

        socket.on('minigame-toggled', ({ miniGameEnabled }) => {
            dispatch({ type: 'SET_MINIGAME_ENABLED', payload: miniGameEnabled });
        });

        return () => {
            socket.off('connect');
            socket.off('disconnect');
            socket.off('player-joined');
            socket.off('player-left');
            socket.off('roles-updated');
            socket.off('game-countdown');
            socket.off('role-reveal');
            socket.off('player-ready-update');
            socket.off('phase-change');
            socket.off('team-proposed');
            socket.off('vote-submitted');
            socket.off('vote-result');
            socket.off('quest-result');
            socket.off('quest-action-submitted');
            socket.off('assassination-result');
            socket.off('game-over');
            socket.off('returned-to-lobby');
            socket.off('minigame-toggled');
        };
    }, []);

    // ─── Actions ──────────────────────────────────────────────────
    const createRoom = useCallback((playerName, cb) => {
        socket.emit('create-room', { playerName }, (res) => {
            if (res.success) {
                dispatch({ type: 'SET_PLAYER', payload: { playerId: res.playerId, playerName } });
                dispatch({ type: 'SET_ROOM', payload: res.roomCode });
                dispatch({ type: 'UPDATE_STATE', payload: res.state });
                sessionStorage.setItem('avalonSession', JSON.stringify({ roomCode: res.roomCode, playerId: res.playerId }));
            }
            cb?.(res);
        });
    }, []);

    const joinRoom = useCallback((roomCode, playerName, cb) => {
        socket.emit('join-room', { roomCode, playerName }, (res) => {
            if (res.success) {
                dispatch({ type: 'SET_PLAYER', payload: { playerId: res.playerId, playerName } });
                dispatch({ type: 'SET_ROOM', payload: res.roomCode });
                dispatch({ type: 'UPDATE_STATE', payload: res.state });
                sessionStorage.setItem('avalonSession', JSON.stringify({ roomCode: res.roomCode, playerId: res.playerId }));
            }
            cb?.(res);
        });
    }, []);

    const toggleRole = useCallback((roleKey) => {
        socket.emit('toggle-role', { roleKey }, () => { });
    }, []);

    const startGame = useCallback((cb) => {
        socket.emit('start-game', {}, (res) => cb?.(res));
    }, []);

    const playerReady = useCallback(() => {
        socket.emit('player-ready', {}, () => { });
    }, []);

    const proposeTeam = useCallback((team, cb) => {
        socket.emit('propose-team', { team }, (res) => cb?.(res));
    }, []);

    const submitVote = useCallback((vote, cb) => {
        socket.emit('submit-vote', { vote }, (res) => cb?.(res));
    }, []);

    const submitQuestAction = useCallback((action, cb) => {
        socket.emit('submit-quest-action', { action }, (res) => cb?.(res));
    }, []);

    const assassinate = useCallback((targetId, cb) => {
        socket.emit('assassinate', { targetId }, (res) => cb?.(res));
    }, []);

    const returnToLobby = useCallback((cb) => {
        socket.emit('return-to-lobby', {}, (res) => cb?.(res));
    }, []);

    const endGame = useCallback((cb) => {
        socket.emit('end-game', {}, (res) => cb?.(res));
    }, []);

    const restartGame = useCallback((cb) => {
        socket.emit('restart-game', {}, (res) => cb?.(res));
    }, []);

    const leaveRoom = useCallback((cb) => {
        // Optimistically clean up local state so we don't get stuck if the connection drops
        sessionStorage.removeItem('avalonSession');
        stateRef.current.roomCode = null;
        stateRef.current.playerId = null;
        dispatch({ type: 'RESET' });

        socket.emit('leave-room', {}, (res) => {
            cb?.(res);
        });
    }, []);

    const clearShowingResult = useCallback(() => {
        dispatch({ type: 'CLEAR_SHOWING_RESULT' });
    }, []);

    const toggleMiniGame = useCallback((cb) => {
        socket.emit('toggle-minigame', {}, (res) => cb?.(res));
    }, []);

    const value = {
        ...state,
        createRoom,
        joinRoom,
        toggleRole,
        startGame,
        playerReady,
        proposeTeam,
        submitVote,
        submitQuestAction,
        assassinate,
        returnToLobby,
        endGame,
        restartGame,
        leaveRoom,
        clearShowingResult,
        toggleMiniGame,
        isHost: state.playerId === state.hostId,
        isLeader: state.currentLeader?.id === state.playerId,
        myTeam: state.roleInfo?.team,
        isOnQuestTeam: state.proposedTeam?.includes(state.playerId),
    };

    return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
    const ctx = useContext(GameContext);
    if (!ctx) throw new Error('useGame must be used within a GameProvider');
    return ctx;
}
