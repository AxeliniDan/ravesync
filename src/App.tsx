import { useState } from 'react';
import JoinScreen from './components/JoinScreen';
import SyncRoom from './components/SyncRoom';
import './index.css';

function App() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);

  const handleCreateRoom = (newRoomId: string) => {
    setRoomId(newRoomId);
    setIsHost(true);
  };

  const handleJoinRoom = (existingRoomId: string) => {
    setRoomId(existingRoomId);
    setIsHost(false);
  };

  const handleLeaveRoom = () => {
    setRoomId(null);
    setIsHost(false);
  };

  return (
    <div className="app-container">
      {!roomId ? (
        <JoinScreen onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} />
      ) : (
        <SyncRoom roomId={roomId} isHost={isHost} onLeave={handleLeaveRoom} />
      )}
    </div>
  );
}

export default App;
