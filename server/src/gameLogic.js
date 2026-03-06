const {
    PLAYER_DISTRIBUTION,
    QUEST_TEAM_SIZES,
    TWO_FAIL_QUEST_INDEX,
    TWO_FAIL_MIN_PLAYERS,
    TEAM_GOOD,
    TEAM_EVIL,
    ROLES,
} = require('./constants');

// ─── Shuffle (Fisher-Yates) ───────────────────────────────────────────
function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// ─── Assign Roles ─────────────────────────────────────────────────────
function assignRoles(players, enabledRoles) {
    const count = players.length;
    const dist = PLAYER_DISTRIBUTION[count];
    if (!dist) throw new Error(`Invalid player count: ${count}`);

    // Build the role pool
    const goodRoles = [];
    const evilRoles = [];

    // Add enabled special roles
    if (enabledRoles.merlin) goodRoles.push(ROLES.MERLIN);
    if (enabledRoles.percival) goodRoles.push(ROLES.PERCIVAL);
    if (enabledRoles.assassin) evilRoles.push(ROLES.ASSASSIN);
    if (enabledRoles.morgana) evilRoles.push(ROLES.MORGANA);
    if (enabledRoles.mordred) evilRoles.push(ROLES.MORDRED);
    if (enabledRoles.oberon) evilRoles.push(ROLES.OBERON);

    // Validate: not too many special roles for team size
    if (goodRoles.length > dist.good) {
        throw new Error(`Too many Good special roles (${goodRoles.length}) for ${count} players (max ${dist.good})`);
    }
    if (evilRoles.length > dist.evil) {
        throw new Error(`Too many Evil special roles (${evilRoles.length}) for ${count} players (max ${dist.evil})`);
    }

    // Fill remaining slots with generic roles
    while (goodRoles.length < dist.good) goodRoles.push(ROLES.LOYAL_SERVANT);
    while (evilRoles.length < dist.evil) evilRoles.push(ROLES.MINION);

    const allRoles = shuffle([...goodRoles, ...evilRoles]);
    const shuffledPlayers = shuffle([...players]);

    const assignments = {};
    shuffledPlayers.forEach((player, i) => {
        assignments[player.id] = { ...allRoles[i] };
    });

    return assignments;
}

// ─── Get Role Information (Asymmetric Knowledge) ──────────────────────
function getRoleInfo(playerId, roleAssignments, allPlayers) {
    const role = roleAssignments[playerId];
    if (!role) return null;

    const info = {
        roleName: role.name,
        roleKey: role.key,
        team: role.team,
        knownPlayers: [],
        description: '',
    };

    const playerNameMap = {};
    allPlayers.forEach(p => { playerNameMap[p.id] = p.name; });

    switch (role.key) {
        case 'merlin': {
            // Merlin sees all evil EXCEPT Mordred
            const evilVisible = Object.entries(roleAssignments)
                .filter(([id, r]) => r.team === TEAM_EVIL && r.key !== 'mordred' && id !== playerId)
                .map(([id]) => ({ id, name: playerNameMap[id] }));
            info.knownPlayers = evilVisible;
            info.description = evilVisible.length > 0
                ? `You are Merlin. The following players are evil: ${evilVisible.map(p => p.name).join(', ')}.`
                : 'You are Merlin. You see no evil players (Mordred is hidden from you).';
            break;
        }

        case 'percival': {
            // Percival sees Merlin and Morgana but doesn't know which is which
            const merlinMorgana = Object.entries(roleAssignments)
                .filter(([id, r]) => (r.key === 'merlin' || r.key === 'morgana') && id !== playerId)
                .map(([id]) => ({ id, name: playerNameMap[id] }));
            info.knownPlayers = merlinMorgana;
            if (merlinMorgana.length === 2) {
                info.description = `You are Percival. ${merlinMorgana[0].name} and ${merlinMorgana[1].name} are Merlin and Morgana, but you do not know which is which.`;
            } else if (merlinMorgana.length === 1) {
                info.description = `You are Percival. ${merlinMorgana[0].name} is Merlin.`;
            } else {
                info.description = 'You are Percival. Merlin is not in this game.';
            }
            break;
        }

        case 'loyalServant': {
            info.description = 'You are a Loyal Servant of Arthur. You have no special information. Use discussion and deduction to find the truth.';
            break;
        }

        case 'assassin': {
            // Assassin sees other evil (except Oberon)
            const evilAllies = Object.entries(roleAssignments)
                .filter(([id, r]) => r.team === TEAM_EVIL && r.key !== 'oberon' && id !== playerId)
                .map(([id]) => ({ id, name: playerNameMap[id] }));
            info.knownPlayers = evilAllies;
            info.description = evilAllies.length > 0
                ? `You are the Assassin. Your fellow evil players are: ${evilAllies.map(p => p.name).join(', ')}. If Good completes 3 quests, you must identify and assassinate Merlin to win.`
                : 'You are the Assassin. You have no known allies. If Good completes 3 quests, you must identify and assassinate Merlin to win.';
            break;
        }

        case 'morgana': {
            const evilAllies = Object.entries(roleAssignments)
                .filter(([id, r]) => r.team === TEAM_EVIL && r.key !== 'oberon' && id !== playerId)
                .map(([id]) => ({ id, name: playerNameMap[id] }));
            info.knownPlayers = evilAllies;
            info.description = evilAllies.length > 0
                ? `You are Morgana. You appear as Merlin to Percival. Your fellow evil players are: ${evilAllies.map(p => p.name).join(', ')}.`
                : 'You are Morgana. You appear as Merlin to Percival. You have no known allies.';
            break;
        }

        case 'mordred': {
            const evilAllies = Object.entries(roleAssignments)
                .filter(([id, r]) => r.team === TEAM_EVIL && r.key !== 'oberon' && id !== playerId)
                .map(([id]) => ({ id, name: playerNameMap[id] }));
            info.knownPlayers = evilAllies;
            info.description = evilAllies.length > 0
                ? `You are Mordred. You are hidden from Merlin. Your fellow evil players are: ${evilAllies.map(p => p.name).join(', ')}.`
                : 'You are Mordred. You are hidden from Merlin. You have no known allies.';
            break;
        }

        case 'oberon': {
            // Oberon sees nothing and is invisible to other evil
            info.description = 'You are Oberon. You are evil, but you do not know who your allies are, and they do not know you.';
            break;
        }

        case 'minion': {
            const evilAllies = Object.entries(roleAssignments)
                .filter(([id, r]) => r.team === TEAM_EVIL && r.key !== 'oberon' && id !== playerId)
                .map(([id]) => ({ id, name: playerNameMap[id] }));
            info.knownPlayers = evilAllies;
            info.description = evilAllies.length > 0
                ? `You are a Minion of Mordred. Your fellow evil players are: ${evilAllies.map(p => p.name).join(', ')}.`
                : 'You are a Minion of Mordred. You have no known allies.';
            break;
        }

        default:
            info.description = `You are ${role.name}.`;
    }

    return info;
}

// ─── Evaluate Quest Result ────────────────────────────────────────────
function evaluateQuest(actions, questIndex, playerCount) {
    const failCount = actions.filter(a => a === 'fail').length;
    const successCount = actions.filter(a => a === 'success').length;

    // Quest 4 (index 3) with 7+ players requires 2 fails
    const requiresTwoFails = questIndex === TWO_FAIL_QUEST_INDEX && playerCount >= TWO_FAIL_MIN_PLAYERS;
    const failsNeeded = requiresTwoFails ? 2 : 1;

    const passed = failCount < failsNeeded;

    return {
        passed,
        failCount,
        successCount,
        requiresTwoFails,
    };
}

// ─── Check Win Condition ──────────────────────────────────────────────
function checkWinCondition(questResults, rejectionCount) {
    const passedQuests = questResults.filter(q => q && q.passed).length;
    const failedQuests = questResults.filter(q => q && !q.passed).length;

    if (passedQuests >= 3) {
        return { winner: null, reason: 'three_quests_passed', goToAssassination: true };
    }

    if (failedQuests >= 3) {
        return { winner: TEAM_EVIL, reason: 'three_quests_failed', goToAssassination: false };
    }

    if (rejectionCount >= 5) {
        return { winner: TEAM_EVIL, reason: 'five_rejections', goToAssassination: false };
    }

    return null; // Game continues
}

// ─── Validate Team Proposal ──────────────────────────────────────────
function validateTeamProposal(team, questIndex, playerCount, playerIds) {
    const requiredSize = QUEST_TEAM_SIZES[playerCount]?.[questIndex];
    if (!requiredSize) return { valid: false, error: 'Invalid quest or player count' };
    if (team.length !== requiredSize) {
        return { valid: false, error: `Quest requires ${requiredSize} players, got ${team.length}` };
    }
    // Check all team members are valid players
    for (const id of team) {
        if (!playerIds.includes(id)) {
            return { valid: false, error: `Player ${id} is not in this game` };
        }
    }
    // Check for duplicates
    if (new Set(team).size !== team.length) {
        return { valid: false, error: 'Duplicate players in team' };
    }
    return { valid: true };
}

// ─── Process Votes ────────────────────────────────────────────────────
function processVotes(votes, playerCount) {
    const approvals = Object.values(votes).filter(v => v === 'approve').length;
    const rejections = Object.values(votes).filter(v => v === 'reject').length;
    // Strict majority: more than half must approve
    const approved = approvals > playerCount / 2;
    return { approved, approvals, rejections };
}

module.exports = {
    shuffle,
    assignRoles,
    getRoleInfo,
    evaluateQuest,
    checkWinCondition,
    validateTeamProposal,
    processVotes,
};
