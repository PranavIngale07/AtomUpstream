import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MediasoupManager } from '../lib/mediasoup';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Send } from 'lucide-react';
import axios from 'axios';

export default function Room() {
  const { sessionId, participantId } = useParams();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null); // For simplicity, 1 remote video in MVP

  const mediaManagerRef = useRef<MediasoupManager | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // 1. Initialize WebSocket for chat & presence
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/chat/${sessionId}/${participantId}`);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'chat_message') {
        setMessages((prev) => [...prev, data]);
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

    // 3. Get User Media and Produce
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Wait a bit for transports to be ready (simplified for MVP)
      setTimeout(() => {
        stream.getTracks().forEach((track) => {
          manager.produce(track);
        });
      }, 2000);
    });

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

  const endCall = async () => {
    try {
      await axios.post(`/api/sessions/${sessionId}/end`);
    } catch(e) {}
    navigate('/');
  };

  const sendChat = () => {
    if (!chatInput.trim() || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: 'chat_message', text: chatInput }));
    setChatInput('');
  };

  return (
    <div className="room-container">
      <div className="video-area">
        <div className="video-grid">
          <div className="video-wrapper">
            <video ref={localVideoRef} autoPlay playsInline muted />
            <div className="participant-name">You</div>
          </div>
          <div className="video-wrapper">
            <video ref={remoteVideoRef} autoPlay playsInline />
            <div className="participant-name">Remote</div>
          </div>
        </div>

        <div className="controls-bar">
          <button className={`control-btn ${isMuted ? 'off' : ''}`} onClick={toggleMute}>
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          <button className={`control-btn ${isVideoOff ? 'off' : ''}`} onClick={toggleVideo}>
            {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
          </button>
          <button className="control-btn btn-danger" onClick={endCall}>
            <PhoneOff size={20} />
          </button>
        </div>
      </div>

      <div className="chat-sidebar">
        <div className="chat-header">Session Chat</div>
        <div className="chat-messages">
          {messages.map((msg, i) => {
            const isSelf = msg.participant_id === participantId;
            return (
              <div key={i} className={`chat-msg ${isSelf ? 'self' : ''}`}>
                <div className="msg-sender">{isSelf ? 'You' : 'Remote'}</div>
                <div>{msg.text}</div>
              </div>
            );
          })}
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

