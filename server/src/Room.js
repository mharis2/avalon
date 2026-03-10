const {
    PHASES,
    QUEST_TEAM_SIZES,
    MAX_REJECTIONS,
    TEAM_GOOD,
    TEAM_EVIL,
} = require('./constants');
const {
    assignRoles,
    getRoleInfo,
    evaluateQuest,
    checkWinCondition,
    validateTeamProposal,
    processVotes,
    shuffle,
} = require('./gameLogic');

class Room {
    constructor(code, hostPlayer) {
        this.code = code;
        this.players = [hostPlayer];
        this.hostId = hostPlayer.id;
        this.phase = PHASES.LOBBY;

        // Host-configurable role toggles
        this.enabledRoles = {
            merlin: true,
            assassin: true,
            percival: false,
            morgana: false,
            mordred: false,
            oberon: false,
        };

        // Game state (populated on start)
        this.roleAssignments = {};
        this.currentLeaderIndex = 0;
        this.currentQuestIndex = 0;
        this.currentQuestReveal = null;
        this.rejectionTrack = 0;
        this.questResults = [];        // Array of { passed, failCount, successCount }
        this.proposedTeam = [];
        this.votes = {};               // { playerId: 'approve'|'reject' }
        this.questActions = {};        // { playerId: 'success'|'fail' }
        this.voteHistory = [];         // Array of { leader, team, votes, approved }
        this.winner = null;
        this.winReason = null;
        this.assassinationTarget = null;

        // Countdown sync
        this.countdownStartTime = null;

        // Mini-game toggle (host can disable)
        this.miniGameEnabled = true;
    }

    // ─── Player Management ──────────────────────────────────────────
    addPlayer(player) {
        if (this.phase !== PHASES.LOBBY) {
            throw new Error('Game already in progress');
        }
        if (this.players.length >= 10) {
            throw new Error('Room is full (max 10 players)');
        }
        if (this.players.find(p => p.name.toLowerCase() === player.name.toLowerCase())) {
            throw new Error('Name already taken');
        }

        player.connected = true; // Track connection status
        this.players.push(player);
    }

    removePlayer(playerId) {
        this.players = this.players.filter(p => p.id !== playerId);
        // Transfer host if host leaves
        if (playerId === this.hostId && this.players.length > 0) {
            this.hostId = this.players[0].id;
        }
    }

    getPlayer(playerId) {
        return this.players.find(p => p.id === playerId);
    }

    // ─── Role Toggles ──────────────────────────────────────────────
    toggleRole(roleKey) {
        if (this.enabledRoles[roleKey] === undefined) return;

        const newVal = !this.enabledRoles[roleKey];
        this.enabledRoles[roleKey] = newVal;

        // Dependencies:
        if (roleKey === 'merlin' || roleKey === 'assassin') {
            this.enabledRoles.merlin = newVal;
            this.enabledRoles.assassin = newVal;
            if (!newVal) {
                this.enabledRoles.percival = false;
                this.enabledRoles.morgana = false;
            }
        } else if (roleKey === 'percival') {
            if (newVal) {
                this.enabledRoles.morgana = true;
                this.enabledRoles.merlin = true;
                this.enabledRoles.assassin = true;
            } else {
                this.enabledRoles.morgana = false;
            }
        } else if (roleKey === 'morgana') {
            if (newVal) {
                this.enabledRoles.percival = true;
                this.enabledRoles.merlin = true;
                this.enabledRoles.assassin = true;
            } else {
                this.enabledRoles.percival = false;
            }
        }
    }

    // ─── Start Game ─────────────────────────────────────────────────
    startGame() {
        if (this.players.length < 5) {
            throw new Error('Need at least 5 players to start');
        }
        if (this.players.length > 10) {
            throw new Error('Maximum 10 players');
        }

        // Assign roles
        this.roleAssignments = assignRoles(this.players, this.enabledRoles);

        // Randomize starting leader
        this.currentLeaderIndex = Math.floor(Math.random() * this.players.length);
        this.currentQuestIndex = 0;
        this.rejectionTrack = 0;
        this.questResults = [];
        this.voteHistory = [];
        this.winner = null;
        this.winReason = null;

        // Start countdown
        this.phase = PHASES.COUNTDOWN;
        this.countdownStartTime = Date.now();
    }

    // ─── Role Info for a Player ─────────────────────────────────────
    getRoleInfoForPlayer(playerId) {
        return getRoleInfo(playerId, this.roleAssignments, this.players);
    }

    // ─── Transition to Role Reveal ──────────────────────────────────
    transitionToRoleReveal() {
        this.phase = PHASES.ROLE_REVEAL;
    }

    // ─── Transition to Team Proposal ────────────────────────────────
    transitionToTeamProposal() {
        this.phase = PHASES.TEAM_PROPOSAL;
        this.proposedTeam = [];
        this.votes = {};
        this.questActions = {};
    }

    // ─── Get Current Leader ─────────────────────────────────────────
    getCurrentLeader() {
        return this.players[this.currentLeaderIndex];
    }

    // ─── Get Current Quest Team Size ────────────────────────────────
    getCurrentQuestTeamSize() {
        return QUEST_TEAM_SIZES[this.players.length]?.[this.currentQuestIndex];
    }

    // ─── Propose Team ──────────────────────────────────────────────
    proposeTeam(leaderId, team) {
        if (this.phase !== PHASES.TEAM_PROPOSAL) {
            throw new Error('Not in team proposal phase');
        }
        const leader = this.getCurrentLeader();
        if (leader.id !== leaderId) {
            throw new Error('Only the leader can propose a team');
        }

        const playerIds = this.players.map(p => p.id);
        const validation = validateTeamProposal(team, this.currentQuestIndex, this.players.length, playerIds);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        this.proposedTeam = team;
        this.votes = {};
        this.phase = PHASES.VOTING;
    }

    // ─── Submit Vote ────────────────────────────────────────────────
    submitVote(playerId, vote) {
        if (this.phase !== PHASES.VOTING) {
            throw new Error('Not in voting phase');
        }
        if (!['approve', 'reject'].includes(vote)) {
            throw new Error('Vote must be "approve" or "reject"');
        }
        if (!this.players.find(p => p.id === playerId)) {
            throw new Error('Player not in this game');
        }
        this.votes[playerId] = vote;
    }

    allVotesIn() {
        return Object.keys(this.votes).length === this.players.length;
    }

    // ─── Resolve Votes ─────────────────────────────────────────────
    resolveVotes() {
        const result = processVotes(this.votes, this.players.length);

        // Record in vote history
        const leader = this.getCurrentLeader();
        this.voteHistory.push({
            leader: { id: leader.id, name: leader.name },
            team: this.proposedTeam.map(id => {
                const p = this.getPlayer(id);
                return p ? { id: p.id, name: p.name } : { id, name: 'Unknown' };
            }),
            votes: { ...this.votes },
            approved: result.approved,
            questIndex: this.currentQuestIndex,
        });

        if (result.approved) {
            // Move to quest phase
            this.phase = PHASES.QUEST;
            this.questActions = {};
            this.rejectionTrack = 0;
        } else {
            // Rejection
            this.rejectionTrack++;

            // Check 5-rejection rule
            const winCheck = checkWinCondition(this.questResults, this.rejectionTrack);
            if (winCheck) {
                this.winner = winCheck.winner;
                this.winReason = winCheck.reason;
                this.phase = PHASES.GAME_OVER;
                return { ...result, gameOver: true, winner: this.winner, winReason: this.winReason };
            }

            // Advance leader and go back to proposal
            this.advanceLeader();
            this.phase = PHASES.TEAM_PROPOSAL;
            this.proposedTeam = [];
            this.votes = {};
        }

        return { ...result, gameOver: false };
    }

    // ─── Submit Quest Action ────────────────────────────────────────
    submitQuestAction(playerId, action) {
        if (this.phase !== PHASES.QUEST) {
            throw new Error('Not in quest phase');
        }
        if (!this.proposedTeam.includes(playerId)) {
            throw new Error('You are not on this quest team');
        }
        if (!['success', 'fail'].includes(action)) {
            throw new Error('Action must be "success" or "fail"');
        }

        // Good players MUST play success
        const role = this.roleAssignments[playerId];
        if (role && role.team === TEAM_GOOD && action === 'fail') {
            throw new Error('Good players must play Success');
        }

        this.questActions[playerId] = action;
    }

    allQuestActionsIn() {
        return Object.keys(this.questActions).length === this.proposedTeam.length;
    }

    // ─── Resolve Quest ─────────────────────────────────────────────
    resolveQuest() {
        const actions = shuffle(Object.values(this.questActions));
        const result = evaluateQuest(actions, this.currentQuestIndex, this.players.length);

        this.questResults.push(result);
        this.currentQuestIndex++;

        let nextPhase = null;
        let winState = null;

        // Check win condition
        const winCheck = checkWinCondition(this.questResults, this.rejectionTrack);
        if (winCheck) {
            if (winCheck.goToAssassination && this.enabledRoles.merlin) {
                // Good passed 3 quests, but Assassin gets to try
                nextPhase = PHASES.ASSASSINATION;
                winState = { ...result, goToAssassination: true, gameOver: false };
            } else if (winCheck.goToAssassination && !this.enabledRoles.merlin) {
                // No Merlin → Good wins outright
                nextPhase = PHASES.GAME_OVER;
                this.winner = TEAM_GOOD;
                this.winReason = 'three_quests_passed';
                winState = { ...result, goToAssassination: false, gameOver: true, winner: TEAM_GOOD, winReason: 'three_quests_passed' };
            } else {
                nextPhase = PHASES.GAME_OVER;
                this.winner = winCheck.winner;
                this.winReason = winCheck.reason;
                winState = { ...result, goToAssassination: false, gameOver: true, winner: winCheck.winner, winReason: winCheck.reason };
            }
        } else {
            // Next quest: advance leader, back to proposal
            nextPhase = PHASES.TEAM_PROPOSAL;
            winState = { ...result, goToAssassination: false, gameOver: false };
        }

        this.phase = PHASES.QUEST_REVEAL;
        this.currentQuestReveal = { actions, result: winState };

        return {
            actions,
            result: winState,
            nextPhase,
        };
    }



    // ─── Assassination ─────────────────────────────────────────────
    assassinate(assassinId, targetId) {
        if (this.phase !== PHASES.ASSASSINATION) {
            throw new Error('Not in assassination phase');
        }

        // Find the assassin
        const assassinRole = this.roleAssignments[assassinId];
        if (!assassinRole || assassinRole.key !== 'assassin') {
            throw new Error('Only the Assassin can assassinate');
        }

        // Check target is valid
        if (!this.players.find(p => p.id === targetId)) {
            throw new Error('Invalid target');
        }

        this.assassinationTarget = targetId;
        const targetRole = this.roleAssignments[targetId];
        const merlinKilled = targetRole && targetRole.key === 'merlin';

        if (merlinKilled) {
            this.winner = TEAM_EVIL;
            this.winReason = 'merlin_assassinated';
        } else {
            this.winner = TEAM_GOOD;
            this.winReason = 'merlin_survived';
        }

        this.phase = PHASES.GAME_OVER;

        return {
            merlinKilled,
            targetId,
            targetName: this.getPlayer(targetId)?.name,
            winner: this.winner,
            winReason: this.winReason,
        };
    }

    // ─── Advance Leader ─────────────────────────────────────────────
    advanceLeader() {
        this.currentLeaderIndex = (this.currentLeaderIndex + 1) % this.players.length;
    }

    // ─── Reset For New Game (keeps players in room) ──────────────────
    resetForNewGame() {
        this.phase = PHASES.LOBBY;
        this.roleAssignments = {};
        this.currentLeaderIndex = 0;
        this.currentQuestIndex = 0;
        this.currentQuestReveal = null;
        this.rejectionTrack = 0;
        this.questResults = [];
        this.proposedTeam = [];
        this.votes = {};
        this.questActions = {};
        this.voteHistory = [];
        this.winner = null;
        this.winReason = null;
        this.assassinationTarget = null;
        this.countdownStartTime = null;
        delete this._readyPlayers;
    }

    // ─── Get Public Game State ──────────────────────────────────────
    getPublicState() {
        return {
            code: this.code,
            phase: this.phase,
            players: this.players.map(p => ({
                id: p.id,
                name: p.name,
                isHost: p.id === this.hostId,
                connected: p.connected,
            })),
            hostId: this.hostId,
            enabledRoles: this.enabledRoles,
            currentLeader: this.getCurrentLeader()
                ? { id: this.getCurrentLeader().id, name: this.getCurrentLeader().name }
                : null,
            currentQuestIndex: this.currentQuestIndex,
            currentQuestTeamSize: this.getCurrentQuestTeamSize(),
            currentQuestReveal: this.currentQuestReveal,
            rejectionTrack: this.rejectionTrack,
            maxRejections: MAX_REJECTIONS,
            questResults: this.questResults,
            proposedTeam: this.proposedTeam,
            voteHistory: this.voteHistory,
            winner: this.winner,
            winReason: this.winReason,
            questTeamSizes: QUEST_TEAM_SIZES[this.players.length] || [],
            countdownStartTime: this.countdownStartTime,
            miniGameEnabled: this.miniGameEnabled,
        };
    }

    // ─── Get Full Reveal (game over) ───────────────────────────────
    getFullReveal() {
        return {
            roleAssignments: Object.fromEntries(
                Object.entries(this.roleAssignments).map(([id, role]) => {
                    const player = this.getPlayer(id);
                    return [id, { ...role, playerName: player?.name || 'Unknown' }];
                })
            ),
            assassinationTarget: this.assassinationTarget,
        };
    }
}

module.exports = Room;
