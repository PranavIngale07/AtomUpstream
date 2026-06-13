import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MediasoupManager } from '../lib/mediasoup';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Send, LogOut, CircleDot, Square, Upload, File as FileIcon } from 'lucide-react';
import axios from 'axios';
import { getIdentity } from '../lib/identity';

export default function Room() {
  const { sessionId, participantId } = useParams();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [remoteMuted, setRemoteMuted] = useState(false);
  const [remoteVideoOff, setRemoteVideoOff] = useState(false);

  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const identity = getIdentity();
  const role = identity.role;
  const secret = identity.secret;

  const [remoteStatus, setRemoteStatus] = useState<'CONNECTED' | 'DISCONNECTED' | 'LEFT' | 'WAITING'>('WAITING');
  const [isSessionEnded, setIsSessionEnded] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const mediaManagerRef = useRef<MediasoupManager | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch participant info & chat history
  useEffect(() => {
    if (!secret || !role) {
      alert("Unauthorized: No session identity found.");
      navigate('/');
      return;
    }

    const fetchInitData = async () => {
      try {
        const chatRes = await axios.get(`/api/sessions/${sessionId}/chat`, { headers: { 'X-Participant-Secret': secret } });
        setMessages(chatRes.data);
      } catch (e) {
        console.error("Failed to fetch initial data", e);
        navigate('/');
      }
    };
    fetchInitData();
  }, [sessionId, secret, role, navigate]);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!secret) return;

    // 1. Initialize WebSocket for chat & presence
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/chat/${sessionId}/${participantId}?secret=${secret}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'chat_message') {
        setMessages((prev) => [...prev, {
          text: data.text,
          message_type: data.message_type || 'TEXT',
          file_url: data.file_url,
          file_size: data.file_size,
          participant_id: data.participant_id,
          sender: data.participant_id === participantId ? 'You' : 'Remote'
        }]);
      } else if (data.type === 'participant_status') {
        if (data.participant_id !== participantId) {
          setRemoteStatus(data.status);
        }
      } else if (data.type === 'mute_changed') {
        if (data.participant_id !== participantId) setRemoteMuted(data.state);
      } else if (data.type === 'camera_changed') {
        if (data.participant_id !== participantId) setRemoteVideoOff(data.state);
      } else if (data.type === 'session_ended') {
        setIsSessionEnded(true);
      }
    };
    wsRef.current = ws;

    // 2. Initialize Mediasoup & WebRTC
    const manager = new MediasoupManager(sessionId as string, participantId as string);
    mediaManagerRef.current = manager;

    manager.onNewConsumer = (track) => {
      if (remoteVideoRef.current) {
        let stream = remoteVideoRef.current.srcObject as MediaStream;
        if (!stream) {
          stream = new MediaStream();
          remoteVideoRef.current.srcObject = stream;
        }
        stream.addTrack(track);
      }
    };

    manager.onProducerClosed = (track) => {
      if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
        const stream = remoteVideoRef.current.srcObject as MediaStream;
        stream.removeTrack(track);
      }
    };

    // 3. Get User Media and Produce
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setTimeout(() => {
        stream.getTracks().forEach((track) => {
          manager.produce(track);
        });
      }, 2000);
    }).catch(e => console.error("Mic/Cam error", e));

    return () => {
      manager.disconnect();
      ws.close();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [sessionId, participantId]);

  const toggleMute = () => {
    if (localStreamRef.current) {
      const newMuted = !isMuted;
      localStreamRef.current.getAudioTracks().forEach(t => {
        t.enabled = !newMuted;
      });
      setIsMuted(newMuted);
      wsRef.current?.send(JSON.stringify({ type: 'mute_changed', state: newMuted }));
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const newVideoOff = !isVideoOff;
      localStreamRef.current.getVideoTracks().forEach(t => {
        t.enabled = !newVideoOff;
      });
      setIsVideoOff(newVideoOff);
      wsRef.current?.send(JSON.stringify({ type: 'camera_changed', state: newVideoOff }));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !secret) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      await axios.post(`/api/sessions/${sessionId}/file/upload`, formData, {
        headers: { 'X-Participant-Secret': secret, 'Content-Type': 'multipart/form-data' }
      });
      alert('File uploaded successfully!');
    } catch (err) {
      console.error(err);
      alert('File upload failed.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const stopLocalMedia = () => {
    mediaManagerRef.current?.disconnect();
    wsRef.current?.close();
    localStreamRef.current?.getTracks().forEach(t => t.stop());
  };

  useEffect(() => {
    if (isSessionEnded) {
      stopLocalMedia();
    }
  }, [isSessionEnded]);

  const leaveCall = () => {
    stopLocalMedia();
    navigate('/');
  };

  const endSession = async () => {
    if (!secret) return;
    try {
      await axios.post(`/api/sessions/${sessionId}/end`, {}, {
        headers: { 'X-Participant-Secret': secret }
      });
    } catch (e) { }
    stopLocalMedia();
    navigate('/');
  };

  const sendChat = () => {
    if (!chatInput.trim() || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: 'chat_message', text: chatInput }));
    setChatInput('');
  };

  const getStatusClass = () => {
    if (remoteStatus === 'CONNECTED') return 'status-indicator';
    if (remoteStatus === 'DISCONNECTED') return 'status-indicator reconnecting';
    return 'status-indicator disconnected';
  };

  const getStatusText = () => {
    if (remoteStatus === 'CONNECTED') return 'Remote (Connected)';
    if (remoteStatus === 'DISCONNECTED') return 'Remote (Reconnecting...)';
    if (remoteStatus === 'LEFT') return 'Remote (Left)';
    return 'Remote (Waiting...)';
  };

  if (isSessionEnded) {
    return (
      <div className="app-container" style={{ justifyContent: 'center' }}>
        <div className="center-card" style={{ textAlign: 'center' }}>
          <h1 className="title" style={{ color: 'var(--danger)' }}>Session Ended</h1>
          <p className="subtitle">This meeting has been ended by the agent. Please close this page or return to the home screen.</p>
          <button className="btn" onClick={() => navigate('/')}>
            Return Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="room-container">
      <div className="video-area" style={{ position: 'relative' }}>
        <div className="video-grid">
          <div className="video-wrapper" style={{ position: 'relative' }}>
            <video ref={localVideoRef} autoPlay playsInline muted />
            {isVideoOff && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: '#1e293b', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                <VideoOff size={48} color="#94a3b8" />
                <div style={{ color: '#94a3b8', marginTop: '1rem', fontWeight: 'bold' }}>Camera Off</div>
              </div>
            )}
            {isMuted && (
              <div style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(239, 68, 68, 0.8)', padding: '0.5rem', borderRadius: '50%', zIndex: 11 }}>
                <MicOff size={20} color="#fff" />
              </div>
            )}
            <div className="participant-name" style={{ zIndex: 12 }}>
              <div className="status-indicator"></div> You
            </div>
          </div>
          <div className="video-wrapper" style={{ position: 'relative' }}>
            <video ref={remoteVideoRef} autoPlay playsInline />
            {remoteVideoOff && remoteStatus === 'CONNECTED' && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: '#1e293b', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                <VideoOff size={48} color="#94a3b8" />
                <div style={{ color: '#94a3b8', marginTop: '1rem', fontWeight: 'bold' }}>Camera Off</div>
              </div>
            )}
            {remoteMuted && remoteStatus === 'CONNECTED' && (
              <div style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(239, 68, 68, 0.8)', padding: '0.5rem', borderRadius: '50%', zIndex: 11 }}>
                <MicOff size={20} color="#fff" />
              </div>
            )}
            <div className="participant-name" style={{ zIndex: 12 }}>
              <div className={getStatusClass()}></div> {getStatusText()}
            </div>
          </div>
        </div>

        <div className="controls-bar">
          <button className={`control-btn ${isMuted ? 'off' : ''}`} onClick={toggleMute} title="Toggle Audio">
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          <button className={`control-btn ${isVideoOff ? 'off' : ''}`} onClick={toggleVideo} title="Toggle Video">
            {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
          </button>

          <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
          <button className="control-btn" onClick={() => fileInputRef.current?.click()} disabled={isUploading} title="Upload File">
            <Upload size={20} />
          </button>

          {role === 'AGENT' ? (
            <button className="control-btn btn-danger" onClick={endSession} title="End Session for all">
              <PhoneOff size={20} />
            </button>
          ) : (
            <button className="control-btn btn-danger" onClick={leaveCall} title="Leave Session">
              <LogOut size={20} />
            </button>
          )}
        </div>
      </div>

      <div className="chat-sidebar">
        <div className="chat-header">Session Chat</div>
        <div className="chat-messages">
          {messages.map((msg, i) => {
            const isSelf = msg.participant_id === participantId;
            return (
              <div key={msg.id || i} className={`chat-msg ${isSelf ? 'self' : ''}`}>
                <div className="msg-sender">{isSelf ? 'You' : (msg.sender || 'Remote')}</div>
                {msg.message_type === 'FILE' ? (
                  <div style={{ background: isSelf ? '#2563eb' : '#334155', padding: '0.5rem', borderRadius: '0.25rem', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileIcon size={20} color="#fff" />
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 'bold', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{msg.text.replace('Shared a file: ', '')}</div>
                      <div style={{ fontSize: '0.75rem', color: isSelf ? '#bfdbfe' : '#94a3b8' }}>{msg.file_size || 'Unknown size'}</div>
                    </div>
                    <a href={msg.file_url} target="_blank" rel="noreferrer" style={{ background: '#0f172a', color: '#fff', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', textDecoration: 'none', fontSize: '0.8rem' }}>
                      Download
                    </a>
                  </div>
                ) : (
                  <div>{msg.text}</div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
        <div className="chat-input-area">
          <input
            className="input-field"
            style={{ marginBottom: 0 }}
            placeholder="Type a message..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendChat()}
          />
          <button className="btn" style={{ width: 'auto', padding: '0.75rem' }} onClick={sendChat}>
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
