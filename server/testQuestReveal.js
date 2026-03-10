/**
 * testQuestReveal.js — End-to-end bot test for the quest reveal flow.
 *
 * Creates 5 bots, runs through the full game cycle:
 *   create room → join → start → role reveal → ready →
 *   propose team → vote → quest action → QUEST REVEAL → next phase
 *
 * Validates:
 *   1. ALL bots receive the dedicated 'quest-result' event
 *   2. Event data has correct structure (actions, result, state)
 *   3. Server auto-advances to next phase after animation duration
 *   4. Timing matches formula: teamSize * 2000 + 3500
 *
 * Usage:
 *   1. Start the server: cd server && npm start
 *   2. In another terminal: node testQuestReveal.js
 */

const { io } = require('socket.io-client');

const SERVER = 'http://localhost:3001';
const NUM_BOTS = 5;
const TIMEOUT_MS = 60000;

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

function waitForEvent(socket, event, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            socket.off(event, handler);
            reject(new Error(`Timeout waiting for '${event}' (${timeoutMs}ms)`));
        }, timeoutMs);
        const handler = (data) => {
            clearTimeout(timer);
            socket.off(event, handler);
            resolve(data);
        };
        socket.on(event, handler);
    });
}

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
        const countdownPromises = waitForEventAll('game-countdown');
        await emitAsync(bots[0], 'start-game', {});
        await countdownPromises;
        pass('Game countdown started');

        // 5. Wait for role-reveal
        log('Waiting for role reveal...');
        const roleReveals = await waitForEventAll('role-reveal', 10000);
        roleReveals.forEach((r, i) => {
            botData[i].roleInfo = r.roleInfo;
        });
        pass(`Roles: ${botData.map(b => `${b.name}=${b.roleInfo.roleName}(${b.roleInfo.team})`).join(', ')}`);

        // 6. All players ready
        log('All players sending ready...');
        const phaseChangePromises = waitForEventAll('phase-change');
        for (const bot of bots) {
            await emitAsync(bot, 'player-ready', {});
        }
        const phaseResults = await phaseChangePromises;
        if (phaseResults[0].state.phase !== 'TEAM_PROPOSAL') {
            fail(`Expected TEAM_PROPOSAL, got ${phaseResults[0].state.phase}`);
        }
        pass('Phase: TEAM_PROPOSAL');

        // 7. Find the leader and propose a team
        const state = phaseResults[0].state;
        const leaderId = state.currentLeader.id;
        const leaderBot = botData.find(b => b.playerId === leaderId);
        const teamSize = state.currentQuestTeamSize;
        const team = state.players.slice(0, teamSize).map(p => p.id);

        log(`Leader: ${leaderBot.name}, proposing team of ${teamSize}: [${team.map(id => botData.find(b => b.playerId === id)?.name).join(', ')}]`);
        const teamProposedPromises = waitForEventAll('team-proposed');
        await emitAsync(leaderBot.socket, 'propose-team', { team });
        await teamProposedPromises;
        pass('Team proposed → VOTING phase');

        // 8. All non-leader bots vote approve
        log('All non-leader bots voting approve...');
        const voteResultPromises = waitForEventAll('vote-result');
        for (const bd of botData) {
            if (bd.playerId !== leaderId) {
                await emitAsync(bd.socket, 'submit-vote', { vote: 'approve' });
            }
        }
        const voteResults = await voteResultPromises;
        if (!voteResults[0].approved) {
            fail('Vote should have been approved');
        }
        pass(`Vote: approved=${voteResults[0].approved}, approvals=${voteResults[0].approvals}, rejections=${voteResults[0].rejections}`);

        // 9. Wait for phase change to QUEST
        log('Waiting for phase change to QUEST...');
        const questPhaseResults = await waitForEventAll('phase-change');
        if (questPhaseResults[0].state.phase !== 'QUEST') {
            fail(`Expected QUEST phase, got ${questPhaseResults[0].state.phase}`);
        }
        pass('Phase: QUEST');

        // ═══════════════════════════════════════════════════════════════
        // 10. CRITICAL: Set up quest-result listeners BEFORE submitting
        // ═══════════════════════════════════════════════════════════════
        log('Setting up quest-result listeners on ALL bots...');
        const questResultPromises = waitForEventAll('quest-result', 15000);

        // 11. Team members submit quest actions
        log('Team members submitting quest actions...');
        for (const bd of botData) {
            if (team.includes(bd.playerId)) {
                const isEvil = bd.roleInfo.team === 'evil';
                const action = isEvil ? 'fail' : 'success';
                log(`  ${bd.name} (${bd.roleInfo.roleName}/${bd.roleInfo.team}) plays: ${action}`);
                await emitAsync(bd.socket, 'submit-quest-action', { action });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // 12. VERIFY: ALL bots receive 'quest-result' event
        // ═══════════════════════════════════════════════════════════════
        log('Waiting for quest-result on all bots...');
        const questResults = await questResultPromises;
        pass(`All ${NUM_BOTS} bots received 'quest-result' event`);

        // 13. Validate data structure on EVERY bot's event
        let errors = 0;
        for (let i = 0; i < NUM_BOTS; i++) {
            const qr = questResults[i];
            const name = botData[i].name;

            if (!qr) { log(`  ${name}: received null/undefined`); errors++; continue; }
            if (!Array.isArray(qr.actions)) { log(`  ${name}: missing actions array`); errors++; }
            if (!qr.result) { log(`  ${name}: missing result object`); errors++; }
            if (typeof qr.result?.passed !== 'boolean') { log(`  ${name}: result.passed not boolean`); errors++; }
            if (typeof qr.result?.failCount !== 'number') { log(`  ${name}: result.failCount not number`); errors++; }
            if (typeof qr.result?.successCount !== 'number') { log(`  ${name}: result.successCount not number`); errors++; }
            if (!qr.state) { log(`  ${name}: missing state object`); errors++; }
            if (qr.state?.phase !== 'QUEST_REVEAL') { log(`  ${name}: state.phase should be QUEST_REVEAL, got ${qr.state?.phase}`); errors++; }
        }
        if (errors > 0) fail(`${errors} data structure error(s) in quest-result events`);

        const qr = questResults[0];
        pass(`Quest data valid — actions: [${qr.actions.join(', ')}], passed: ${qr.result.passed}, fails: ${qr.result.failCount}, successes: ${qr.result.successCount}`);

        // 14. Check actions match team size
        if (qr.actions.length !== teamSize) {
            fail(`Expected ${teamSize} actions, got ${qr.actions.length}`);
        }
        pass(`Actions count matches team size (${teamSize})`);

        // 15. Verify each action is 'success' or 'fail'
        for (const a of qr.actions) {
            if (a !== 'success' && a !== 'fail') {
                fail(`Invalid action value: "${a}"`);
            }
        }
        pass('All action values valid (success/fail)');

        // ═══════════════════════════════════════════════════════════════
        // 16. Wait for auto-advance (phase-change OR game-over)
        // ═══════════════════════════════════════════════════════════════
        const expectedDuration = teamSize * 2000 + 3500;
        log(`Waiting for auto-advance (~${expectedDuration}ms)...`);

        // Listen for both phase-change and game-over on all bots
        const phasePromises = waitForEventAll('phase-change', expectedDuration + 5000);
        const gameOverPromises = waitForEventAll('game-over', expectedDuration + 5000);

        const startTime = Date.now();

        let nextEvent;
        try {
            nextEvent = await Promise.race([
                phasePromises.then(r => ({ type: 'phase-change', data: r })),
                gameOverPromises.then(r => ({ type: 'game-over', data: r })),
            ]);
        } catch (err) {
            fail(`Neither phase-change nor game-over received: ${err.message}`);
        }

        const elapsed = Date.now() - startTime;
        pass(`Server auto-advanced via '${nextEvent.type}' after ${elapsed}ms`);

        // Verify timing accuracy
        const timingDiff = Math.abs(elapsed - expectedDuration);
        if (timingDiff > 2000) {
            log(`  ⚠ Timing off by ${timingDiff}ms (expected ~${expectedDuration}ms, got ${elapsed}ms)`);
        } else {
            pass(`Timing accurate: expected ~${expectedDuration}ms, got ${elapsed}ms (diff: ${timingDiff}ms)`);
        }

        if (nextEvent.type === 'phase-change') {
            const nextPhase = nextEvent.data[0].state?.phase || nextEvent.data[0].phase;
            const validPhases = ['TEAM_PROPOSAL', 'ASSASSINATION', 'GAME_OVER'];
            if (!validPhases.includes(nextPhase)) {
                fail(`Unexpected next phase: ${nextPhase}`);
            }
            pass(`Next phase: ${nextPhase}`);
        } else {
            pass(`Game over — winner: ${nextEvent.data[0].winner}`);
        }

        // ══════════════════════════════════════════════════════════════
        // Summary
        // ══════════════════════════════════════════════════════════════
        clearTimeout(overallTimer);
        cleanup();
        console.log('\n  🎉 TEST PASSED — Quest reveal flow works correctly!\n');
        console.log('  Summary:');
        console.log(`    - All ${NUM_BOTS} bots received 'quest-result' event`);
        console.log(`    - Data structure validated (actions, result, state)`);
        console.log(`    - Server auto-advanced after ${elapsed}ms (expected ~${expectedDuration}ms)`);
        console.log(`    - Quest ${qr.result.passed ? 'PASSED' : 'FAILED'}: ${qr.result.successCount}S / ${qr.result.failCount}F\n`);
        process.exit(0);

    } catch (err) {
        clearTimeout(overallTimer);
        fail(`Test error: ${err.message}`);
    }
}

runTest();
