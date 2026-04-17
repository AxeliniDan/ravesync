import React, { useState, useEffect, useRef } from 'react';
import ReactPlayer from 'react-player';
import Peer, { type DataConnection, type MediaConnection } from 'peerjs';
import { Send, LogOut, Copy, CheckCircle2, PlaySquare, Mic, MicOff, MonitorPlay, Search } from 'lucide-react';
import MediaBrowser from './MediaBrowser';

interface SyncRoomProps {
  roomId: string;
  isHost: boolean;
  onLeave: () => void;
}

const PEER_PREFIX = 'rave-sync-clone-';

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: Date;
}

interface SyncData {
  type: 'PLAY' | 'PAUSE' | 'SEEK' | 'URL' | 'CHAT';
  payload?: any;
}

const SyncRoom: React.FC<SyncRoomProps> = ({ roomId, isHost, onLeave }) => {
  const [videoUrl, setVideoUrl] = useState('https://www.youtube.com/watch?v=aqz-KE-bpKQ');
  const [inputUrl, setInputUrl] = useState('');
  const [playing, setPlaying] = useState(false);
  const [showMediaBrowser, setShowMediaBrowser] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');

  const [copied, setCopied] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('Conectando...');

  const [isMuted, setIsMuted] = useState(true);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  const playerRef = useRef<any>(null);
  const peerRef = useRef<Peer | null>(null);
  const connectionRef = useRef<DataConnection | null>(null);
  const connectionsRef = useRef<DataConnection[]>([]);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const isSeeking = useRef(false);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then(stream => {
          stream.getAudioTracks().forEach(t => t.enabled = false);
          localStreamRef.current = stream;
        })
        .catch(err => console.error('Error al acceder al micrófono:', err));
    }

    const initPeer = async () => {
      const peerId = isHost
        ? `${PEER_PREFIX}${roomId}`
        : `${PEER_PREFIX}guest-${Math.random().toString(36).substring(7)}`;

      const peer = new Peer(peerId);
      peerRef.current = peer;

      peer.on('open', () => {
        if (isHost) {
          setConnectionStatus('Esperando invitados...');
        } else {
          setConnectionStatus('Conectando al Anfitrión...');
          const conn = peer.connect(`${PEER_PREFIX}${roomId}`);
          setupConnection(conn);
        }
      });

      peer.on('connection', (conn) => {
        if (isHost) {
          setupConnection(conn);
          conn.on('open', () => conn.send({ type: 'URL', payload: videoUrl }));
          setTimeout(() => {
            if (localStreamRef.current) {
              const call = peer.call(conn.peer, localStreamRef.current);
              setupCall(call);
            }
          }, 1000);
        }
      });

      peer.on('call', (call) => {
        let streamToAnswer = localStreamRef.current;
        if (!streamToAnswer) {
          const ctx = new AudioContext();
          streamToAnswer = ctx.createMediaStreamDestination().stream;
        }
        call.answer(streamToAnswer);
        setupCall(call);
      });

      peer.on('error', (err) => {
        console.error('Peer error:', err);
        setConnectionStatus(`Error: ${err.type}`);
      });
    };

    initPeer();

    return () => {
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      peerRef.current?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, isHost]);

  const setupCall = (call: MediaConnection) => {
    call.on('stream', (remoteStream) => {
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream;
    });
  };

  const setupConnection = (conn: DataConnection) => {
    connectionRef.current = conn;
    if (isHost) {
      connectionsRef.current.push(conn);
      setConnectionStatus(`${connectionsRef.current.length} invitado(s) conectado(s)`);
    } else {
      setConnectionStatus('Conectado al Anfitrión');
    }

    conn.on('data', (data: any) => {
      const syncData = data as SyncData;
      switch (syncData.type) {
        case 'CHAT': setMessages(prev => [...prev, syncData.payload]); break;
        case 'PLAY': setPlaying(true); break;
        case 'PAUSE': setPlaying(false); break;
        case 'SEEK':
          isSeeking.current = true;
          if (playerRef.current) (playerRef.current as any).currentTime = syncData.payload;
          setTimeout(() => { isSeeking.current = false; }, 500);
          break;
        case 'URL': setVideoUrl(syncData.payload); break;
      }
    });

    conn.on('close', () => {
      if (isHost) {
        connectionsRef.current = connectionsRef.current.filter(c => c.peer !== conn.peer);
        setConnectionStatus(connectionsRef.current.length > 0
          ? `${connectionsRef.current.length} invitado(s) conectado(s)`
          : 'Esperando invitados...');
      } else {
        setConnectionStatus('Desconectado del Anfitrión');
      }
    });
  };

  const broadcast = (data: SyncData) => {
    if (isHost) connectionsRef.current.forEach(conn => conn.send(data));
    else if (connectionRef.current) connectionRef.current.send(data);
  };

  const handlePlay = () => { setPlaying(true); broadcast({ type: 'PLAY' }); };
  const handlePause = () => { setPlaying(false); broadcast({ type: 'PAUSE' }); };

  const handleSeek = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const target = e.currentTarget as HTMLVideoElement;
    if (!isSeeking.current && target) broadcast({ type: 'SEEK', payload: target.currentTime });
  };

  const handleUrlChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputUrl && isHost) {
      setVideoUrl(inputUrl);
      broadcast({ type: 'URL', payload: inputUrl });
      setInputUrl('');
    }
  };

  const handleMediaSelect = (url: string) => {
    setVideoUrl(url);
    setPlaying(true);
    setShowMediaBrowser(false);
    if (isHost) {
      broadcast({ type: 'URL', payload: url });
      broadcast({ type: 'PLAY' });
    }
  };

  const sendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const newMsg: ChatMessage = {
      id: Math.random().toString(),
      sender: isHost ? 'Anfitrión' : 'Invitado',
      text: chatInput.trim(),
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMsg]);
    broadcast({ type: 'CHAT', payload: newMsg });
    setChatInput('');
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = isMuted; });
      setIsMuted(!isMuted);
    }
  };

  return (
    <div className="animate-fade-in" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100dvh',
      overflow: 'hidden',
      background: 'var(--bg-primary)',
    }}>
      <audio ref={remoteAudioRef} autoPlay />

      {/* ── TOP HEADER BAR ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 16px',
        borderBottom: '1px solid var(--border-glass)',
        flexShrink: 0,
        background: 'rgba(255,255,255,0.02)',
      }}>
        {/* Room info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="text-gradient">Sala: {roomId}</span>
              {isHost && (
                <button onClick={copyRoomCode} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: '2px' }}>
                  {copied ? <CheckCircle2 size={15} color="#10b981" /> : <Copy size={15} />}
                </button>
              )}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: connectionStatus.includes('Error') ? '#ef4444' : '#10b981' }} />
              {connectionStatus}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {isHost && (
            <button
              onClick={() => setShowMediaBrowser(true)}
              className="btn"
              style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)', padding: '8px 14px', fontSize: '0.85rem' }}
            >
              <MonitorPlay size={16} />
              <span style={{ display: window.innerWidth < 480 ? 'none' : 'inline' }}>YouTube</span>
            </button>
          )}
          <button
            onClick={toggleMute}
            className="btn"
            style={{
              background: isMuted ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
              color: isMuted ? '#ef4444' : '#10b981',
              borderColor: isMuted ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)',
              padding: '8px 12px'
            }}
          >
            {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
          <button onClick={onLeave} className="btn" style={{ background: 'rgba(255,255,255,0.05)', padding: '8px 12px' }}>
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* ── VIDEO PLAYER ── */}
      <div style={{
        background: '#000',
        flexShrink: 0,
        width: '100%',
        aspectRatio: '16 / 9',
        maxHeight: '55vh',
        position: 'relative',
      }}>
        <ReactPlayer
          ref={playerRef}
          src={videoUrl}
          width="100%"
          height="100%"
          playing={playing}
          controls={true}
          onPlay={handlePlay}
          onPause={handlePause}
          onSeeked={handleSeek}
          style={{ position: 'absolute', top: 0, left: 0 }}
        />
      </div>

      {/* ── URL INPUT (host only) ── */}
      {isHost && (
        <div style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--border-glass)',
          flexShrink: 0,
          background: 'rgba(255,255,255,0.015)',
        }}>
          <form onSubmit={handleUrlChange} style={{ display: 'flex', gap: '8px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <PlaySquare size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={inputUrl}
                onChange={e => setInputUrl(e.target.value)}
                placeholder="Pega un link de YouTube..."
                className="input-glass"
                style={{ paddingLeft: '38px', padding: '9px 12px 9px 36px', fontSize: '0.85rem' }}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={!inputUrl.trim()} style={{ flexShrink: 0, fontSize: '0.85rem', padding: '8px 14px' }}>
              <Search size={15} /> Poner
            </button>
          </form>
        </div>
      )}

      {/* ── CHAT ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minHeight: 0,
      }}>
        {/* Chat header */}
        <div style={{
          padding: '8px 16px',
          borderBottom: '1px solid var(--border-glass)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            💬 Chat en vivo
          </span>
          {messages.length > 0 && (
            <span style={{
              background: 'var(--accent-primary)', color: 'white',
              borderRadius: '99px', fontSize: '0.65rem', fontWeight: 700,
              padding: '1px 7px',
            }}>{messages.length}</span>
          )}
        </div>

        {/* Messages */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}>
          {messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '24px', fontSize: '0.85rem' }}>
              Sin mensajes aún. ¡Di hola! 👋
            </div>
          ) : (
            messages.map(msg => {
              const isMe = (msg.sender === 'Anfitrión' && isHost) || (msg.sender === 'Invitado' && !isHost);
              return (
                <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '3px' }}>{msg.sender}</span>
                  <div style={{
                    background: isMe ? 'var(--accent-primary)' : 'var(--bg-glass)',
                    padding: '9px 13px',
                    borderRadius: '16px',
                    borderBottomRightRadius: isMe ? '4px' : '16px',
                    borderBottomLeftRadius: !isMe ? '4px' : '16px',
                    fontSize: '0.9rem',
                    wordBreak: 'break-word',
                    maxWidth: '80%',
                  }}>
                    {msg.text}
                  </div>
                </div>
              );
            })
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* Message input */}
        <form onSubmit={sendChat} style={{
          padding: '10px 12px',
          borderTop: '1px solid var(--border-glass)',
          flexShrink: 0,
          display: 'flex',
          gap: '8px',
          background: 'rgba(255,255,255,0.02)',
        }}>
          <input
            type="text"
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            placeholder="Escribe un mensaje..."
            className="input-glass"
            style={{ flex: 1, fontSize: '0.9rem', padding: '10px 14px' }}
          />
          <button
            type="submit"
            className="btn btn-icon"
            style={{ background: 'var(--accent-primary)', flexShrink: 0, padding: '10px 14px' }}
            disabled={!chatInput.trim()}
          >
            <Send size={17} color="white" />
          </button>
        </form>
      </div>

      {/* ── MEDIA BROWSER MODAL ── */}
      {showMediaBrowser && (
        <MediaBrowser
          onSelectVideo={handleMediaSelect}
          onClose={() => setShowMediaBrowser(false)}
        />
      )}
    </div>
  );
};

export default SyncRoom;
