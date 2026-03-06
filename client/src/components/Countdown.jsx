import React, { useState, useEffect } from 'react';
import './Countdown.css';

export default function Countdown() {
    const [count, setCount] = useState(3);

    useEffect(() => {
        if (count <= 0) return;
        const timer = setTimeout(() => setCount(count - 1), 1000);
        return () => clearTimeout(timer);
    }, [count]);

    return (
        <div className="countdown-overlay">
            <div className="app-background" />
            <div key={count} className="countdown-number">
                {count > 0 ? count : 'GO!'}
            </div>
            <div className="countdown-ring" key={`ring-${count}`} />
        </div>
    );
}
