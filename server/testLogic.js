const assert = require('assert');
const Room = require('./src/Room');
const { PHASES, TEAM_GOOD, TEAM_EVIL, QUEST_TEAM_SIZES } = require('./src/constants');

function runTest(playerCount) {
    console.log(`\n--- Running Simulation for ${playerCount} Players ---`);
    let room = new Room('TEST', { id: 'p0', name: 'Player 0' });

    for (let i = 1; i < playerCount; i++) {
        room.addPlayer({ id: `p${i}`, name: `Player ${i}` });
    }

    room.startGame();
    assert.strictEqual(room.phase, PHASES.COUNTDOWN);

    room.transitionToRoleReveal();
    assert.strictEqual(room.phase, PHASES.ROLE_REVEAL);

    room.transitionToTeamProposal();
    assert.strictEqual(room.phase, PHASES.TEAM_PROPOSAL);

    let maxIters = 1000;
    while (room.phase !== PHASES.GAME_OVER && maxIters > 0) {
        maxIters--;
        if (room.phase === PHASES.TEAM_PROPOSAL) {
            const leader = room.getCurrentLeader();
            const required = room.getCurrentQuestTeamSize();
            // Propose first `required` players
            const team = room.players.slice(0, required).map(p => p.id);
            room.proposeTeam(leader.id, team);
            assert.strictEqual(room.phase, PHASES.VOTING);
        } else if (room.phase === PHASES.VOTING) {
            // Everyone approves to make sure it passes
            room.players.forEach(p => {
                room.submitVote(p.id, 'approve');
            });
            const result = room.resolveVotes();
            if (result.approved) {
                assert.strictEqual(room.phase, PHASES.QUEST);
            } else {
                if (room.phase !== PHASES.GAME_OVER) {
                    assert.strictEqual(room.phase, PHASES.TEAM_PROPOSAL);
                }
            }
        } else if (room.phase === PHASES.QUEST) {
            const team = room.proposedTeam;
            team.forEach(id => {
                const role = room.roleAssignments[id];
                // Good must play success, Evil plays fail to test both
                if (role.team === TEAM_GOOD) {
                    room.submitQuestAction(id, 'success');
                } else {
                    room.submitQuestAction(id, 'fail');
                }
            });
            assert.strictEqual(room.allQuestActionsIn(), true, "Should have all actions in");
            const result = room.resolveQuest();
            assert.strictEqual(room.phase, PHASES.QUEST_REVEAL);
            room.finishQuestReveal();
        } else if (room.phase === PHASES.ASSASSINATION) {
            // Find assassin
            const assassin = room.players.find(p => room.roleAssignments[p.id].key === 'assassin');
            const target = room.players.find(p => room.roleAssignments[p.id].key === 'merlin');
            room.assassinate(assassin.id, target.id);
        }
    }

    if (maxIters === 0) {
        throw new Error("Game looped infinitely without finishing!");
    }
    console.log(`Game over successfully for ${playerCount} players. Winner: ${room.winner}. Reason: ${room.winReason}`);
}

function randomSim(playerCount, iterations) {
    let failed = 0;
    for (let i = 0; i < iterations; i++) {
        try {
            let room = new Room('TEST', { id: 'p0', name: 'Player 0' });
            for (let j = 1; j < playerCount; j++) {
                room.addPlayer({ id: `p${j}`, name: `Player ${j}` });
            }
            room.startGame();
            room.transitionToTeamProposal();

            let iters = 0;
            while (room.phase !== PHASES.GAME_OVER && iters < 200) {
                iters++;
                if (room.phase === PHASES.TEAM_PROPOSAL) {
                    const leader = room.getCurrentLeader();
                    const required = room.getCurrentQuestTeamSize();
                    // Random team
                    let shuffled = [...room.players].sort(() => 0.5 - Math.random());
                    let team = shuffled.slice(0, required).map(p => p.id);
                    room.proposeTeam(leader.id, team);
                } else if (room.phase === PHASES.VOTING) {
                    room.players.forEach(p => {
                        let v = Math.random() > 0.5 ? 'approve' : 'reject';
                        room.submitVote(p.id, v);
                    });
                    room.resolveVotes();
                } else if (room.phase === PHASES.QUEST) {
                    room.proposedTeam.forEach(id => {
                        const role = room.roleAssignments[id];
                        if (role.team === TEAM_GOOD) {
                            room.submitQuestAction(id, 'success');
                        } else {
                            let action = Math.random() > 0.5 ? 'success' : 'fail';
                            room.submitQuestAction(id, action);
                        }
                    });
                    room.resolveQuest();
                    room.finishQuestReveal();
                } else if (room.phase === PHASES.ASSASSINATION) {
                    const assassin = room.players.find(p => room.roleAssignments[p.id].key === 'assassin');
                    let target = room.players.filter(p => p.id !== assassin.id)[Math.floor(Math.random() * (playerCount - 1))];
                    room.assassinate(assassin.id, target.id);
                }
            }
            if (iters >= 200) {
                console.log("Game stuck!");
                failed++;
            }
        } catch (e) {
            console.error("Error in random sim:", e);
            failed++;
        }
    }
    console.log(`Simulated ${iterations} games of ${playerCount} players. Failed: ${failed}`);
}

for (let i = 5; i <= 10; i++) {
    runTest(i);
    randomSim(i, 1000);
}

// Test Good playing fail
console.log("\n--- Testing Edge Cases ---");
let room = new Room('TEST', { id: 'p0', name: 'Host' });
room.addPlayer({ id: 'p1', name: 'p1' });
room.addPlayer({ id: 'p2', name: 'p2' });
room.addPlayer({ id: 'p3', name: 'p3' });
room.addPlayer({ id: 'p4', name: 'p4' });
room.startGame();
room.transitionToTeamProposal();
// Propose
room.proposeTeam(room.getCurrentLeader().id, ['p0', 'p1']);
room.players.forEach(p => room.submitVote(p.id, 'approve'));
room.resolveVotes();
assert.strictEqual(room.phase, PHASES.QUEST);

let goodPlayer = ['p0', 'p1'].find(id => room.roleAssignments[id].team === TEAM_GOOD);
try {
    room.submitQuestAction(goodPlayer, 'fail');
    assert.fail("Good player should not be able to play fail");
} catch (e) {
    if (e.message !== 'Good players must play Success') {
        throw e;
    }
}
room.submitQuestAction(goodPlayer, 'success');
console.log("Edge Cases Passed!");
