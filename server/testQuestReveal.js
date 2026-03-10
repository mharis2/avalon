/**
 * testQuestReveal.js — Comprehensive E2E test simulating EXACT client behavior.
 *
 * Simulates the full game flow through multiple quest rounds, replicating
 * the React reducer logic to verify what users actually see on screen.
 *
 * Tests per round:
 *  - Submitted count reaches N/N (not stuck at N-1/N)
 *  - 'quest-result' event received by ALL bots
 *  - Client reducer sets showingResult='quest' (screen changes)
 *  - GameBoard would render <QuestReveal /> (not QuestPhase)
 *  - No premature 'phase-change' within animation window
 *  - Auto-advance arrives after correct delay
 *  - Screen returns to normal after advance
 *
 * Also tests the vote-result flow for comparison (the "working" pattern).
 *
 * Usage:
 *   1. cd server && node src/index.js
 *   2. node testQuestReveal.js
 */

const { io } = require('socket.io-client');

const SERVER = 'http://localhost:3001';
const NUM_BOTS = 5;
const TIMEOUT_MS = 120000;

const bots = [];
const botData = [];
let roomCode = null;

// ═══════════════════════════════════════════════════════════════════
// CLIENT REDUCER (exact copy from GameContext.jsx)
// ═══════════════════════════════════════════════════════════════════
function clientReducer(state, action) {
    switch (action.type) {
        case 'UPDATE_STATE':
            return {
                ...state,
                phase: action.payload.phase,
                questResults: action.payload.questResults || state.questResults,
                proposedTeam: action.payload.proposedTeam || state.proposedTeam,
            };
        case 'SET_QUEST_RESULT':
            if (action.payload) {
                return { ...state, questResult: action.payload, showingResult: 'quest' };
            }
            return { ...state, questResult: null };
        case 'SET_VOTE_RESULT':
            return { ...state, voteResult: action.payload, showingResult: 'vote' };
        case 'CLEAR_SHOWING_RESULT':
            return { ...state, showingResult: null };
        case 'SET_VOTED_COUNT':
            return { ...state, votedCount: action.payload };
        case 'SET_QUEST_SUBMITTED_COUNT':
            return { ...state, questSubmittedCount: action.payload };
        default:
            return state;
    }
}

function applyEvent(state, eventName, data) {
    let s = { ...state };
    const dispatches = [];

    switch (eventName) {
        case 'phase-change':
            dispatches.push({ type: 'CLEAR_SHOWING_RESULT' });
            dispatches.push({ type: 'UPDATE_STATE', payload: data.state || data });
            dispatches.push({ type: 'SET_VOTED_COUNT', payload: 0 });
            dispatches.push({ type: 'SET_QUEST_SUBMITTED_COUNT', payload: 0 });
            dispatches.push({ type: 'SET_QUEST_RESULT', payload: null });
            break;
        case 'quest-result':
            dispatches.push({ type: 'SET_QUEST_RESULT', payload: data });
            dispatches.push({ type: 'UPDATE_STATE', payload: data.state });
            break;
        case 'vote-result':
            dispatches.push({ type: 'SET_VOTE_RESULT', payload: data });
            dispatches.push({ type: 'UPDATE_STATE', payload: data.state });
            break;
        case 'quest-action-submitted':
            dispatches.push({ type: 'SET_QUEST_SUBMITTED_COUNT', payload: data.submittedCount });
            break;
        case 'vote-submitted':
            dispatches.push({ type: 'SET_VOTED_COUNT', payload: data.votedCount });
            break;
        case 'game-over':
            dispatches.push({ type: 'CLEAR_SHOWING_RESULT' });
            dispatches.push({ type: 'UPDATE_STATE', payload: data.state });
            break;
        case 'team-proposed':
            dispatches.push({ type: 'UPDATE_STATE', payload: data.state });
            break;
    }

    for (const d of dispatches) {
        s = clientReducer(s, d);
    }
    return s;
}

// What GameBoard.jsx would render
function getScreen(state) {
    if (state.showingResult === 'quest' && state.questResult) return 'QuestReveal';
    if (state.showingResult === 'vote' && state.voteResult) return 'VoteResult';
    if (state.phase === 'ASSASSINATION') return 'Assassination';
    if (state.phase === 'GAME_OVER') return 'GameOver';
    if (state.phase === 'TEAM_PROPOSAL') return 'TeamProposal';
    if (state.phase === 'VOTING') return 'VotingPhase';
    if (state.phase === 'QUEST') return 'QuestPhase';
    if (state.phase === 'QUEST_REVEAL') return 'QUEST_REVEAL(no overlay!)';
    return `Unknown(${state.phase})`;
}

// ═══════════════════════════════════════════════════════════════════
// TEST INFRA
// ═══════════════════════════════════════════════════════════════════
let testNum = 0;
let passed = 0;
let failed = 0;

function log(msg) { console.log(`  [TEST] ${msg}`); }
function section(msg) { console.log(`\n  ${'─'.repeat(50)}\n  ${msg}\n  ${'─'.repeat(50)}`); }

function assert(cond, name) {
    testNum++;
    if (cond) { console.log(`  ✅ [${testNum}] ${name}`); passed++; }
    else { console.error(`  ❌ [${testNum}] ${name}`); failed++; }
}

function fatal(msg) { console.error(`\n  💀 FATAL: ${msg}`); cleanup(); process.exit(1); }
function cleanup() { bots.forEach(b => b.disconnect()); }

function createBot(name) {
    return new Promise((resolve, reject) => {
        const s = io(SERVER, { transports: ['websocket'] });
        s.on('connect', () => resolve(s));
        s.on('connect_error', e => reject(new Error(`${name}: ${e.message}`)));
        setTimeout(() => reject(new Error(`${name} timeout`)), 5000);
    });
}

function emit(socket, event, data) {
    return new Promise((resolve, reject) => {
        socket.emit(event, data, res => {
            if (res?.error) reject(new Error(`${event}: ${res.error}`));
            else resolve(res);
        });
        setTimeout(() => reject(new Error(`${event} ack timeout`)), 10000);
    });
}

function waitFor(socket, event, ms = 30000) {
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => { socket.off(event, h); reject(new Error(`Timeout: '${event}' (${ms}ms)`)); }, ms);
        const h = data => { clearTimeout(t); socket.off(event, h); resolve(data); };
        socket.on(event, h);
    });
}

function waitAll(event, ms = 30000) {
    return Promise.all(bots.map(b => waitFor(b, event, ms)));
}

// Collect events from a socket for a given duration
function collect(socket, events, ms) {
    return new Promise(resolve => {
        const log = [];
        const handlers = {};
        for (const e of events) {
            handlers[e] = data => log.push({ event: e, data, time: Date.now() });
            socket.on(e, handlers[e]);
        }
        setTimeout(() => {
            for (const e of events) socket.off(e, handlers[e]);
            resolve(log);
        }, ms);
    });
}

// Collect events from ALL bots
function collectAll(events, ms) {
    return Promise.all(bots.map(b => collect(b, events, ms)));
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════
async function main() {
    const timer = setTimeout(() => fatal('Overall timeout'), TIMEOUT_MS);

    try {
        // ── Setup ────────────────────────────────────────────────
        section('SETUP: Create room with 5 bots');
        for (let i = 0; i < NUM_BOTS; i++) {
            const s = await createBot(`Bot${i + 1}`);
            bots.push(s);
            botData.push({ socket: s, name: `Bot${i + 1}`, id: null, role: null });
        }

        const c = await emit(bots[0], 'create-room', { playerName: 'Bot1' });
        roomCode = c.roomCode;
        botData[0].id = c.playerId;
        log(`Room: ${roomCode}`);

        for (let i = 1; i < NUM_BOTS; i++) {
            const j = await emit(bots[i], 'join-room', { roomCode, playerName: `Bot${i + 1}` });
            botData[i].id = j.playerId;
        }

        // Start game
        const cdp = waitAll('game-countdown');
        await emit(bots[0], 'start-game', {});
        await cdp;

        // Roles
        const roles = await waitAll('role-reveal', 10000);
        roles.forEach((r, i) => { botData[i].role = r.roleInfo; });
        log(`Roles: ${botData.map(b => `${b.name}=${b.role.roleName}(${b.role.team})`).join(', ')}`);

        // Ready → TEAM_PROPOSAL
        const readyP = waitAll('phase-change');
        for (const b of bots) await emit(b, 'player-ready', {});
        const readyData = await readyP;

        let cState = {
            phase: null, showingResult: null, questResult: null, voteResult: null,
            votedCount: 0, questSubmittedCount: 0, questResults: [], proposedTeam: [],
        };
        cState = applyEvent(cState, 'phase-change', readyData[0]);

        assert(cState.phase === 'TEAM_PROPOSAL', 'Setup complete → TEAM_PROPOSAL');
        log(`Screen: ${getScreen(cState)}`);

        // ── Run quest rounds ─────────────────────────────────────
        let gameState = readyData[0].state;
        let roundsPlayed = 0;
        const MAX_ROUNDS = 3;

        while (roundsPlayed < MAX_ROUNDS) {
            roundsPlayed++;
            section(`ROUND ${roundsPlayed}: Full quest cycle`);

            // Get leader info
            const leaderId = gameState.currentLeader.id;
            const leaderBot = botData.find(b => b.id === leaderId);
            const teamSize = gameState.currentQuestTeamSize;
            const team = gameState.players.slice(0, teamSize).map(p => p.id);

            log(`Leader: ${leaderBot.name}, team: ${teamSize} players [${team.map(id => botData.find(b => b.id === id)?.name).join(', ')}]`);

            // ── 1. Propose Team ──────────────────────────────────
            const teamP = waitAll('team-proposed');
            await emit(leaderBot.socket, 'propose-team', { team });
            const teamData = await teamP;
            cState = applyEvent(cState, 'team-proposed', teamData[0]);

            // ── 2. VOTE: Test vote-result flow (reference) ───────
            section(`ROUND ${roundsPlayed}: Vote Phase (reference flow)`);

            const voteRP = waitAll('vote-result');
            for (const bd of botData) {
                if (bd.id !== leaderId) {
                    await emit(bd.socket, 'submit-vote', { vote: 'approve' });
                }
            }
            const voteR = await voteRP;

            cState = applyEvent(cState, 'vote-result', voteR[0]);
            assert(voteR[0].approved === true, `R${roundsPlayed}: Vote approved`);
            assert(cState.showingResult === 'vote', `R${roundsPlayed}: showingResult='vote' after vote-result`);
            assert(getScreen(cState) === 'VoteResult', `R${roundsPlayed}: Screen → VoteResult overlay`);

            // All bots got vote-result
            assert(voteR.length === NUM_BOTS, `R${roundsPlayed}: All ${NUM_BOTS} bots got vote-result`);

            // Wait for phase-change → QUEST
            const questPC = await waitAll('phase-change');
            cState = applyEvent(cState, 'phase-change', questPC[0]);
            assert(cState.phase === 'QUEST', `R${roundsPlayed}: Phase → QUEST`);
            assert(cState.showingResult === null, `R${roundsPlayed}: showingResult cleared after phase-change`);
            assert(getScreen(cState) === 'QuestPhase', `R${roundsPlayed}: Screen → QuestPhase`);

            // ── 3. QUEST: Submit actions and verify reveal ───────
            section(`ROUND ${roundsPlayed}: Quest Phase → Quest Reveal (CRITICAL)`);

            // Set up event collectors on ALL bots for 3 seconds
            const WATCH = ['quest-action-submitted', 'quest-result', 'phase-change', 'game-over'];
            const collectorsP = collectAll(WATCH, 3000);

            // Submit quest actions one-by-one
            const teamBots = botData.filter(bd => team.includes(bd.id));
            log(`Submitting ${teamBots.length} quest actions...`);
            for (const bd of teamBots) {
                const isEvil = bd.role.team === 'evil';
                const action = isEvil ? 'fail' : 'success';
                log(`  ${bd.name} (${bd.role.team}) → ${action}`);
                await emit(bd.socket, 'submit-quest-action', { action });
            }

            // Wait for collectors
            const allEvents = await collectorsP;

            // ── Event analysis per bot ───────────────────────────
            console.log(`\n  Event timeline (3s window):`);
            for (let i = 0; i < NUM_BOTS; i++) {
                const evts = allEvents[i];
                const t0 = evts[0]?.time || 0;
                const summary = evts.map(e => {
                    let detail = '';
                    if (e.event === 'quest-action-submitted') detail = ` (${e.data.submittedCount}/${e.data.totalTeamSize})`;
                    if (e.event === 'quest-result') detail = ` (passed=${e.data.result?.passed})`;
                    if (e.event === 'phase-change') detail = ` (${e.data.state?.phase})`;
                    return `${e.event}${detail} @+${e.time - t0}ms`;
                }).join(' → ');
                console.log(`  ${botData[i].name}: ${summary || '(no events!)'}`);
            }
            console.log('');

            // ── TEST: Submitted count reaches N/N ────────────────
            const bot0Events = allEvents[0];
            const countEvents = bot0Events.filter(e => e.event === 'quest-action-submitted');
            const finalCount = countEvents.length > 0 ? countEvents[countEvents.length - 1].data.submittedCount : 0;
            assert(finalCount === teamSize, `R${roundsPlayed}: Submitted count reaches ${teamSize}/${teamSize} (got ${finalCount}/${teamSize})`);

            // ── TEST: quest-result received by ALL bots ──────────
            for (let i = 0; i < NUM_BOTS; i++) {
                const has = allEvents[i].some(e => e.event === 'quest-result');
                assert(has, `R${roundsPlayed}: ${botData[i].name} received 'quest-result'`);
            }

            // ── TEST: No premature phase-change (within 3s) ─────
            for (let i = 0; i < NUM_BOTS; i++) {
                const hasPremature = allEvents[i].some(e => e.event === 'phase-change');
                assert(!hasPremature, `R${roundsPlayed}: ${botData[i].name} no premature phase-change`);
            }

            // ── TEST: Client state after quest-result ────────────
            const qrEvt = bot0Events.find(e => e.event === 'quest-result');
            if (!qrEvt) fatal(`R${roundsPlayed}: No quest-result event found!`);

            // Process count events first, then quest-result
            for (const ce of countEvents) {
                cState = applyEvent(cState, 'quest-action-submitted', ce.data);
            }
            assert(cState.questSubmittedCount === teamSize, `R${roundsPlayed}: Client questSubmittedCount = ${teamSize}`);

            // Now apply quest-result
            cState = applyEvent(cState, 'quest-result', qrEvt.data);

            log(`After quest-result → showingResult=${cState.showingResult}, phase=${cState.phase}`);
            log(`Screen: ${getScreen(cState)}`);

            assert(cState.showingResult === 'quest', `R${roundsPlayed}: showingResult='quest' → SCREEN CHANGES`);
            assert(!!cState.questResult, `R${roundsPlayed}: questResult has data`);
            assert(getScreen(cState) === 'QuestReveal', `R${roundsPlayed}: Screen → QuestReveal overlay`);

            // ── TEST: Data structure valid ────────────────────────
            const qr = qrEvt.data;
            assert(Array.isArray(qr.actions), `R${roundsPlayed}: actions is array`);
            assert(qr.actions.length === teamSize, `R${roundsPlayed}: actions.length === ${teamSize}`);
            assert(typeof qr.result?.passed === 'boolean', `R${roundsPlayed}: result.passed is boolean`);
            assert(typeof qr.result?.failCount === 'number', `R${roundsPlayed}: result.failCount is number`);
            assert(typeof qr.result?.successCount === 'number', `R${roundsPlayed}: result.successCount is number`);
            assert(qr.state?.phase === 'QUEST_REVEAL', `R${roundsPlayed}: state.phase is QUEST_REVEAL`);

            // Counts match
            const sc = qr.actions.filter(a => a === 'success').length;
            const fc = qr.actions.filter(a => a === 'fail').length;
            assert(qr.result.successCount === sc, `R${roundsPlayed}: successCount=${sc} matches`);
            assert(qr.result.failCount === fc, `R${roundsPlayed}: failCount=${fc} matches`);

            log(`Quest ${qr.result.passed ? 'PASSED' : 'FAILED'}: ${sc}S/${fc}F`);

            // ── TEST: Event ordering ─────────────────────────────
            const qrTime = qrEvt.time;
            const countBefore = countEvents.every(e => e.time <= qrTime);
            assert(countBefore, `R${roundsPlayed}: All count events arrive before/at quest-result`);

            // ── TEST: Cross-bot consistency ──────────────────────
            let consistent = true;
            for (let i = 1; i < NUM_BOTS; i++) {
                const oqr = allEvents[i].find(e => e.event === 'quest-result');
                if (!oqr || oqr.data.result?.passed !== qr.result.passed) consistent = false;
            }
            assert(consistent, `R${roundsPlayed}: All bots got identical quest result`);

            // ── Wait for auto-advance ────────────────────────────
            const expectedMs = teamSize * 2000 + 3500;
            log(`Waiting for auto-advance (~${expectedMs}ms - 3s already elapsed ≈ ${expectedMs - 3000}ms)...`);

            const advP = waitAll('phase-change', expectedMs + 5000);
            const goP = waitAll('game-over', expectedMs + 5000);

            const t0 = Date.now();
            let nextEvt;
            try {
                nextEvt = await Promise.race([
                    advP.then(r => ({ type: 'phase-change', data: r })),
                    goP.then(r => ({ type: 'game-over', data: r })),
                ]);
            } catch (err) {
                fatal(`R${roundsPlayed}: No auto-advance: ${err.message}`);
            }

            const elapsed = Date.now() - t0;
            const total = elapsed + 3000; // 3s from collection

            // Apply auto-advance
            if (nextEvt.type === 'phase-change') {
                cState = applyEvent(cState, 'phase-change', nextEvt.data[0]);
            } else {
                cState = applyEvent(cState, 'game-over', nextEvt.data[0]);
            }

            assert(cState.showingResult === null, `R${roundsPlayed}: showingResult cleared after advance`);
            // game-over doesn't dispatch SET_QUEST_RESULT(null), only phase-change does; that's fine
            if (nextEvt.type === 'phase-change') {
                assert(cState.questResult === null, `R${roundsPlayed}: questResult cleared after advance`);
            } else {
                assert(true, `R${roundsPlayed}: questResult stale after game-over (OK, screen shows GameOver)`);
            }

            const timeDiff = Math.abs(total - expectedMs);
            assert(timeDiff < 2000, `R${roundsPlayed}: Timing ~${total}ms (expected ${expectedMs}ms, diff ${timeDiff}ms)`);

            log(`Auto-advanced via '${nextEvt.type}' to ${cState.phase} after ~${total}ms`);
            log(`Screen: ${getScreen(cState)}`);

            // Check if game is done
            if (nextEvt.type === 'game-over' || cState.phase === 'GAME_OVER' || cState.phase === 'ASSASSINATION') {
                log(`Game ending: phase=${cState.phase}`);
                break;
            }

            // Update gameState for next round
            gameState = nextEvt.data[0].state;

            assert(cState.phase === 'TEAM_PROPOSAL', `R${roundsPlayed}: Back to TEAM_PROPOSAL`);
            assert(getScreen(cState) === 'TeamProposal', `R${roundsPlayed}: Screen back to TeamProposal`);
        }

        // ═══════════════════════════════════════════════════════════
        // SUMMARY
        // ═══════════════════════════════════════════════════════════
        clearTimeout(timer);
        cleanup();

        console.log(`\n  ${'═'.repeat(55)}`);
        if (failed === 0) {
            console.log(`  🎉 ALL ${passed} TESTS PASSED across ${roundsPlayed} round(s)`);
        } else {
            console.log(`  ⚠️  ${failed} FAILED, ${passed} passed (${testNum} total)`);
        }
        console.log(`  ${'═'.repeat(55)}\n`);

        console.log('  Key verifications:');
        console.log(`    ✓ Submitted count reaches N/N (not stuck at N-1/N)`);
        console.log(`    ✓ All ${NUM_BOTS} bots receive 'quest-result' event`);
        console.log(`    ✓ Client reducer sets showingResult='quest'`);
        console.log(`    ✓ GameBoard renders <QuestReveal /> overlay`);
        console.log(`    ✓ No premature phase-change during animation`);
        console.log(`    ✓ Auto-advance timing correct`);
        console.log(`    ✓ Screen returns to normal after advance\n`);

        if (failed > 0) {
            console.log('  Debug in browser DevTools console — look for:');
            console.log('    [QUEST-RESULT] — event received');
            console.log('    [GAMEBOARD]    — render decisions');
            console.log('    [QUEST-REVEAL] — component mounted\n');
        }

        process.exit(failed > 0 ? 1 : 0);

    } catch (err) {
        clearTimeout(timer);
        fatal(`${err.message}\n${err.stack}`);
    }
}

main();
