import React, { useState, useEffect, useRef } from 'react';
import ReactPlayer from 'react-player';
import Peer, { type DataConnection, type MediaConnection } from 'peerjs';
import { Send, LogOut, Copy, CheckCircle2, PlaySquare, Mic, MicOff, MonitorPlay, MessageCircle, Search, Video } from 'lucide-react';
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

// ── Mobile tab type ────────────────────────────────────────────────────────
type MobileTab = 'player' | 'chat' | 'search';

const SyncRoom: React.FC<SyncRoomProps> = ({ roomId, isHost, onLeave }) => {
  const [videoUrl, setVideoUrl] = useState('https://www.youtube.com/watch?v=aqz-KE-bpKQ');
  const [inputUrl, setInputUrl] = useState('');
  const [playing, setPlaying] = useState(false);
  const [showMediaBrowser, setShowMediaBrowser] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>('player');

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');

  const [copied, setCopied] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('Conectando...');

  // Audio state
  const [isMuted, setIsMuted] = useState(true);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  const playerRef = useRef<any>(null);
  const peerRef = useRef<Peer | null>(null);
  const connectionRef = useRef<DataConnection | null>(null);
  const connectionsRef = useRef<DataConnection[]>([]);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const isSeeking = useRef(false);

  // Auto-scroll chat
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
        case 'CHAT':
          setMessages(prev => [...prev, syncData.payload]);
          break;
        case 'PLAY':
          setPlaying(true);
          break;
        case 'PAUSE':
          setPlaying(false);
          break;
        case 'SEEK':
          isSeeking.current = true;
          if (playerRef.current) (playerRef.current as any).currentTime = syncData.payload;
          setTimeout(() => { isSeeking.current = false; }, 500);
          break;
        case 'URL':
          setVideoUrl(syncData.payload);
          break;
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
    setMobileTab('player');
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

  // ── Shared Chat component ─────────────────────────────────────────────────
  const ChatPanel = () => (
    <>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-glass)', flexShrink: 0 }}>
        <h3 style={{ fontWeight: 600 }}>Chat en Vivo</h3>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '40px', fontSize: '0.9rem' }}>
            Aún no hay mensajes. ¡Di hola!
          </div>
        ) : (
          messages.map(msg => {
            const isMe = (msg.sender === 'Anfitrión' && isHost) || (msg.sender === 'Invitado' && !isHost);
            return (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>{msg.sender}</span>
                <div style={{
                  background: isMe ? 'var(--accent-primary)' : 'var(--bg-glass)',
                  padding: '10px 14px', borderRadius: '16px',
                  borderBottomRightRadius: isMe ? '4px' : '16px',
                  borderBottomLeftRadius: !isMe ? '4px' : '16px',
                  fontSize: '0.95rem', wordBreak: 'break-word', maxWidth: '80%'
                }}>
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={chatBottomRef} />
      </div>

      <form onSubmit={sendChat} style={{ padding: '12px', borderTop: '1px solid var(--border-glass)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            placeholder="Escribe un mensaje..."
            className="input-glass"
            style={{ padding: '12px 16px' }}
          />
          <button type="submit" className="btn btn-icon" style={{ background: 'var(--bg-glass)', flexShrink: 0 }} disabled={!chatInput.trim()}>
            <Send size={18} color="var(--accent-primary)" />
          </button>
        </div>
      </form>
    </>
  );

  return (
    <div className="animate-fade-in room-container" style={{ display: 'flex', height: '100dvh', overflow: 'hidden' }}>
      <audio ref={remoteAudioRef} autoPlay />

      {/* ── Video + Controls area ── */}
      <div className="video-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', minWidth: 0, overflow: 'hidden' }}>

        {/* Header */}
        <div className="glass-panel room-header" style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <h2 className="room-header-title" style={{ fontSize: '1.15rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="text-gradient">Sala: {roomId}</span>
              {isHost && (
                <button onClick={copyRoomCode} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
                  {copied ? <CheckCircle2 size={16} color="#10b981" /> : <Copy size={16} />}
                </button>
              )}
            </h2>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: connectionStatus.includes('Error') ? '#ef4444' : '#10b981', flexShrink: 0 }} />
              {connectionStatus}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={toggleMute}
              className="btn"
              style={{ background: isMuted ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', color: isMuted ? '#ef4444' : '#10b981', borderColor: isMuted ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)', padding: '10px 16px' }}
            >
              {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
              <span className="header-btn-text">{isMuted ? 'Silenciado' : 'Activo'}</span>
            </button>

            <button onClick={onLeave} className="btn" style={{ background: 'rgba(255,255,255,0.05)', padding: '10px 16px' }}>
              <LogOut size={18} />
              <span className="header-btn-text">Salir</span>
            </button>
          </div>
        </div>

        {/* Video Player */}
        <div className="glass-panel" style={{ flex: 1, borderRadius: '16px', overflow: 'hidden', position: 'relative', background: '#000', minHeight: 0 }}>
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
          />
        </div>

        {/* Video Controls — Host only */}
        {isHost && (
          <div className="glass-panel video-controls" style={{ padding: '12px', display: 'flex', gap: '8px', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button onClick={() => { setShowMediaBrowser(true); setMobileTab('search'); }} className="btn" style={{ background: '#ef4444', color: 'white', border: 'none', padding: '10px 16px' }}>
                <MonitorPlay size={18} />
                <span className="search-btn-text">Buscar en YouTube</span>
              </button>
              <span className="search-btn-text video-controls-hint" style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                Busca y selecciona un video sin salir de la app
              </span>
            </div>

            <form onSubmit={handleUrlChange} style={{ display: 'flex', gap: '8px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <PlaySquare size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  value={inputUrl}
                  onChange={e => setInputUrl(e.target.value)}
                  placeholder="Pega el enlace de YouTube..."
                  className="input-glass"
                  style={{ paddingLeft: '44px' }}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={!inputUrl.trim()} style={{ flexShrink: 0 }}>
                Reproducir
              </button>
            </form>
          </div>
        )}
      </div>

      {/* ── Desktop Chat Sidebar ── */}
      <div className="glass-panel desktop-chat" style={{ width: '320px', borderLeft: '1px solid var(--border-glass)', borderRadius: 0, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <ChatPanel />
      </div>

      {/* ── Mobile Chat Panel (full screen overlay) ── */}
      {mobileTab === 'chat' && (
        <div className="mobile-chat-panel glass-panel" style={{ borderRadius: 0 }}>
          <ChatPanel />
        </div>
      )}

      {/* ── Mobile Bottom Navigation ── */}
      <nav className="mobile-nav">
        <button
          className={`mobile-nav-btn ${mobileTab === 'player' ? 'active' : ''}`}
          onClick={() => setMobileTab('player')}
        >
          <Video size={22} />
          Video
        </button>

        <button
          className={`mobile-nav-btn ${mobileTab === 'chat' ? 'active' : ''}`}
          onClick={() => setMobileTab('chat')}
          style={{ position: 'relative' }}
        >
          <MessageCircle size={22} />
          Chat
          {messages.length > 0 && mobileTab !== 'chat' && (
            <span style={{
              position: 'absolute', top: '6px', right: 'calc(50% - 18px)',
              background: '#ef4444', color: 'white', borderRadius: '99px',
              fontSize: '0.55rem', fontWeight: 700, padding: '1px 5px', minWidth: '16px', textAlign: 'center'
            }}>
              {messages.length}
            </span>
          )}
        </button>

        {isHost && (
          <button
            className="mobile-nav-btn accent"
            onClick={() => setShowMediaBrowser(true)}
          >
            <Search size={22} />
            Buscar
          </button>
        )}

        <button
          className="mobile-nav-btn"
          onClick={onLeave}
          style={{ color: '#ef4444' }}
        >
          <LogOut size={22} />
          Salir
        </button>
      </nav>

      {/* ── Media Browser Modal ── */}
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
