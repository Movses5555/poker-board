import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import html2canvas from 'html2canvas';
import RealBoard from '@/assets/real-board.jpeg';
import LiveStreamWebRTCPage from "./components/LiveStreamWebRTCPage";


  
function App() {
  const [gameId, setGameId] = useState(null);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef(null);
  const screenRef = useRef(null);

  const backendUrl = import.meta.env.VITE_BACKEND_BASE_URL || "http://localhost:5050";
  const flopLiveInputId = import.meta.env.VITE_FLOP_LIVE_INPUT_ID || '';
 
  const takeAndUploadScreenshot = async (gameId, handLevel) => {
    if (screenRef.current) {
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

  useEffect(() => {
    let currentGameId = null;

    const params = new URLSearchParams(window.location.search);
    const gameIdFromUrl = params.get("game_id");
    if (gameIdFromUrl) {
      currentGameId = gameIdFromUrl;
      localStorage.setItem("game_id", gameIdFromUrl);
      console.log("Saved player_id to localStorage:", gameIdFromUrl);
      params.delete("game_id");
      const newUrl =
        window.location.pathname +
        (params.toString() ? "?" + params.toString() : "") +
        window.location.hash;
      window.history.replaceState(null, "", newUrl);
    } else {
      const gameIdFromStorage = localStorage.getItem("game_id");
      if (gameIdFromStorage) {
        currentGameId = gameIdFromStorage;
      }
    }

    if(currentGameId) {
      setGameId(currentGameId);
      setLoading(true);
      const socket = io(backendUrl, {
        withCredentials: true,
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000
      });
      socketRef.current = socket;
  
      socket.on('connect', () => {
        console.log('Connected to server');
        socket.emit('table:register', {
          gameId: currentGameId
        });
        socket.emit('ping-server', { message: 'Hello from client' });
        setLoading(false);
      });
  
      socket.on('pong-client', (data) => {
        console.log('Received from server:', data);
      });
  
      socket.on('make-screenshot', (data) => {
        console.log('Server requested screenshot for game:', data.gameId);
        takeAndUploadScreenshot(data.gameId, data.handLevel);
      });
  
      return () => {
        socket.disconnect();
      };
    }
  }, [backendUrl]);

  if (!!loading) {
    return (
      <div className='w-full h-full min-h-96 flex items-center justify-center text-black'>
        <div><p>Loading data ....</p></div>
      </div>
    )
  }
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

  return (
    <div ref={screenRef} className='w-[100vw] h-full max-h-screen bg-[#D0D1D3] text-black'>
      <img
        src={RealBoard}
        className='w-full h-full max-w-screen max-h-screen aspect-16/9 object-center rotate-180' // rotate-180
      />
    </div>
  );
}


export default App;
