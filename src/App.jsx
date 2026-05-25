import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import html2canvas from 'html2canvas';
// import RealBoard from '@/assets/real-board.jpeg';
// import RealBoard from '@/assets/real_board.png';
// import RealBoard from '@/assets/board-hand-3.png';
import LiveStreamWebRTCPage from "./components/LiveStreamWebRTCPage";


  
function App() {
  const [gameId, setGameId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(null);
  const socketRef = useRef(null);
  const screenRef = useRef(null);

  const backendUrl = import.meta.env.VITE_BACKEND_BASE_URL || "http://localhost:5050";
  const flopLiveInputId = import.meta.env.VITE_FLOP_LIVE_INPUT_ID || '';
 
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

    socket.on('table:synced', ({ success, gameId: syncedGameId, message }) => {
      if (success && syncedGameId) {
        setGameId(syncedGameId);
        localStorage.setItem('game_id', syncedGameId);
        setConnectionError(null);
        console.log('Table synced to active game:', syncedGameId);
      } else {
        setConnectionError(message || 'No active game on server');
        console.warn('Table sync failed:', message);
      }
      setLoading(false);
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

    socket.on('connect_error', (err) => {
      setConnectionError(err.message);
      setLoading(false);
    });

    return () => {
      socket.disconnect();
    };
  }, [backendUrl]);

  if (loading) {
    return (
      <div className='w-full h-full min-h-96 flex items-center justify-center text-black'>
        <div><p>Connecting to server...</p></div>
      </div>
    )
  }

  if (connectionError) {
    return (
      <div className='w-full h-full min-h-96 flex items-center justify-center text-black p-6'>
        <div className='text-center'>
          <p className='font-semibold'>Board connection issue</p>
          <p className='text-sm mt-2'>{connectionError}</p>
          <p className='text-sm mt-2'>Start a game in admin, then refresh this page.</p>
        </div>
      </div>
    );
  }

  // return (
  //   <div ref={screenRef} className='w-[100vw] h-full max-h-screen bg-[#D0D1D3] text-black'>
  //     {gameId && (
  //       <p className='absolute top-1 left-2 text-xs opacity-40 z-10'>game: {gameId.slice(0, 8)}…</p>
  //     )}
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
          <LiveStreamWebRTCPage
            liveInputId={flopLiveInputId}
            className='w-full h-full object-contain rotate-180'
          />
        </div>
      </div>
    </div>
  )
}

export default App;
