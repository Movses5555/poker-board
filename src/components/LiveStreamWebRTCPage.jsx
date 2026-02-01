import React, { useRef, useEffect, useState } from 'react';

const LiveStreamWebRTCPage = ({
    liveInputId,
    classNames = ''
}) => {
    const videoRef = useRef(null);
    const peerConnectionRef = useRef(null);
    // const [whepUrl, setWhepUrl] = useState('https://customer-lb531lwdci58z5n1.cloudflarestream.com/92cea811ffb2f9a475211ba5faf104fb/webRTC/play');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const whepUrl = `https://customer-lb531lwdci58z5n1.cloudflarestream.com/${liveInputId}/webRTC/play`

    useEffect(() => {
        if (!whepUrl || !videoRef.current) return;

        const connectWebRTC = async () => {
            setIsLoading(true);
            setError(null);

            // Clean up any existing connection
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
            }

            try {
                // Create new PeerConnection with Cloudflare's STUN server
                const pc = new RTCPeerConnection({
                    iceServers: [
                        { urls: 'stun:stun.cloudflare.com:3478' },
                        // Add TURN servers if needed for NAT traversal
                    ],
                    iceTransportPolicy: 'all' // Try 'relay' if connectivity issues
                });
                peerConnectionRef.current = pc;

                // Handle incoming media
                pc.ontrack = (event) => {
                    if (event.streams && event.streams[0] && videoRef.current) {
                        videoRef.current.srcObject = event.streams[0];
                        videoRef.current.play().catch(e => {
                            console.warn('Autoplay prevented:', e);
                            // Show play button to user
                        });
                    }
                };

                // Create data channel (sometimes helps with connection stability)
                pc.createDataChannel('stream');

                // Create and set local offer
                const offer = await pc.createOffer({
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: true
                });
                await pc.setLocalDescription(offer);

                // Send offer to WHEP endpoint
                const response = await fetch(whepUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/sdp',
                        'Accept': 'application/sdp',
                        // Add CORS headers if needed
                        'Origin': window.location.origin
                    },
                    body: pc.localDescription.sdp
                });

                if (!response.ok) {
                    throw new Error(`Server responded with ${response.status}: ${await response.text()}`);
                }

                // Process the answer
                const answerSdp = await response.text();
                await pc.setRemoteDescription({
                    type: 'answer',
                    sdp: answerSdp
                });

                setIsLoading(false);

            } catch (err) {
                console.error('WebRTC connection failed:', err);
                setError(`Connection failed: ${err.message}`);
                setIsLoading(false);
                
                // Clean up on failure
                if (peerConnectionRef.current) {
                    peerConnectionRef.current.close();
                    peerConnectionRef.current = null;
                }
            }
        };

        connectWebRTC();

        return () => {
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
            }
        };
    }, [whepUrl]);

    return (
        <div
            style={{ transform: 'rotate(180deg)' }}
            className={classNames}
        >
            {/* <h1>Live Stream (WebRTC - Low Latency)</h1> */}
            
            {isLoading && (
                <div className="loading-state w-full h-full min-w-full max-h-full">
                    <p>Connecting to stream...</p>
                    <div className="spinner"></div>
                </div>
            )}
            
            {error && (
                <div className="error-state min-w-full max-h-full w-full h-full flex items-center justify-center text-center" style={{ color: 'red', padding: '1rem', background: '#ffeeee' }}>
                    <p><strong></strong> No Camera</p>
                    <button onClick={() => window.location.reload()}></button>
                </div>
            )}
            
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                controls={false}
                className='min-w-full max-h-full'
                style={{
                    width: '100%',
                    backgroundColor: '#000',
                    display: (isLoading || error) ? 'none' : 'block'
                }}
            />
            
            {/* Fallback play button */}
            {/* <div style={{ display: (isLoading || error) ? 'none' : 'block', textAlign: 'center' }}>
                <button 
                    onClick={() => videoRef.current?.play()} 
                    style={{ display: videoRef.current?.paused ? 'block' : 'none' }}
                >
                    Play Stream
                </button>
            </div> */}
        </div>
    );
}

export default LiveStreamWebRTCPage;