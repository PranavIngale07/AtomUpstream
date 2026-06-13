import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function CustomerHome() {
  const [token, setToken] = useState('');
  const navigate = useNavigate();

  const handleJoin = () => {
    let finalToken = token.trim();
    if (!finalToken) return;
    
    // If user pasted a full URL, extract the token from the end
    try {
      if (finalToken.startsWith('http')) {
        const url = new URL(finalToken);
        const parts = url.pathname.split('/');
        finalToken = parts[parts.length - 1];
      }
    } catch (e) {}

    navigate(`/join/${finalToken}`);
  };

  return (
    <div className="card" style={{ maxWidth: 400, margin: '4rem auto' }}>
      <h2 style={{ marginBottom: '1.5rem' }}>Join Support Session</h2>
      <div className="form-group">
        <label>Invite Link or 6-Digit Code</label>
        <input 
          className="input-field" 
          value={token} 
          onChange={e => setToken(e.target.value)}
          placeholder="e.g. 123456 or paste full link..."
          onKeyDown={e => e.key === 'Enter' && handleJoin()}
        />
      </div>
      <button className="btn" onClick={handleJoin} disabled={!token.trim()}>
        Join Session
      </button>
    </div>
  );
}
