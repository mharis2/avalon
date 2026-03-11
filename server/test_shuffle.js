const { shuffle } = require('./src/gameLogic.js');

const actions = ['fail', 'success', 'success', 'success', 'success'];

for (let i = 0; i < 5; i++) {
    console.log(`Run ${i + 1}:`, shuffle(actions));
}
