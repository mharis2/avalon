import React from 'react';
import { useGame } from '../context/GameContext';
import './VoteHistory.css';

export default function VoteHistory() {
    const { voteHistory, players, currentQuestIndex } = useGame();

    if (!voteHistory || voteHistory.length === 0) {
        return (
            <div className="vote-history">
                <h3 className="heading-display vote-history-title">Vote History</h3>
                <p className="vote-history-empty">No votes yet</p>
            </div>
        );
    }

    // Group by quest
    const quests = {};
    voteHistory.forEach(entry => {
        const qi = entry.questIndex ?? 0;
        if (!quests[qi]) quests[qi] = [];
        quests[qi].push(entry);
    });

    return (
        <div className="vote-history">
            <h3 className="heading-display vote-history-title">Vote History</h3>
            {Object.entries(quests).map(([qi, entries]) => (
                <div key={qi} className="vote-history-quest">
                    <h4 className="vote-history-quest-title">Quest {Number(qi) + 1}</h4>
                    <div className="vote-history-entries">
                        {entries.map((entry, i) => (
                            <div key={i} className={`vote-history-entry ${entry.approved ? 'vote-history-approved' : 'vote-history-rejected'}`}>
                                <div className="vote-history-entry-header">
                                    <span className="vote-history-leader">👑 {entry.leader.name}</span>
                                    <span className={`badge ${entry.approved ? 'badge-good' : 'badge-evil'}`}>
                                        {entry.approved ? 'Approved' : 'Rejected'}
                                    </span>
                                </div>
                                <div className="vote-history-team">
                                    Team: {entry.team.map(p => p.name).join(', ')}
                                </div>
                                <div className="vote-history-votes">
                                    {Object.entries(entry.votes).map(([playerId, vote]) => {
                                        const player = players.find(p => p.id === playerId);
                                        return (
                                            <span
                                                key={playerId}
                                                className={`vote-history-vote ${vote === 'approve' ? 'vote-history-vote-approve' : 'vote-history-vote-reject'}`}
                                            >
                                                {player?.name || '?'} {vote === 'approve' ? '👍' : '👎'}
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
