import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const createSession = async () => {
    setLoading(true);
    try {
      const res = await axios.post('/api/sessions/');
      navigate(`/agent/${res.data.invite_token}`);
    } catch (err) {
      console.error(err);
      alert('Failed to create session');
    }
    setLoading(false);
  };

  return (
    <div className="app-container" style={{ justifyContent: 'center' }}>
      <div className="center-card">
        <h1 className="title">Video Support Agent</h1>
        <p className="subtitle">Create a new support session to generate an invite link for your customer.</p>
        <button className="btn" onClick={createSession} disabled={loading}>
          {loading ? 'Creating...' : 'Create Support Session'}
        </button>
      </div>
    </div>
  );
}
