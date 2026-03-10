const { io } = require("socket.io-client");
const SERVER_URL = "http://localhost:3001";

const fs = require('fs');
fs.writeFileSync('test.log', '');
function log(msg) {
    fs.appendFileSync('test.log', msg + '\n');
}

async function runTest() {
    log("Starting test...");
    const clients = [];
    const connectedPromises = [];

    // Create 5 clients
    for (let i = 0; i < 5; i++) {
        const socket = io(SERVER_URL);
        clients.push(socket);
        connectedPromises.push(new Promise(resolve => socket.on("connect", resolve)));
    }

    await Promise.all(connectedPromises);
    log("All 5 clients connected.");

    const host = clients[0];
    let roomCode = null;

    // Host creates room
    const createRoomPromise = new Promise(resolve => {
        host.emit("create-room", { playerName: "Host" }, res => {
            roomCode = res.roomCode;
            resolve(res);
        });
    });
    await createRoomPromise;
    log(`Room created: ${roomCode}`);

    // Others join
    const joinPromises = [];
    for (let i = 1; i < 5; i++) {
        joinPromises.push(new Promise(resolve => {
            clients[i].emit("join-room", { roomCode, playerName: `Player${i}` }, resolve);
        }));
    }
    await Promise.all(joinPromises);
    log("All players joined.");

    // Start game
    const startPromise = new Promise(resolve => {
        host.on("game-countdown", resolve);
        host.emit("start-game", {}, () => {});
    });
    await startPromise;
    log("Game started, wait for countdown/role reveal...");

    // Wait for role-reveal
    await new Promise(resolve => {
        host.on("role-reveal", resolve);
    });
    log("Roles revealed!");

    // Set up phase-change listener early to avoid missing it
    let currentState = null;
    const teamProposalPromise = new Promise(resolve => {
        const handler = ({ phase, state }) => {
            if (phase === "TEAM_PROPOSAL") {
                currentState = state;
                host.off("phase-change", handler);
                resolve();
            }
        };
        host.on("phase-change", handler);
    });

    // All players ready
    const readyPromises = clients.map(c => new Promise(resolve => {
        c.emit("player-ready", {}, resolve);
    }));
    await Promise.all(readyPromises);
    log("Players ready, entering TEAM_PROPOSAL.");

    await teamProposalPromise;

    log("Proposing team...");
    const leaderId = currentState.currentLeader.id;
    const teamToPropose = currentState.players.slice(0, 2).map(p => p.id);
    
    let proposalSuccess = false;
    for (const c of clients) {
        c.emit("propose-team", { team: teamToPropose }, (res) => {
            if (res && res.error) {
                // Expected for non-leaders
                // log("Propose error:", res.error);
            } else {
                proposalSuccess = true;
                log("Team proposed successfully by leader!");
            }
        });
    }

    // Wait for team-proposed
    await new Promise(resolve => {
        host.on("team-proposed", resolve);
    });
    log("Team proposed, voting...");

    // Set up phase-change listeners for NEXT phases early
    let nextPhaseChangePromise;

    // Vote approve from all
    nextPhaseChangePromise = new Promise(resolve => {
        const handler = ({ phase, state }) => {
            if (phase === "QUEST") {
                host.off("phase-change", handler);
                currentState = state;
                resolve();
            }
        };
        host.on("phase-change", handler);
    });

    for (const c of clients) {
        c.emit("submit-vote", { vote: "approve" }, (res) => {
            if (res && res.error) log("Vote error:", res.error);
        });
    }

    // Wait for vote-result
    await new Promise(resolve => {
        host.on("vote-result", resolve);
    });
    log("Vote result received (approved).");

    await nextPhaseChangePromise;
    log("Phase is QUEST, submitting actions...");

    // Setup reveal promise
    const revealPromise = new Promise(resolve => {
        const handler = ({ phase, state }) => {
            if (phase === "QUEST_REVEAL") {
                log("SUCCESS: Reached QUEST_REVEAL phase!");
                log("Reveal State:", JSON.stringify(state.currentQuestReveal));
                host.off("phase-change", handler);
                resolve();
            }
        };
        host.on("phase-change", handler);
    });

    // Submit quest actions
    for (const c of clients) {
        c.emit("submit-quest-action", { action: "success" }, (res) => {
            if (res && res.error && res.error !== "You are not on this quest team" && res.error !== "Already submitted") {
                 log("Action error:", res.error);
            }
        });
    }

    log("Waiting for phase-change to QUEST_REVEAL...");
    await revealPromise;

    log("Waiting for subsequent phase change after animation timeout...");
    await new Promise(resolve => {
        const handler = ({ phase }) => {
            if (phase === "TEAM_PROPOSAL" || phase === "GAME_OVER") {
                log(`-> Next phase confirmed: ${phase}`);
                host.off("phase-change", handler);
                resolve();
            }
        };
        host.on("phase-change", handler);
    });

    log("TEST COMPLETED SUCCESSFULLY.");
    
    clients.forEach(c => c.disconnect());
    process.exit(0);
}

runTest().catch(console.error);
