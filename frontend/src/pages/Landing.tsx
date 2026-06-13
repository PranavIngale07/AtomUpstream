import { useNavigate } from 'react-router-dom';
import { Headset, Users } from 'lucide-react';
import { requireIdentity } from '../lib/identity';
import { useState } from 'react';

export default function Landing() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectRole = async (role: 'AGENT' | 'CUSTOMER') => {
    setLoading(true);
    setError('');
    try {
      await requireIdentity(role);
      if (role === 'AGENT') {
        navigate('/agent-home');
      } else {
        navigate('/customer-home');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to initialize identity');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: 500, margin: '4rem auto', textAlign: 'center' }}>
      <h1 style={{ marginBottom: '1rem' }}>Real-Time Support Platform</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        Please select your role to continue.
      </p>
      
      {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</div>}
      
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <button className="btn" onClick={() => selectRole('AGENT')} disabled={loading}>
          <Headset size={20} />
          Continue as Agent
        </button>
        <button 
          className="btn" 
          style={{ backgroundColor: 'var(--surface)', color: 'var(--text)' }} 
          onClick={() => selectRole('CUSTOMER')}
          disabled={loading}
        >
          <Users size={20} />
          Continue as Customer
        </button>
      </div>
    </div>
  );
}
