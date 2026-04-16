import React, { useState } from 'react';
import { Search, MonitorPlay, Globe, X, Play, Clock, ExternalLink } from 'lucide-react';

interface MediaBrowserProps {
  onSelectVideo: (url: string) => void;
  onClose: () => void;
}

interface SearchResult {
  videoId: string;
  title: string;
  author: string;
  lengthSeconds?: number;
  videoThumbnails: { url: string; width?: number; height?: number }[];
  viewCount?: number;
}

// Active public Invidious instances (fallbacks in order)
const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://invidious.privacydev.net',
  'https://iv.melmac.space',
  'https://invidious.fdn.fr',
];

// Detect Capacitor native app
const isNative = () => !!(window as any).Capacitor;

const formatDuration = (seconds?: number): string => {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const getBestThumbnail = (thumbnails: { url: string; width?: number }[]): string => {
  if (!thumbnails || thumbnails.length === 0) return '';
  // Prefer medium quality thumbnail
  const sorted = [...thumbnails].sort((a, b) => (b.width || 0) - (a.width || 0));
  const medium = sorted.find(t => (t.width || 0) >= 320 && (t.width || 0) <= 640);
  return medium?.url || sorted[0]?.url || '';
};

const MediaBrowser: React.FC<MediaBrowserProps> = ({ onSelectVideo, onClose }) => {
  const [youtubeQuery, setYoutubeQuery] = useState('');
  const [webQuery, setWebQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [longResults, setLongResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'youtube' | 'web'>('youtube');
  const [webUrl, setWebUrl] = useState('https://www.cuevana3.io');

  // ── Generic Invidious search helper ─────────────────────────────────
  const invidiousSearch = async (query: string, extraParams = ''): Promise<SearchResult[]> => {
    for (const instance of INVIDIOUS_INSTANCES) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const response = await fetch(
          `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video${extraParams}`,
          { signal: controller.signal }
        );
        clearTimeout(timeout);
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && data.length > 0) return data;
        }
      } catch {
        // try next
      }
    }
    return [];
  };

  // ── YouTube tab search ───────────────────────────────────────────────
  const searchYouTube = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeQuery.trim()) return;
    setLoading(true);
    setError(null);
    setResults([]);
    const data = await invidiousSearch(youtubeQuery);
    if (data.length > 0) {
      setResults(data);
    } else {
      setError('No se pudo conectar a ningún servidor. Pega el link directamente en la sala.');
    }
    setLoading(false);
  };

  // ── Web tab search (long videos = películas) ─────────────────────────
  const searchLongVideos = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webQuery.trim()) return;
    setLoading(true);
    setError(null);
    setLongResults([]);
    // duration=long = videos > 20 minutes on YouTube (full movies/episodes)
    const data = await invidiousSearch(webQuery, '&duration=long&sort_by=relevance');
    if (data.length > 0) {
      setLongResults(data);
    } else {
      setError('No se encontraron resultados. Intenta con otro término.');
    }
    setLoading(false);
  };

  // ── Open InAppBrowser (Android native only) ──────────────────────────
  const openInAppBrowser = (url: string) => {
    // @ts-ignore
    if (typeof cordova !== 'undefined' && cordova.InAppBrowser) {
      // @ts-ignore
      const ref = cordova.InAppBrowser.open(url, '_blank', [
        'location=yes',
        'toolbar=yes',
        'toolbarposition=top',
        'closebuttoncaption=✕ Cerrar',
        'toolbarcolor=#0f0f13',
        'navigationbuttoncolor=#a78bfa',
        'closebuttoncolor=#ffffff',
        'zoom=no',
        'enableViewportScale=yes',
      ].join(','));

      // Intercept video URLs — when user navigates to a video page
      ref.addEventListener('loadstart', (event: any) => {
        const url: string = event.url || '';
        // YouTube watch URL
        if (url.includes('youtube.com/watch?v=') || url.includes('youtu.be/')) {
          ref.close();
          onSelectVideo(url);
          onClose();
        }
        // Direct video files (mp4, m3u8, etc.)
        if (/\.(mp4|m3u8|webm|mkv)(\?|$)/.test(url)) {
          ref.close();
          onSelectVideo(url);
          onClose();
        }
      });
    }
  };

  const handleSelect = (videoId: string) => {
    onSelectVideo(`https://www.youtube.com/watch?v=${videoId}`);
    onClose();
  };

  // ── Video card component ─────────────────────────────────────────────
  const VideoCard = ({ item, onClick }: { item: SearchResult; onClick: () => void }) => {
    const duration = item.lengthSeconds;
    const isMovie = duration && duration > 3600; // > 1 hour
    const isLong = duration && duration > 1200;  // > 20 min
    return (
      <div
        onClick={onClick}
        style={{
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '12px',
          overflow: 'hidden',
          cursor: 'pointer',
          transition: 'all 0.2s',
          border: '1px solid transparent',
          position: 'relative',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'var(--accent-primary)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'transparent';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        {/* Badge */}
        {isMovie && (
          <div style={{
            position: 'absolute', top: '8px', left: '8px', zIndex: 2,
            background: 'rgba(167, 139, 250, 0.9)', color: 'white',
            fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '99px'
          }}>🎬 PELÍCULA</div>
        )}
        {isLong && !isMovie && (
          <div style={{
            position: 'absolute', top: '8px', left: '8px', zIndex: 2,
            background: 'rgba(59,130,246,0.9)', color: 'white',
            fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '99px'
          }}>📺 LARGO</div>
        )}

        {/* Thumbnail */}
        <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', background: '#111' }}>
          <img
            src={getBestThumbnail(item.videoThumbnails)}
            alt={item.title}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
          {/* Duration badge */}
          {duration && (
            <div style={{
              position: 'absolute', bottom: '6px', right: '6px',
              background: 'rgba(0,0,0,0.85)', color: 'white',
              fontSize: '0.75rem', fontWeight: 600, padding: '2px 6px', borderRadius: '4px',
              display: 'flex', alignItems: 'center', gap: '4px'
            }}>
              <Clock size={10} />
              {formatDuration(duration)}
            </div>
          )}
          {/* Play overlay */}
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: 0, transition: '0.3s'
          }}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0'}
          >
            <Play size={48} color="white" />
          </div>
        </div>

        {/* Info */}
        <div style={{ padding: '12px' }}>
          <h4 style={{
            fontSize: '0.9rem', fontWeight: 600, marginBottom: '4px',
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            lineHeight: '1.3'
          }}>{item.title}</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{item.author}</p>
        </div>
      </div>
    );
  };

  // ── Results grid ─────────────────────────────────────────────────────
  const ResultsGrid = ({ items, onSelect }: { items: SearchResult[]; onSelect: (id: string) => void }) => (
    <div style={{
      flex: 1, overflowY: 'auto', padding: '20px',
      display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px'
    }}>
      {items.map((item, idx) => (
        <VideoCard key={idx} item={item} onClick={() => onSelect(item.videoId)} />
      ))}

      {loading && (
        <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px', animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</div>
          <p>Buscando videos disponibles...</p>
        </div>
      )}

      {error && (
        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⚠️</div>
          <p style={{ color: '#ef4444', marginBottom: '8px' }}>{error}</p>
        </div>
      )}

      {!loading && !error && items.length === 0 && (activeTab === 'youtube' ? youtubeQuery : webQuery) && (
        <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
          No se encontraron resultados.
        </div>
      )}
    </div>
  );

  return (
    <div className="glass-panel animate-fade-in media-browser-overlay" style={{
      position: 'fixed', top: '5%', left: '5%', right: '5%', bottom: '5%',
      zIndex: 100, display: 'flex', flexDirection: 'column',
      background: 'rgba(10, 10, 14, 0.97)',
      border: '1px solid var(--accent-primary)',
      boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
      borderRadius: '20px', overflow: 'hidden'
    }}>

      {/* ── Header ── */}
      <div style={{
        padding: '16px 24px', borderBottom: '1px solid var(--border-glass)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'rgba(255,255,255,0.02)'
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('youtube')}
            style={{
              background: activeTab === 'youtube' ? 'rgba(239,68,68,0.15)' : 'transparent',
              border: activeTab === 'youtube' ? '1px solid rgba(239,68,68,0.4)' : '1px solid transparent',
              color: activeTab === 'youtube' ? '#ef4444' : 'var(--text-muted)',
              fontSize: '0.95rem', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: '8px',
              cursor: 'pointer', padding: '8px 16px', borderRadius: '8px', transition: '0.2s'
            }}
          >
            <MonitorPlay size={18} /> YouTube
          </button>
          <button
            onClick={() => setActiveTab('web')}
            style={{
              background: activeTab === 'web' ? 'rgba(59,130,246,0.15)' : 'transparent',
              border: activeTab === 'web' ? '1px solid rgba(59,130,246,0.4)' : '1px solid transparent',
              color: activeTab === 'web' ? '#3b82f6' : 'var(--text-muted)',
              fontSize: '0.95rem', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: '8px',
              cursor: 'pointer', padding: '8px 16px', borderRadius: '8px', transition: '0.2s'
            }}
          >
            <Globe size={18} /> Navegador Web
          </button>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
          <X size={22} />
        </button>
      </div>

      {/* ── YouTube Tab ── */}
      {activeTab === 'youtube' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <form onSubmit={searchYouTube} style={{ padding: '16px 20px', display: 'flex', gap: '10px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={youtubeQuery}
                onChange={e => setYoutubeQuery(e.target.value)}
                placeholder="Busca cualquier video de YouTube..."
                className="input-glass"
                style={{ paddingLeft: '44px' }}
                autoFocus
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '...' : 'Buscar'}
            </button>
          </form>
          <ResultsGrid items={results} onSelect={handleSelect} />
        </div>
      )}

      {/* ── Web Browser Tab ── */}
      {activeTab === 'web' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

          {isNative() ? (
            /* ── NATIVE: Real InAppBrowser ── */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px', gap: '16px' }}>
              <div style={{
                background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
                borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'flex-start', gap: '12px'
              }}>
                <Globe size={20} color="#3b82f6" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <p style={{ fontWeight: 600, marginBottom: '4px' }}>Navegador Nativo Android</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Abre cualquier sitio web. Cuando encuentres un video, la app lo detectará automáticamente y lo reproducirá en la sala.
                  </p>
                </div>
              </div>

              {/* URL bar */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Globe size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    value={webUrl}
                    onChange={e => setWebUrl(e.target.value)}
                    placeholder="https://..."
                    className="input-glass"
                    style={{ paddingLeft: '40px', fontFamily: 'monospace', fontSize: '0.85rem' }}
                  />
                </div>
                <button
                  onClick={() => openInAppBrowser(webUrl)}
                  className="btn btn-primary"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  <ExternalLink size={16} /> Abrir
                </button>
              </div>

              {/* Quick links */}
              <div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '10px' }}>Acceso rápido:</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {[
                    { name: '🎬 Cuevana', url: 'https://www.cuevana3.io' },
                    { name: '🍿 Pelisplus', url: 'https://pelisplus.app' },
                    { name: '📺 Pluto TV', url: 'https://pluto.tv' },
                    { name: '🎥 Tubi', url: 'https://tubitv.com' },
                    { name: '▶️ YouTube', url: 'https://m.youtube.com' },
                    { name: '🌐 Google', url: 'https://www.google.com' },
                  ].map(site => (
                    <button
                      key={site.url}
                      onClick={() => openInAppBrowser(site.url)}
                      style={{
                        background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-glass)',
                        color: 'var(--text-main)', padding: '8px 14px', borderRadius: '8px',
                        cursor: 'pointer', fontSize: '0.85rem', transition: '0.2s',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(59,130,246,0.15)';
                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(59,130,246,0.4)';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)';
                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-glass)';
                      }}
                    >
                      {site.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* ── WEB FALLBACK: Long video search ── */
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-glass)' }}>
                <div style={{
                  background: 'rgba(255,193,7,0.08)', border: '1px solid rgba(255,193,7,0.2)',
                  borderRadius: '10px', padding: '12px 16px', marginBottom: '14px',
                  display: 'flex', gap: '10px', alignItems: 'center'
                }}>
                  <span style={{ fontSize: '1.2rem' }}>📱</span>
                  <p style={{ color: 'rgba(255,193,7,0.9)', fontSize: '0.82rem' }}>
                    El navegador completo (Cuevana, etc.) está disponible en la <b>app de Android</b>.
                    Aquí se muestran películas completas disponibles en YouTube.
                  </p>
                </div>
                <form onSubmit={searchLongVideos} style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      value={webQuery}
                      onChange={e => setWebQuery(e.target.value)}
                      placeholder="Ej: chicken little pelicula completa español..."
                      className="input-glass"
                      style={{ paddingLeft: '44px' }}
                      autoFocus
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? '...' : 'Buscar'}
                  </button>
                </form>
              </div>
              <ResultsGrid items={longResults} onSelect={handleSelect} />
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default MediaBrowser;
