import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MediasoupManager } from '../lib/mediasoup';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Send, LogOut } from 'lucide-react';
import axios from 'axios';
import { getIdentity } from '../lib/identity';

export default function Room() {
  const { sessionId, participantId } = useParams();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  
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
          participant_id: data.participant_id,
          sender: data.participant_id === participantId ? 'You' : 'Remote'
        }]);
      } else if (data.type === 'participant_status') {
        if (data.participant_id !== participantId) {
          setRemoteStatus(data.status);
        }
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
      localStreamRef.current.getAudioTracks().forEach(t => {
        t.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => {
        t.enabled = isVideoOff;
      });
      setIsVideoOff(!isVideoOff);
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
    } catch(e) {}
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
      <div className="video-area">
        <div className="video-grid">
          <div className="video-wrapper">
            <video ref={localVideoRef} autoPlay playsInline muted />
            <div className="participant-name">
              <div className="status-indicator"></div> You
            </div>
          </div>
          <div className="video-wrapper">
            <video ref={remoteVideoRef} autoPlay playsInline />
            <div className="participant-name">
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
                <div>{msg.text}</div>
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
