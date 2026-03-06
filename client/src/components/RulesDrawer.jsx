import React from 'react';
import './RulesDrawer.css';

export default function RulesDrawer({ onClose }) {
    return (
        <div className="drawer-overlay" onClick={onClose}>
            <div className="drawer glass-card" onClick={e => e.stopPropagation()}>
                <div className="drawer-header">
                    <h2 className="heading-display drawer-title">Game Rules</h2>
                    <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
                </div>

                <div className="drawer-content">
                    {/* Overview */}
                    <section className="drawer-section">
                        <h3 className="drawer-section-title">Overview</h3>
                        <p>Avalon is a game of hidden loyalty. Players are secretly assigned to either the <strong style={{ color: 'var(--good-primary)' }}>Good</strong> team (Loyal Servants of Arthur) or the <strong style={{ color: 'var(--evil-primary)' }}>Evil</strong> team (Minions of Mordred).</p>
                    </section>

                    {/* Win Conditions */}
                    <section className="drawer-section">
                        <h3 className="drawer-section-title">Win Conditions</h3>
                        <div className="drawer-win">
                            <div className="drawer-win-card drawer-win-good">
                                <h4>Good Wins If:</h4>
                                <ul>
                                    <li>3 quests are completed successfully</li>
                                    <li>AND the Assassin fails to identify Merlin</li>
                                </ul>
                            </div>
                            <div className="drawer-win-card drawer-win-evil">
                                <h4>Evil Wins If:</h4>
                                <ul>
                                    <li>3 quests fail</li>
                                    <li>5 consecutive teams are rejected</li>
                                    <li>Assassin correctly identifies Merlin</li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    {/* Turn Structure */}
                    <section className="drawer-section">
                        <h3 className="drawer-section-title">Turn Structure</h3>
                        <ol className="drawer-steps">
                            <li><strong>Team Proposal:</strong> The leader proposes a team for the quest.</li>
                            <li><strong>Vote:</strong> All players vote to approve or reject. Majority rules.</li>
                            <li><strong>Quest:</strong> If approved, team members secretly play Success or Fail cards.</li>
                            <li><strong>Result:</strong> If even one Fail card is played, the quest fails (except Quest 4 with 7+ players, which requires 2 fails).</li>
                        </ol>
                    </section>

                    {/* Team Sizes */}
                    <section className="drawer-section">
                        <h3 className="drawer-section-title">Quest Team Sizes</h3>
                        <table className="drawer-table">
                            <thead>
                                <tr>
                                    <th>Players</th><th>Q1</th><th>Q2</th><th>Q3</th><th>Q4</th><th>Q5</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr><td>5</td><td>2</td><td>3</td><td>2</td><td>3</td><td>3</td></tr>
                                <tr><td>6</td><td>2</td><td>3</td><td>4</td><td>3</td><td>4</td></tr>
                                <tr><td>7</td><td>2</td><td>3</td><td>3</td><td>4*</td><td>4</td></tr>
                                <tr><td>8</td><td>3</td><td>4</td><td>4</td><td>5*</td><td>5</td></tr>
                                <tr><td>9</td><td>3</td><td>4</td><td>4</td><td>5*</td><td>5</td></tr>
                                <tr><td>10</td><td>3</td><td>4</td><td>4</td><td>5*</td><td>5</td></tr>
                            </tbody>
                        </table>
                        <p className="drawer-note">* Requires 2 fail cards to fail</p>
                    </section>

                    {/* Characters */}
                    <section className="drawer-section">
                        <h3 className="drawer-section-title">Character Glossary</h3>
                        <div className="drawer-characters">
                            <div className="drawer-char drawer-char-good">
                                <strong>Merlin</strong> <span className="badge badge-good">Good</span>
                                <p>Knows all evil players (except Mordred). Must remain hidden as the Assassin will try to identify them.</p>
                            </div>
                            <div className="drawer-char drawer-char-good">
                                <strong>Percival</strong> <span className="badge badge-good">Good</span>
                                <p>Sees Merlin and Morgana, but does not know which is which.</p>
                            </div>
                            <div className="drawer-char drawer-char-good">
                                <strong>Loyal Servant</strong> <span className="badge badge-good">Good</span>
                                <p>No special abilities. Must use deduction.</p>
                            </div>
                            <div className="drawer-char drawer-char-evil">
                                <strong>Assassin</strong> <span className="badge badge-evil">Evil</span>
                                <p>If Good passes 3 quests, gets one chance to kill Merlin and steal the win.</p>
                            </div>
                            <div className="drawer-char drawer-char-evil">
                                <strong>Morgana</strong> <span className="badge badge-evil">Evil</span>
                                <p>Appears as Merlin to Percival, creating confusion.</p>
                            </div>
                            <div className="drawer-char drawer-char-evil">
                                <strong>Mordred</strong> <span className="badge badge-evil">Evil</span>
                                <p>Invisible to Merlin. Makes Merlin's job harder.</p>
                            </div>
                            <div className="drawer-char drawer-char-evil">
                                <strong>Oberon</strong> <span className="badge badge-evil">Evil</span>
                                <p>Does not reveal to other evil players, and does not know who they are.</p>
                            </div>
                            <div className="drawer-char drawer-char-evil">
                                <strong>Minion of Mordred</strong> <span className="badge badge-evil">Evil</span>
                                <p>Knows other evil players (except Oberon). No special abilities.</p>
                            </div>
                        </div>
                    </section>

                    {/* Player Distribution */}
                    <section className="drawer-section">
                        <h3 className="drawer-section-title">Player Distribution</h3>
                        <table className="drawer-table">
                            <thead>
                                <tr><th>Players</th><th>Good</th><th>Evil</th></tr>
                            </thead>
                            <tbody>
                                <tr><td>5</td><td>3</td><td>2</td></tr>
                                <tr><td>6</td><td>4</td><td>2</td></tr>
                                <tr><td>7</td><td>4</td><td>3</td></tr>
                                <tr><td>8</td><td>5</td><td>3</td></tr>
                                <tr><td>9</td><td>6</td><td>3</td></tr>
                                <tr><td>10</td><td>6</td><td>4</td></tr>
                            </tbody>
                        </table>
                    </section>
                </div>
            </div>
        </div>
    );
}
