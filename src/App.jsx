import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import html2canvas from 'html2canvas';
// import RealBoard from '@/assets/real-board.jpeg';
// import RealBoard from '@/assets/real_board.png';
// import RealBoard from '@/assets/board-hand-1.png';
import LiveStreamWebRTCPage from "./components/LiveStreamWebRTCPage";
import NanoPlayerEmbed from './components/NanoPlayerEmbed';


  
function App() {
  const [gameId, setGameId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(null);
  const socketRef = useRef(null);
  const screenRef = useRef(null);

  const backendUrl = import.meta.env.VITE_BACKEND_BASE_URL || "http://localhost:5050";
  const flopLiveInputId = import.meta.env.VITE_FLOP_LIVE_INPUT_ID || '';
  const nanoPlayerDeskGroupIdFLOP = import.meta.env.VITE_NANOPLAYER_GROUP_ID_FLOP || 'a40b45f5-c759-49d1-8b2d-369d81420140';

  const takeAndUploadScreenshot = async (gameId, handLevel) => {
    if (screenRef.current && socketRef.current?.connected) {
      try {
        const elementWidth = screenRef.current.offsetWidth;
        const targetHeight = (elementWidth * 9) / 16;

        const canvas = await html2canvas(screenRef.current, {
          useCORS: true,
          logging: false,
          width: elementWidth,
          height: targetHeight,
          x: 0,
          y: 0,
          scrollX: 0,
          scrollY: 0
        });
  
        const imageData = canvas.toDataURL("image/png", 0.6); 
        
        socketRef.current.emit('screenshot-upload', {
          image: imageData,
          gameId: gameId,
          handLevel: handLevel
        });
  
      } catch (error) {
        console.error('Screenshot failed:', error);
      }
    }
  };

  const registerTable = (socket, preferredGameId) => {
    if (preferredGameId) {
      socket.emit('table:register', { gameId: preferredGameId });
    }
    socket.emit('table:sync-active-game');
  };

  useEffect(() => {
    let preferredGameId = null;

    const params = new URLSearchParams(window.location.search);
    const gameIdFromUrl = params.get("game_id");
    if (gameIdFromUrl) {
      preferredGameId = gameIdFromUrl;
      localStorage.setItem("game_id", gameIdFromUrl);
      params.delete("game_id");
      const newUrl =
        window.location.pathname +
        (params.toString() ? "?" + params.toString() : "") +
        window.location.hash;
      window.history.replaceState(null, "", newUrl);
    } else {
      preferredGameId = localStorage.getItem("game_id");
    }

    setLoading(true);
    setConnectionError(null);

    const socket = io(backendUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      timeout: 20000
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to server');
      registerTable(socket, preferredGameId);

      const sendPing = () => {
        socket.emit('ping-server', { message: 'table heartbeat' });
      };
      sendPing();
      const pingInterval = setInterval(sendPing, 15000);
      socket.on('disconnect', () => clearInterval(pingInterval));
    });

    socket.on('table:synced', ({ success, gameId: syncedGameId, message, inLobby }) => {
      if (success && syncedGameId) {
        setGameId(syncedGameId);
        localStorage.setItem('game_id', syncedGameId);
        setConnectionError(
          inLobby ? 'Waiting for admin to start the hand…' : null,
        );
        console.log('Table synced to active game:', syncedGameId, { inLobby });
      } else {
        setConnectionError(message || 'No active game on server');
        console.warn('Table sync failed:', message);
      }
      setLoading(false);
    });

    socket.on('broadcast:game-data', ({ hand }) => {
      if (hand?.game_id) {
        setGameId(hand.game_id);
        localStorage.setItem('game_id', hand.game_id);
        setConnectionError(null);
      }
    });

    socket.on('game-data', ({ hand }) => {
      if (hand?.game_id) {
        setGameId(hand.game_id);
        localStorage.setItem('game_id', hand.game_id);
        setConnectionError(null);
      }
    });

    socket.on('table:registered', (data) => {
      console.log('Table registered:', data);
    });

    socket.on('pong-client', (data) => {
      console.log('Received from server:', data);
    });

    socket.on('make-screenshot', (data) => {
      console.log('Server requested screenshot for game:', data.gameId);
      takeAndUploadScreenshot(data.gameId, data.handLevel);
    });

    socket.on('broadcast:refresh-clients', (data) => {
      if (data?.gameId) {
        localStorage.setItem('game_id', data.gameId);
      }
      window.location.reload();
    });

    socket.on('connect_error', (err) => {
      setConnectionError(err.message);
      setLoading(false);
    });

    return () => {
      socket.disconnect();
    };
  }, [backendUrl]);

  useEffect(() => {
    if (gameId && !connectionError) {
      return;
    }
    const retrySync = () => {
      socketRef.current?.emit('table:sync-active-game');
    };
    const interval = setInterval(retrySync, 3000);
    return () => clearInterval(interval);
  }, [gameId, connectionError]);

  if (loading) {
    return (
      <div className='w-full h-full min-h-96 flex items-center justify-center text-black'>
        <div><p>Connecting to server...</p></div>
      </div>
    )
  }

  if (connectionError && !gameId) {
    return (
      <div className='w-full h-full min-h-96 flex items-center justify-center text-black p-6'>
        <div className='text-center'>
          <p className='font-semibold'>Board connection issue</p>
          <p className='text-sm mt-2'>{connectionError}</p>
          <p className='text-sm mt-2'>
            Create a lobby in admin and start the game. This page will reconnect automatically.
          </p>
        </div>
      </div>
    );
  }

  // return (
  //   <div ref={screenRef} className='w-[100vw] h-full max-h-screen bg-[#D0D1D3] text-black'>
  //     {gameId && (
  //       <p className='absolute top-1 left-2 text-xs opacity-40 z-10'>game: {gameId.slice(0, 8)}…</p>
  //     )}
  //     {connectionError && gameId ? (
  //       <p className='absolute top-6 left-2 text-xs text-amber-800 z-10'>{connectionError}</p>
  //     ) : null}
  //     <img
  //       src={RealBoard}
  //       className='w-full h-full max-w-screen max-h-screen aspect-16/9 object-center'
  //     />
  //   </div>
  // );
  return (
    <div className='w-screen h-screen bg-[#D0D1D3] text-black flex' >
      <div className='relative w-full h-full max-w-[100vw] max-h-[100vh]'>
        <div ref={screenRef}  className='absolute top-0 left-0 w-full h-full max-w-[calc(100vh*(16/9))] max-h-[calc(100vw*(9/16))]'>
          {/* <LiveStreamWebRTCPage
            liveInputId={flopLiveInputId}
            className='w-full h-full object-contain rotate-180'
          /> */}
          <NanoPlayerEmbed
            groupId={nanoPlayerDeskGroupIdFLOP}
            title="Dealer Camera"
            hideControls
            // classNames={`p-[20px] xl:p-[50px] 2xl:p-[60px] ${videoClassNames}`}
          />
        </div>
      </div>
    </div>
  )
}

export default App;
