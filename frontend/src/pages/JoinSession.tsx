import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function JoinSession() {
  const { inviteToken } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const join = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await axios.post(`/api/sessions/${inviteToken}/join`, {
        display_name: name
      });
      navigate(`/room/${res.data.session_id}/${res.data.id}`);
    } catch (err) {
      console.error(err);
      alert('Failed to join session. It may have ended.');
    }
    setLoading(false);
  };

  return (
    <div className="app-container" style={{ justifyContent: 'center' }}>
      <div className="center-card">
        <h1 className="title">Join Support Session</h1>
        <p className="subtitle">Please enter your name to connect with the agent.</p>
        <input
          className="input-field"
          placeholder="Your Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn" onClick={join} disabled={loading || !name.trim()}>
          {loading ? 'Joining...' : 'Join Now'}
        </button>
      </div>
    </div>
  );
}
