const Room = require('./src/Room.js');
const { PHASES } = require('./src/constants.js');

const room = new Room('TEST', { id: 'host1', name: 'Host' });
room.addPlayer({ id: 'p2', name: 'P2' });
room.addPlayer({ id: 'p3', name: 'P3' });
room.addPlayer({ id: 'p4', name: 'P4' });
room.addPlayer({ id: 'p5', name: 'P5' });

room.startGame();
room.phase = PHASES.TEAM_PROPOSAL;

for (let i = 0; i < 5; i++) {
    room.proposeTeam('host1', ['host1', 'p2', 'p3', 'p4', 'p5']);
    
    room.submitVote('host1', 'approve');
    room.submitVote('p2', 'approve');
    room.submitVote('p3', 'approve');
    room.submitVote('p4', 'approve');
    room.submitVote('p5', 'approve');
    
    room.resolveVotes(); // goes to POST_VOTE or QUEST directly, wait check
    
    // Now in QUEST phase
    room.submitQuestAction('host1', 'fail');
    room.submitQuestAction('p2', 'success');
    room.submitQuestAction('p3', 'success');
    room.submitQuestAction('p4', 'success');
    room.submitQuestAction('p5', 'success');
    
    const result = room.resolveQuest();
    console.log(`Run ${i + 1} actions:`, result.actions);
    
    // reset phase for next loop
    room.phase = PHASES.TEAM_PROPOSAL;
}
