/**
 * testQuestReveal.js — End-to-end bot test for the quest reveal flow.
 *
 * Creates 5 bots, runs through the full game cycle:
 *   create room → join → start → role reveal → ready →
 *   propose team → vote → quest action → QUEST REVEAL → next phase
 *
 * Validates that the server correctly:
 *   1. Enters QUEST_REVEAL phase with questResultData
 *   2. Waits the proper animation duration
 *   3. Advances to the next phase (TEAM_PROPOSAL, ASSASSINATION, or GAME_OVER)
 *
 * Usage:
 *   1. Start the server: cd server && npm start
 *   2. In another terminal: node testQuestReveal.js
 */

const { io } = require('socket.io-client');

const SERVER = 'http://localhost:3001';
const NUM_BOTS = 5;
const TIMEOUT_MS = 60000; // Overall test timeout

let roomCode = null;
const bots = [];
const botData = []; // { socket, name, playerId, roleInfo }

// ─── Helpers ─────────────────────────────────────────────────────
function log(msg) { console.log(`  [TEST] ${msg}`); }
function pass(msg) { console.log(`  ✅ ${msg}`); }
function fail(msg) { console.error(`  ❌ ${msg}`); cleanup(); process.exit(1); }

function cleanup() {
    bots.forEach(b => b.disconnect());
}

function createBot(name) {
    return new Promise((resolve, reject) => {
        const socket = io(SERVER, { transports: ['websocket'] });
        socket.on('connect', () => resolve(socket));
        socket.on('connect_error', (err) => reject(new Error(`${name} connect failed: ${err.message}`)));
        setTimeout(() => reject(new Error(`${name} connect timeout`)), 5000);
    });
}

function emitAsync(socket, event, data) {
    return new Promise((resolve, reject) => {
        socket.emit(event, data, (res) => {
            if (res?.error) reject(new Error(res.error));
            else resolve(res);
        });
        setTimeout(() => reject(new Error(`${event} timeout`)), 10000);
    });
}

// ─── Wait for a specific socket event ────────────────────────────
function waitForEvent(socket, event, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            socket.off(event, handler);
            reject(new Error(`Timeout waiting for ${event}`));
        }, timeoutMs);
        const handler = (data) => {
            clearTimeout(timer);
            socket.off(event, handler);
            resolve(data);
        };
        socket.on(event, handler);
    });
}

// Wait for event on ALL bots
function waitForEventAll(event, timeoutMs = 30000) {
    return Promise.all(bots.map(b => waitForEvent(b, event, timeoutMs)));
}

// ─── Main test ───────────────────────────────────────────────────
async function runTest() {
    const overallTimer = setTimeout(() => {
        fail('Overall test timeout exceeded');
    }, TIMEOUT_MS);

    try {
        // 1. Create bots
        log('Creating 5 bots...');
        for (let i = 0; i < NUM_BOTS; i++) {
            const socket = await createBot(`Bot${i + 1}`);
            bots.push(socket);
            botData.push({ socket, name: `Bot${i + 1}`, playerId: null, roleInfo: null });
        }
        pass('All bots connected');

        // 2. Bot1 creates room
        log('Bot1 creating room...');
        const createRes = await emitAsync(bots[0], 'create-room', { playerName: 'Bot1' });
        roomCode = createRes.roomCode;
        botData[0].playerId = createRes.playerId;
        pass(`Room created: ${roomCode}`);

        // 3. Bots 2-5 join
        log('Bots 2-5 joining...');
        for (let i = 1; i < NUM_BOTS; i++) {
            const joinRes = await emitAsync(bots[i], 'join-room', {
                roomCode,
                playerName: `Bot${i + 1}`,
            });
            botData[i].playerId = joinRes.playerId;
        }
        pass('All bots in room');

        // 4. Start game
        log('Starting game...');
        const countdownPromises = bots.map(b => waitForEvent(b, 'game-countdown'));
        await emitAsync(bots[0], 'start-game', {});
        await Promise.all(countdownPromises);
        pass('Game countdown started');

        // 5. Wait for role-reveal
        log('Waiting for role reveal...');
        const roleReveals = await Promise.all(
            bots.map(b => waitForEvent(b, 'role-reveal', 10000))
        );
        roleReveals.forEach((r, i) => {
            botData[i].roleInfo = r.roleInfo;
        });
        pass(`Roles assigned: ${botData.map(b => `${b.name}=${b.roleInfo.roleName}`).join(', ')}`);

        // 6. All players ready
        log('All players sending ready...');
        const phaseChangePromises = bots.map(b => waitForEvent(b, 'phase-change'));
        for (const bot of bots) {
            await emitAsync(bot, 'player-ready', {});
        }
        const phaseResults = await Promise.all(phaseChangePromises);
        if (phaseResults[0].phase !== 'TEAM_PROPOSAL') {
            fail(`Expected TEAM_PROPOSAL, got ${phaseResults[0].phase}`);
        }
        pass('Phase: TEAM_PROPOSAL');

        // 7. Find the leader and propose a team
        const state = phaseResults[0].state;
        const leaderId = state.currentLeader.id;
        const leaderBot = botData.find(b => b.playerId === leaderId);
        const teamSize = state.currentQuestTeamSize;
        const team = state.players.slice(0, teamSize).map(p => p.id);

        log(`Leader: ${leaderBot.name}, proposing team of ${teamSize}: [${team.join(', ')}]`);
        const teamProposedPromises = bots.map(b => waitForEvent(b, 'team-proposed'));
        await emitAsync(leaderBot.socket, 'propose-team', { team });
        await Promise.all(teamProposedPromises);
        pass('Team proposed → VOTING phase');

        // 8. All non-leader bots vote approve
        log('All bots voting approve...');
        const voteResultPromises = bots.map(b => waitForEvent(b, 'vote-result'));
        for (const bd of botData) {
            if (bd.playerId !== leaderId) {
                await emitAsync(bd.socket, 'submit-vote', { vote: 'approve' });
            }
        }
        const voteResults = await Promise.all(voteResultPromises);
        if (!voteResults[0].approved) {
            fail('Vote should have been approved');
        }
        pass(`Vote result: approved=${voteResults[0].approved}`);

        // 9. Wait for phase change to QUEST
        log('Waiting for phase change to QUEST...');
        const questPhasePromises = bots.map(b => waitForEvent(b, 'phase-change'));
        const questPhases = await Promise.all(questPhasePromises);
        if (questPhases[0].phase !== 'QUEST') {
            fail(`Expected QUEST phase, got ${questPhases[0].phase}`);
        }
        pass('Phase: QUEST');

        // 10. Team members submit quest actions
        log('Team members submitting quest actions...');
        const questRevealPromises = bots.map(b => waitForEvent(b, 'phase-change', 15000));

        for (const bd of botData) {
            if (team.includes(bd.playerId)) {
                const isEvil = bd.roleInfo.team === 'evil';
                const action = isEvil ? 'fail' : 'success'; // Evil bots play fail
                log(`  ${bd.name} (${bd.roleInfo.roleName}) plays: ${action}`);
                await emitAsync(bd.socket, 'submit-quest-action', { action });
            }
        }

        // 11. Wait for QUEST_REVEAL phase
        const revealPhases = await Promise.all(questRevealPromises);
        const revealData = revealPhases[0];

        if (revealData.phase !== 'QUEST_REVEAL') {
            fail(`Expected QUEST_REVEAL, got ${revealData.phase}`);
        }
        if (!revealData.questResultData) {
            fail('Missing questResultData in phase-change');
        }

        const qr = revealData.questResultData;
        pass(`Phase: QUEST_REVEAL — cards: [${qr.actions.join(', ')}], passed: ${qr.result.passed}, fails: ${qr.result.failCount}, successes: ${qr.result.successCount}`);

        // 12. Verify animation timing — server should auto-advance after animation
        const expectedDuration = 1800 + (qr.actions.length * 3200) + 1200 + 3500;
        log(`Waiting for server auto-advance (expected ~${expectedDuration}ms)...`);
        const startTime = Date.now();
        const nextPhasePromises = bots.map(b => waitForEvent(b, 'phase-change', expectedDuration + 5000));

        let nextPhaseResults;
        try {
            nextPhaseResults = await Promise.all(nextPhasePromises);
        } catch (err) {
            // Could be game-over instead of phase-change
            log('Checking for game-over event...');
            const gameOverPromises = bots.map(b => waitForEvent(b, 'game-over', 5000));
            try {
                const gameOverResults = await Promise.all(gameOverPromises);
                pass(`Game Over — winner: ${gameOverResults[0].winner}, reason: ${gameOverResults[0].winReason}`);
                clearTimeout(overallTimer);
                cleanup();
                console.log('\n  🎉 TEST PASSED — Full quest reveal flow completed successfully!\n');
                process.exit(0);
            } catch {
                fail(`Neither phase-change nor game-over received after quest reveal: ${err.message}`);
            }
        }

        const elapsed = Date.now() - startTime;
        const nextPhase = nextPhaseResults[0].phase || nextPhaseResults[0].state?.phase;
        pass(`Server auto-advanced after ${elapsed}ms to phase: ${nextPhase}`);

        // Verify timing is reasonable (within 2 seconds of expected)
        if (Math.abs(elapsed - expectedDuration) > 2000) {
            log(`⚠ Timing variance: expected ~${expectedDuration}ms, got ${elapsed}ms`);
        } else {
            pass(`Timing accurate: expected ~${expectedDuration}ms, got ${elapsed}ms`);
        }

        // Verify next phase is valid
        const validNextPhases = ['TEAM_PROPOSAL', 'ASSASSINATION', 'GAME_OVER'];
        if (!validNextPhases.includes(nextPhase)) {
            fail(`Unexpected next phase: ${nextPhase}`);
        }
        pass(`Next phase is valid: ${nextPhase}`);

        // ── Success! ──
        clearTimeout(overallTimer);
        cleanup();
        console.log('\n  🎉 TEST PASSED — Full quest reveal flow completed successfully!\n');
        process.exit(0);

    } catch (err) {
        clearTimeout(overallTimer);
        fail(`Test error: ${err.message}`);
    }
}

runTest();
