import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import html2canvas from 'html2canvas';
import Ellipse from '@/assets/ellipse.svg';
import RealBoard from '@/assets/real-board.jpeg';


  
function App() {
  const [loading, setLoading] = useState(true);
  const socketRef = useRef(null);
  const screenRef = useRef(null);

  const backendUrl = import.meta.env.VITE_BACKEND_BASE_URL || "http://localhost:5050";
 
  const takeAndUploadScreenshot = async (gameId, handLevel) => {
    if (screenRef.current) {
      try {
        // 1. Ստանում ենք էլեմենտի ընթացիկ լայնությունը
        const elementWidth = screenRef.current.offsetWidth;
        // 2. Հաշվարկում ենք 16:9 հարաբերակցությանը համապատասխան բարձրությունը
        const targetHeight = (elementWidth * 9) / 16;

        const canvas = await html2canvas(screenRef.current, {
          useCORS: true,
          logging: false,
          // 3. Սահմանափակում ենք նկարվող տարածքը
          width: elementWidth,
          height: targetHeight,
          // Սա ապահովում է, որ նկարը սկսվի x=0, y=0 կետից
          x: 0,
          y: 0,
          scrollX: 0,
          scrollY: 0
        });
  
        // Կարևոր է՝ օգտագործել image/jpeg, քանի որ այն սեղմվում է (ի տարբերություն PNG-ի)
        const imageData = canvas.toDataURL("image/png", 0.6); 
        console.log("===========", imageData);
        
        // Ուղարկում ենք սոկետով
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

  const takeAndUploadScreenshot2 = async (gameId, handLevel) => {
    if (screenRef.current) {
      try {
        // 1. Ստանում ենք էլեմենտի ընթացիկ լայնությունը
        const elementWidth = screenRef.current.offsetWidth;
        
        // 2. Հաշվարկում ենք 16:9 հարաբերակցությանը համապատասխան բարձրությունը
        const targetHeight = (elementWidth * 9) / 16;
  
        const canvas = await html2canvas(screenRef.current, {
          useCORS: true,
          logging: false,
          // 3. Սահմանափակում ենք նկարվող տարածքը
          width: elementWidth,
          height: targetHeight,
          // Սա ապահովում է, որ նկարը սկսվի x=0, y=0 կետից
          x: 0,
          y: 0,
          scrollX: 0,
          scrollY: 0
        });
  
        const imageData = canvas.toDataURL("image/png");
        console.log('imageData',  imageData);
        
        // socketRef.current.emit('screenshot-upload', {
        //   image: imageData,
        //   gameId: gameId,
        //   handLevel: handLevel
        // });
        try {
          await axios.post(`${backendUrl}/game/upload-screenshot`, {
            image: imageData,
            gameId: gameId,
            handLevel: handLevel
          });
        } catch (error) {
          console.error('Screenshot upload failed:', error);
        }


      } catch (error) {
        console.error('Screenshot capture failed:', error);
      }
    }
  };


  useEffect(() => {
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
  }, []);

  if (!!loading) {
    return (
      <div className='w-full h-full min-h-96 flex items-center justify-center text-black'>
        <div><p>Loading data ....</p></div>
      </div>
    )
  }

  return (
    <div ref={screenRef} className='w-[100vw] h-full max-h-screen bg-[#D0D1D3] text-black'>
      <img
        src={RealBoard}
        className='w-full h-full max-w-screen max-h-screen aspect-16/9 object-center rotate-180'
      />
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
