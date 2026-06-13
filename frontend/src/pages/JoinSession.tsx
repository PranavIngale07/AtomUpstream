import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { requireIdentity } from '../lib/identity';

export default function JoinSession() {
  const { inviteToken } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const join = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const identity = await requireIdentity('CUSTOMER');
      const res = await axios.post(`/api/sessions/${inviteToken}/join`, {
        display_name: name
      }, {
        headers: { 'X-Participant-Secret': identity.secret }
      });
      navigate(`/room/${res.data.session_id}/${res.data.id}`);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to join session. It may have ended.');
    }
    setLoading(false);
  };

  return (
    <div className="app-container" style={{ justifyContent: 'center' }}>
      <div className="center-card">
        <h1 className="title">Support Session</h1>
        <p className="subtitle">An agent is waiting to assist you. Please enter your name to connect.</p>
        <input
          className="input-field"
          placeholder="Enter your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && join()}
        />
        <button className="btn" onClick={join} disabled={loading || !name.trim()}>
          {loading ? 'Joining Room...' : 'Connect to Agent'}
        </button>
      </div>
    </div>
  );
}
