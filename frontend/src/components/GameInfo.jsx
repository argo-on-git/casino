import React, { useState } from 'react';

export default function GameInfo({ title, description, rules, edge }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="game-info-toggle"
        onClick={() => setOpen(!open)}
        type="button"
      >
        <span>ℹ️</span>
        <span>{open ? 'Hide Rules' : 'How to Play'}</span>
      </button>
      {open && (
        <div className="game-info-content">
          <h4>{title}</h4>
          <p className="text-sm text-muted" style={{ marginBottom: '0.75rem', lineHeight: 1.5 }}>
            {description}
          </p>
          <ul>
            {rules.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          <div className="edge-badge">🏠 House Edge: {edge}</div>
        </div>
      )}
    </>
  );
}
