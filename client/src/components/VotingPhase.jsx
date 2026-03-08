import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import './VotingPhase.css';

export default function VotingPhase() {
    const { submitVote, proposedTeam, players, playerId, votedCount, currentLeader } = useGame();
    const [voted, setVoted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isLeader = currentLeader?.id === playerId;

    const teamNames = proposedTeam.map(id => {
        const p = players.find(pl => pl.id === id);
        return p ? p.name : 'Unknown';
    });

    const isOnTeam = proposedTeam.includes(playerId);

    const handleVote = (vote) => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        submitVote(vote, (res) => {
            setIsSubmitting(false);
            if (res?.error) {
                alert(res.error);
            } else {
                setVoted(true);
            }
        });
    };

    // Leader auto-voted approve
    if (isLeader) {
        return (
            <div className="voting-phase animate-fade-in">
                <h3 className="gb-action-title">Voting in Progress</h3>
                <div className="voting-team">
                    {teamNames.map((name, i) => (
                        <span key={i} className="voting-team-member">{name}</span>
                    ))}
                </div>
                <p className="voting-leader-note">✅ Your vote auto-counted as Approve (you proposed this team)</p>
                <div className="voting-waiting">
                    <p className="animate-pulse">Waiting for others to vote...</p>
                    <p className="voting-count">{votedCount} / {players.length} voted</p>
                </div>
            </div>
        );
    }

    return (
        <div className="voting-phase animate-fade-in">
            <h3 className="gb-action-title">Vote on the Proposed Team</h3>
            <div className="voting-team">
                {teamNames.map((name, i) => (
                    <span key={i} className="voting-team-member">{name}</span>
                ))}
            </div>
            {isOnTeam && (
                <p className="voting-on-team-note">✓ You are on this team</p>
            )}

            {!voted ? (
                <div className="voting-buttons">
                    <button
                        className="btn btn-primary voting-btn"
                        onClick={() => handleVote('approve')}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Submitting...' : '👍 Approve'}
                    </button>
                    <button
                        className="btn btn-danger voting-btn"
                        onClick={() => handleVote('reject')}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Submitting...' : '👎 Reject'}
                    </button>
                </div>
            ) : (
                <div className="voting-waiting">
                    <p className="animate-pulse">Vote submitted!</p>
                    <p className="voting-count">{votedCount} / {players.length} voted</p>
                </div>
            )}
        </div>
    );
}
