const { io } = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';
const bots = [];

const createBot = (name) => {
    const socket = io(SERVER_URL);
    socket.on('connect', () => {
        // console.log(`${name} connected.`);
    });

    // Auto-respond to game events
    socket.on('game-state', (state) => {
        if (!state) return;

        // If it's voting phase, auto approve
        if (state.phase === 'VOTING') {
            const player = state.players.find(p => p.socketId === socket.id);
            if (player && !player.hasVoted) {
                setTimeout(() => socket.emit('submit-vote', 'approve', () => { }), Math.random() * 1000 + 500);
            }
        }

        // If it's quest phase and bot is on team, auto success
        if (state.phase === 'QUEST') {
            const player = state.players.find(p => p.socketId === socket.id);
            if (!player) return;
            const isOnTeam = state.proposedTeam.includes(player.id);
            if (isOnTeam && !player.hasSubmitted) {
                // If bot is evil, maybe fail. But let's just do success for simplicity
                setTimeout(() => socket.emit('submit-quest-action', 'success', () => { }), Math.random() * 1000 + 500);
            }
        }
    });

    return socket;
};

// Bot 1 creates the room
const hostBot = createBot('Bot1');
hostBot.emit('create-room', { playerName: 'Bot1' }, (res) => {
    if (res.error) return console.error(res.error);
    const code = res.roomCode;
    console.log(`ROOM_CODE:${code}`);

    // Connect 3 more bots
    const b2 = createBot('Bot2');
    b2.emit('join-room', { roomCode: code, playerName: 'Bot2' }, () => { });

    const b3 = createBot('Bot3');
    b3.emit('join-room', { roomCode: code, playerName: 'Bot3' }, () => { });

    const b4 = createBot('Bot4');
    b4.emit('join-room', { roomCode: code, playerName: 'Bot4' }, () => { });

    // Add logic if bot is leader
    hostBot.on('game-state', (state) => {
        if (state.phase === 'TEAM_PROPOSAL') {
            const player = state.players.find(p => p.socketId === hostBot.id);
            if (state.currentLeader.id === player.id) {
                const reqSize = state.questTeamSizes[state.currentQuestIndex];
                // Propose first N players
                const team = state.players.slice(0, reqSize).map(p => p.id);
                setTimeout(() => hostBot.emit('propose-team', team, () => { }), 2000);
            }
        }
    });

    b2.on('game-state', (state) => {
        if (state.phase === 'TEAM_PROPOSAL') {
            const player = state.players.find(p => p.socketId === b2.id);
            if (state.currentLeader.id === player.id) {
                const reqSize = state.questTeamSizes[state.currentQuestIndex];
                const team = state.players.slice(0, reqSize).map(p => p.id);
                setTimeout(() => b2.emit('propose-team', team, () => { }), 2000);
            }
        }
    });

    b3.on('game-state', (state) => {
        if (state.phase === 'TEAM_PROPOSAL') {
            const player = state.players.find(p => p.socketId === b3.id);
            if (state.currentLeader.id === player.id) {
                const reqSize = state.questTeamSizes[state.currentQuestIndex];
                const team = state.players.slice(0, reqSize).map(p => p.id);
                setTimeout(() => b3.emit('propose-team', team, () => { }), 2000);
            }
        }
    });

    b4.on('game-state', (state) => {
        if (state.phase === 'TEAM_PROPOSAL') {
            const player = state.players.find(p => p.socketId === b4.id);
            if (state.currentLeader.id === player.id) {
                const reqSize = state.questTeamSizes[state.currentQuestIndex];
                const team = state.players.slice(0, reqSize).map(p => p.id);
                setTimeout(() => b4.emit('propose-team', team, () => { }), 2000);
            }
        }
    });

    bots.push(hostBot, b2, b3, b4);
});
