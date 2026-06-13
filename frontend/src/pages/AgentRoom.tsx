import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function AgentRoom() {
  const { inviteToken } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await axios.get(`/api/sessions/${inviteToken}`);
        setSession(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchSession();
  }, [inviteToken]);

  const enterRoom = () => {
    const agent = session?.participants.find((p: any) => p.role === 'AGENT');
    if (agent && session) {
      navigate(`/room/${session.id}/${agent.id}`);
    }
  };

  const inviteLink = `${window.location.origin}/join/${inviteToken}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="app-container" style={{ justifyContent: 'center' }}>
      <div className="center-card">
        <h1 className="title">Session Created</h1>
        <p className="subtitle">Share this code with your customer:</p>
        <div style={{ fontSize: '2rem', fontWeight: 'bold', letterSpacing: '0.2em', margin: '1rem 0', color: 'var(--primary)' }}>
          {session ? session.short_code : '...'}
        </div>
        <p className="subtitle" style={{ marginTop: '1rem' }}>Or share the direct link:</p>
        <input
          className="input-field"
          value={inviteLink}
          readOnly
          onClick={(e) => e.currentTarget.select()}
        />
        <button className="btn" style={{ marginBottom: '1rem' }} onClick={handleCopy}>
          Copy Link
        </button>
        <button className="btn" onClick={enterRoom} disabled={!session}>
          Enter Room
        </button>
      </div>
      {copied && <div className="toast">Link copied to clipboard!</div>}
    </div>
  );
}
