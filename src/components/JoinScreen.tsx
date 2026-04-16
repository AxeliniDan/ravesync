import React, { useState } from 'react';
import { Play, Users, Link2, MonitorPlay } from 'lucide-react';

interface JoinScreenProps {
  onCreateRoom: (roomId: string) => void;
  onJoinRoom: (roomId: string) => void;
}

const JoinScreen: React.FC<JoinScreenProps> = ({ onCreateRoom, onJoinRoom }) => {
  const [joinCode, setJoinCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = () => {
    setIsCreating(true);
    // Generate a random 6-character alphanumeric code for the room
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    onCreateRoom(code);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinCode.trim()) {
      onJoinRoom(joinCode.trim().toUpperCase());
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px' }}>
      
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <MonitorPlay size={48} className="text-gradient" />
        </div>
        <h1 style={{ fontSize: '3rem', fontWeight: 700, marginBottom: '8px' }}>Rave<span className="text-gradient">Sync</span></h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', maxWidth: '400px' }}>
          Sincroniza videos de YouTube y Google Drive con tus amigos. Red P2P de ultra baja latencia.
        </p>
      </div>

      <div className="glass-panel" style={{ width: '100%', maxWidth: '450px', padding: '40px', display: 'flex', flexDirection: 'column', gap: '30px' }}>
        
        {/* Create Room Section */}
        <div>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', fontWeight: 600 }}>Nueva Sesión Privada</h2>
          <button 
            onClick={handleCreate} 
            disabled={isCreating}
            className="btn btn-primary" 
            style={{ width: '100%', padding: '16px' }}
          >
            <Play size={20} />
            {isCreating ? 'Iniciando...' : 'Crear Sala de Reproducción'}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: 'var(--text-muted)' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-glass)' }}></div>
          <span style={{ fontSize: '0.9rem' }}>O únete a una existente</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-glass)' }}></div>
        </div>

        {/* Join Room Section */}
        <form onSubmit={handleJoin}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Link2 size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Código de Invitación" 
                className="input-glass"
                style={{ paddingLeft: '48px', textTransform: 'uppercase' }}
                maxLength={6}
              />
            </div>
            <button type="submit" disabled={joinCode.length < 3} className="btn" style={{ background: 'var(--bg-glass)' }}>
              <Users size={20} />
              Unirse
            </button>
          </div>
        </form>

      </div>
      
      <div style={{ marginTop: '40px', color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px rgba(16, 185, 129, 0.5)' }}></div>
        Red P2P Activa y Segura
      </div>
    </div>
  );
};

export default JoinScreen;
