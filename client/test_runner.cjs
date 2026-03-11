
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const GameBoard = require('./temp_gameboard.cjs').default;

const mockContext = {
    phase: 'TEAM_PROPOSAL',
    players: [
        {id: '1', name: 'Player1'}, {id: '2', name: 'Player2'}, {id: '3', name: 'Player3'},
        {id: '4', name: 'Player4'}, {id: '5', name: 'Player5'}
    ],
    playerId: '1',
    currentLeader: {id: '1', name: 'Player1'},
    currentQuestIndex: 0,
    rejectionTrack: 0,
    maxRejections: 5,
    questResults: [],
    proposedTeam: [],
    questTeamSizes: [2, 3, 2, 3, 3],
    roleInfo: { team: 'good', roleKey: 'merlin', roleName: 'Merlin' },
    isLeader: true,
    isHost: true,
    proposeTeam: () => {},
    endGame: () => {},
    showingResult: null,
    voteResult: null,
    currentQuestReveal: null,
    winner: null,
    fullReveal: null,
    voteHistory: [],
    leaveRoom: () => {},
};

// We mock useGame
jest = { mock: () => {} }; // pseudo jest
const GameContext = require('./src/context/GameContext');
GameContext.useGame = () => mockContext;

// Execute
try {
    const html = ReactDOMServer.renderToString(React.createElement(GameBoard));
    console.log("RENDER SUCCESS. HTML length:", html.length);
} catch (e) {
    console.error("RENDER FAILED!", e.stack);
}
