import { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, Users, Video, Clock, MessageSquare, ArrowDownToLine } from 'lucide-react';

interface Overview {
  total_sessions: number;
  active_sessions: number;
  connected_participants: number;
}

interface Session {
  id: string;
  invite_code: string;
  created_at: string;
  ended_at: string | null;
  duration: number;
  agent: string;
  customer: string;
  status: string;
  participant_count: number;
  agent_secret: string | null;
}

interface Participant {
  id: string;
  display_name: string;
  role: string;
  joined_at: string;
}

interface Event {
  id: string;
  event_type: string;
  payload: string;
  created_at: string;
}

interface Message {
  id: string;
  sender_name: string;
  sender_role: string;
  content: string;
  created_at: string;
}

interface SessionDetails {
  id: string;
  invite_code: string;
  status: string;
  created_at: string;
  ended_at: string | null;
  duration: number;
  agent_secret: string | null;
  participants: Participant[];
  events: Event[];
  messages: Message[];
}

export default function Dashboard() {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionDetails, setSessionDetails] = useState<SessionDetails | null>(null);

  const fetchOverview = async () => {
    try {
      const res = await axios.get('/api/dashboard/overview');
      setOverview(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSessions = async () => {
    try {
      const res = await axios.get('/api/dashboard/sessions');
      setSessions(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSessionDetails = async (id: string) => {
    try {
      const res = await axios.get(`/api/dashboard/sessions/${id}`);
      setSessionDetails(res.data);
      setSelectedSessionId(id);
      setTimeout(() => {
        document.getElementById('session-details-panel')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (e) {
      console.error(e);
    }
  };

  const endSession = async (id: string, agentSecret: string | null) => {
    if (!agentSecret) {
      alert("No agent secret found, cannot authorize end session.");
      return;
    }
    try {
      await axios.post(`/api/sessions/${id}/end`, {}, {
        headers: {
          'x-participant-secret': agentSecret
        }
      });
      if (selectedSessionId === id) {
        fetchSessionDetails(id);
      }
      fetchSessions();
      fetchOverview();
    } catch (e) {
      console.error(e);
      alert("Failed to end session");
    }
  };

  useEffect(() => {
    fetchOverview();
    fetchSessions();
    const interval = setInterval(() => {
      fetchOverview();
      fetchSessions();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const liveSessions = sessions.filter(s => s.status === 'ACTIVE' || s.status === 'CREATED');

  const downloadChatText = () => {
    if (!sessionDetails) return;
    const text = sessionDetails.messages.map(m => `[${new Date(m.created_at).toLocaleString()}] ${m.sender_name} (${m.sender_role}): ${m.content}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat_${sessionDetails.invite_code}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadChatJson = () => {
    if (!sessionDetails) return;
    const blob = new Blob([JSON.stringify(sessionDetails.messages, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat_${sessionDetails.invite_code}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: '2rem', width: '100%', maxWidth: '1600px', margin: '0 auto', color: '#fff', boxSizing: 'border-box' }}>
      <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '2rem', borderBottom: '1px solid #334155', paddingBottom: '1rem' }}>Live Operations Console</h1>

      {/* SECTION 1: OVERVIEW METRICS */}
      {overview && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
          <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <Video size={24} color="#3b82f6" />
              <h3 style={{ margin: 0, color: '#94a3b8', fontSize: '1.25rem' }}>Total Sessions</h3>
            </div>
            <p style={{ fontSize: '3rem', margin: 0, fontWeight: 'bold' }}>{overview.total_sessions}</p>
          </div>
          <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <Activity size={24} color="#10b981" />
              <h3 style={{ margin: 0, color: '#94a3b8', fontSize: '1.25rem' }}>Active Sessions</h3>
            </div>
            <p style={{ fontSize: '3rem', margin: 0, fontWeight: 'bold' }}>{overview.active_sessions}</p>
          </div>
          <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <Users size={24} color="#f59e0b" />
              <h3 style={{ margin: 0, color: '#94a3b8', fontSize: '1.25rem' }}>Connected Participants</h3>
            </div>
            <p style={{ fontSize: '3rem', margin: 0, fontWeight: 'bold' }}>{overview.connected_participants}</p>
          </div>
        </div>
      )}

      {/* SECTION 2: LIVE SESSIONS */}
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Activity size={24}/> Active & Waiting Sessions
      </h2>
      <div style={{ background: '#1e293b', borderRadius: '0.5rem', border: '1px solid #334155', overflowX: 'auto', marginBottom: '3rem' }}>
        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
          <thead>
            <tr style={{ background: '#0f172a', color: '#94a3b8' }}>
              <th style={{ padding: '1rem' }}>Code</th>
              <th style={{ padding: '1rem' }}>Created</th>
              <th style={{ padding: '1rem' }}>Participants</th>
              <th style={{ padding: '1rem' }}>Status</th>
              <th style={{ padding: '1rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {liveSessions.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>No active sessions at the moment</td>
              </tr>
            )}
            {liveSessions.map(s => (
              <tr key={s.id} style={{ borderTop: '1px solid #334155', background: selectedSessionId === s.id ? '#334155' : 'transparent' }}>
                <td style={{ padding: '1rem', fontWeight: 'bold' }}>{s.invite_code}</td>
                <td style={{ padding: '1rem' }}>{new Date(s.created_at).toLocaleTimeString()}</td>
                <td style={{ padding: '1rem' }}>{s.participant_count} / 2</td>
                <td style={{ padding: '1rem' }}>
                  <span style={{ padding: '0.25rem 0.5rem', background: '#10b98120', color: '#10b981', borderRadius: '0.25rem', fontSize: '0.8rem' }}>
                    {s.status}
                  </span>
                </td>
                <td style={{ padding: '1rem' }}>
                  <button style={{ background: 'transparent', border: '1px solid #3b82f6', color: '#3b82f6', padding: '0.5rem 1rem', borderRadius: '0.25rem', cursor: 'pointer', marginRight: '0.5rem' }} onClick={() => fetchSessionDetails(s.id)}>View Details</button>
                  <button style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '0.5rem 1rem', borderRadius: '0.25rem', cursor: 'pointer' }} onClick={() => endSession(s.id, s.agent_secret)}>End</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* SECTION 3: SESSION HISTORY */}
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Clock size={24}/> Complete Session History
      </h2>
      <div style={{ background: '#1e293b', borderRadius: '0.5rem', border: '1px solid #334155', overflowX: 'auto', marginBottom: '3rem' }}>
        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
          <thead>
            <tr style={{ background: '#0f172a', color: '#94a3b8' }}>
              <th style={{ padding: '1rem' }}>Date</th>
              <th style={{ padding: '1rem' }}>Code</th>
              <th style={{ padding: '1rem' }}>Agent</th>
              <th style={{ padding: '1rem' }}>Customer</th>
              <th style={{ padding: '1rem' }}>Duration</th>
              <th style={{ padding: '1rem' }}>Status</th>
              <th style={{ padding: '1rem' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map(s => (
              <tr key={s.id} style={{ borderTop: '1px solid #334155', background: selectedSessionId === s.id ? '#334155' : 'transparent' }}>
                <td style={{ padding: '1rem' }}>{new Date(s.created_at).toLocaleDateString()} {new Date(s.created_at).toLocaleTimeString()}</td>
                <td style={{ padding: '1rem', fontWeight: 'bold' }}>{s.invite_code}</td>
                <td style={{ padding: '1rem' }}>{s.agent}</td>
                <td style={{ padding: '1rem' }}>{s.customer}</td>
                <td style={{ padding: '1rem' }}>{s.duration > 0 ? `${s.duration}s` : '-'}</td>
                <td style={{ padding: '1rem' }}>
                  <span style={{ padding: '0.25rem 0.5rem', background: s.status === 'ENDED' ? '#64748b20' : '#10b98120', color: s.status === 'ENDED' ? '#94a3b8' : '#10b981', borderRadius: '0.25rem', fontSize: '0.8rem' }}>
                    {s.status}
                  </span>
                </td>
                <td style={{ padding: '1rem' }}>
                  <button style={{ background: selectedSessionId === s.id ? '#3b82f6' : 'transparent', border: '1px solid #3b82f6', color: selectedSessionId === s.id ? '#fff' : '#3b82f6', padding: '0.5rem 1rem', borderRadius: '0.25rem', cursor: 'pointer' }} onClick={() => fetchSessionDetails(s.id)}>View Details</button>
                </td>
              </tr>
            ))}
            {sessions.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>No history available</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* SECTION 4: SESSION DETAILS PANEL */}
      {selectedSessionId && sessionDetails && (
        <div id="session-details-panel" style={{ background: '#0f172a', padding: '2rem', borderRadius: '0.5rem', border: '2px solid #3b82f6', marginBottom: '4rem', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid #334155', paddingBottom: '1rem' }}>
            <h2 style={{ margin: 0, fontSize: '2rem' }}>Selected Session Details <span style={{ color: '#94a3b8', fontSize: '1.5rem', marginLeft: '1rem' }}>#{sessionDetails.invite_code}</span></h2>
            <div>
              {sessionDetails.status !== 'ENDED' && (
                <button style={{ background: '#ef4444', border: 'none', color: '#fff', padding: '0.75rem 1.5rem', borderRadius: '0.25rem', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => endSession(sessionDetails.id, sessionDetails.agent_secret)}>
                  Force End Session
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
            <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '0.5rem' }}>
              <div style={{ color: '#94a3b8', marginBottom: '0.5rem', textTransform: 'uppercase', fontSize: '0.8rem', fontWeight: 'bold' }}>Session ID</div>
              <div style={{ wordBreak: 'break-all' }}>{sessionDetails.id}</div>
            </div>
            <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '0.5rem' }}>
              <div style={{ color: '#94a3b8', marginBottom: '0.5rem', textTransform: 'uppercase', fontSize: '0.8rem', fontWeight: 'bold' }}>Status</div>
              <div style={{ color: sessionDetails.status === 'ENDED' ? '#94a3b8' : '#10b981', fontWeight: 'bold' }}>{sessionDetails.status}</div>
            </div>
            <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '0.5rem' }}>
              <div style={{ color: '#94a3b8', marginBottom: '0.5rem', textTransform: 'uppercase', fontSize: '0.8rem', fontWeight: 'bold' }}>Timing</div>
              <div>Start: {new Date(sessionDetails.created_at).toLocaleTimeString()}</div>
              <div>End: {sessionDetails.ended_at ? new Date(sessionDetails.ended_at).toLocaleTimeString() : '-'}</div>
              <div style={{ color: '#3b82f6', marginTop: '0.5rem' }}>Duration: {sessionDetails.duration > 0 ? `${sessionDetails.duration}s` : 'Live'}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', marginBottom: '3rem' }}>
            {/* Participants */}
            <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
              <h3 style={{ margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users size={20} color="#f59e0b"/> Participants
              </h3>
              {sessionDetails.participants.map(p => (
                <div key={p.id} style={{ padding: '1rem', background: '#0f172a', borderRadius: '0.5rem', marginBottom: '1rem', borderLeft: `4px solid ${p.role === 'AGENT' ? '#3b82f6' : '#10b981'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{p.display_name}</span>
                    <span style={{ fontSize: '0.8rem', background: '#334155', padding: '0.2rem 0.5rem', borderRadius: '0.25rem' }}>{p.role}</span>
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#94a3b8' }}>
                    Joined: {new Date(p.joined_at).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>

            {/* Event Timeline */}
            <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
              <h3 style={{ margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={20} color="#10b981"/> Event Timeline
              </h3>
              <div style={{ paddingRight: '1rem' }}>
                <div style={{ padding: '1rem', borderLeft: '2px solid #3b82f6', marginLeft: '0.5rem', position: 'relative' }}>
                  <div style={{ position: 'absolute', width: '12px', height: '12px', background: '#3b82f6', borderRadius: '50%', left: '-7px', top: '20px' }}></div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{new Date(sessionDetails.created_at).toLocaleTimeString()}</div>
                  <div style={{ fontWeight: 'bold', color: '#fff' }}>Session Created</div>
                </div>
                
                {sessionDetails.events.map(e => (
                  <div key={e.id} style={{ padding: '1rem', borderLeft: '2px solid #3b82f6', marginLeft: '0.5rem', position: 'relative' }}>
                    <div style={{ position: 'absolute', width: '12px', height: '12px', background: e.event_type === 'session_ended' ? '#ef4444' : '#10b981', borderRadius: '50%', left: '-7px', top: '20px' }}></div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{new Date(e.created_at).toLocaleTimeString()}</div>
                    <div style={{ fontWeight: 'bold', color: e.event_type === 'session_ended' ? '#ef4444' : '#fff' }}>
                      {e.event_type === 'participant_joined' ? `Participant Joined: ${JSON.parse(e.payload).participant || 'Unknown'}` :
                       e.event_type === 'session_ended' ? `Session Ended` :
                       e.event_type}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Chat History */}
          <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MessageSquare size={20} color="#a855f7"/> Chat History Log
              </h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={downloadChatText} style={{ background: 'transparent', border: '1px solid #94a3b8', color: '#94a3b8', padding: '0.5rem 1rem', borderRadius: '0.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ArrowDownToLine size={16}/> .TXT
                </button>
                <button onClick={downloadChatJson} style={{ background: 'transparent', border: '1px solid #94a3b8', color: '#94a3b8', padding: '0.5rem 1rem', borderRadius: '0.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ArrowDownToLine size={16}/> .JSON
                </button>
              </div>
            </div>
            
            <div style={{ background: '#0f172a', padding: '1.5rem', borderRadius: '0.5rem', minHeight: '150px' }}>
              {sessionDetails.messages.length === 0 ? (
                <div style={{ color: '#94a3b8', textAlign: 'center', padding: '3rem 0' }}>No messages sent during this session.</div>
              ) : (
                sessionDetails.messages.map(m => (
                  <div key={m.id} style={{ marginBottom: '1.25rem', display: 'flex', gap: '1.5rem', borderBottom: '1px solid #1e293b', paddingBottom: '1rem' }}>
                    <div style={{ fontSize: '0.85rem', color: '#94a3b8', minWidth: '85px', paddingTop: '0.2rem' }}>
                      {new Date(m.created_at).toLocaleTimeString()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: 'bold', color: m.sender_role === 'AGENT' ? '#3b82f6' : '#10b981', marginRight: '0.5rem' }}>
                          {m.sender_name}
                        </span>
                        <span style={{ fontSize: '0.75rem', background: '#334155', padding: '0.1rem 0.4rem', borderRadius: '0.25rem', color: '#cbd5e1' }}>
                          {m.sender_role}
                        </span>
                      </div>
                      <div style={{ color: '#f8fafc', lineHeight: 1.5 }}>{m.content}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
