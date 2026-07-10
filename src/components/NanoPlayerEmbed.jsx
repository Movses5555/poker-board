import React, { forwardRef, useEffect, useId, useImperativeHandle, useMemo, useRef } from 'react';

const NANOPLAYER_SCRIPT_URL = 'https://demo.nanocosmos.de/nanoplayer/api/release/nanoplayer.5.min.js';
const DEFAULT_GROUP_ID = 'a40b45f5-c759-49d1-8b2d-369d81420140';

let nanoPlayerScriptPromise = null;

const loadNanoPlayerScript = () => {
  if (window.NanoPlayer) {
    return Promise.resolve();
  }

  if (nanoPlayerScriptPromise) {
    return nanoPlayerScriptPromise;
  }

  nanoPlayerScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${NANOPLAYER_SCRIPT_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load NanoPlayer script')));
      return;
    }

    const script = document.createElement('script');
    script.src = NANOPLAYER_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load NanoPlayer script'));
    document.head.appendChild(script);
  });

  return nanoPlayerScriptPromise;
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const videoScore = (video) => {
  if (!video) return -1;
  const width = video.videoWidth || 0;
  const height = video.videoHeight || 0;
  if (!width || !height) return 0;
  return (
    (video.readyState || 0) * 10 +
    (video.paused ? 0 : 5) +
    (video.currentTime > 0 ? 2 : 0) +
    Math.min(width, 1920) / 1920
  );
};

const frameToDataUrl = (video) => {
  if (!video || !video.videoWidth || !video.videoHeight) {
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  try {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png', 0.6);
  } catch (error) {
    console.error('Failed to encode video frame:', error);
    return null;
  }
};

const canvasToDataUrl = (canvas) => {
  if (!canvas || !canvas.width || !canvas.height) return null;
  try {
    return canvas.toDataURL('image/png', 0.6);
  } catch (error) {
    console.error('Failed to encode canvas frame:', error);
    return null;
  }
};

const describeMedia = (el) => ({
  tag: el?.tagName,
  id: el?.id || null,
  readyState: el?.readyState,
  videoWidth: el?.videoWidth,
  videoHeight: el?.videoHeight,
  paused: el?.paused,
  currentTime: el?.currentTime,
  width: el?.width,
  height: el?.height,
});

const NanoPlayerEmbed = forwardRef(({
  groupId,
  classNames = '',
  title = 'Live stream',
  hideControls = false,
  scaling = 'letterbox',
}, ref) => {
  const reactId = useId();
  const idBase = useMemo(
    () => `nano-${reactId.replace(/:/g, '')}`,
    [reactId],
  );
  const containerId = `${idBase}-player`;
  const videoIdA = `${idBase}-video-a`;
  const videoIdB = `${idBase}-video-b`;

  const rootRef = useRef(null);
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const activeVideoRef = useRef(null);

  const collectVideoCandidates = () => {
    const seen = new Set();
    const videos = [];

    const push = (video) => {
      if (!video || seen.has(video)) return;
      seen.add(video);
      videos.push(video);
    };

    push(activeVideoRef.current);
    push(document.getElementById(videoIdA));
    push(document.getElementById(videoIdB));

    const scopes = [containerRef.current, rootRef.current].filter(Boolean);
    for (const scope of scopes) {
      scope.querySelectorAll('video').forEach(push);
    }

    // NanoPlayer sometimes keeps the playing element outside our React nodes.
    document.querySelectorAll('video').forEach((video) => {
      if ((video.videoWidth || 0) > 0) push(video);
    });

    return videos.sort((a, b) => videoScore(b) - videoScore(a));
  };

  const collectCanvasCandidates = () => {
    const scopes = [containerRef.current, rootRef.current].filter(Boolean);
    const canvases = [];
    for (const scope of scopes) {
      scope.querySelectorAll('canvas').forEach((canvas) => {
        if (canvas.width > 0 && canvas.height > 0) {
          canvases.push(canvas);
        }
      });
    }
    return canvases;
  };

  const pickBestVideo = () => collectVideoCandidates()[0] || null;

  useImperativeHandle(ref, () => ({
    getVideoElement: () => pickBestVideo(),

    captureFrame: async ({ timeoutMs = 5000, intervalMs = 150 } = {}) => {
      const deadline = Date.now() + timeoutMs;

      while (Date.now() <= deadline) {
        const videos = collectVideoCandidates();
        for (const video of videos) {
          if (videoScore(video) <= 0) continue;
          const imageData = frameToDataUrl(video);
          if (imageData) {
            activeVideoRef.current = video;
            return imageData;
          }
        }

        for (const canvas of collectCanvasCandidates()) {
          const imageData = canvasToDataUrl(canvas);
          if (imageData) return imageData;
        }

        await wait(intervalMs);
      }

      const videos = collectVideoCandidates();
      console.warn('Screenshot capture timed out', {
        videoCount: videos.length,
        videos: videos.map(describeMedia),
        canvases: collectCanvasCandidates().map(describeMedia),
        best: describeMedia(videos[0]),
      });

      return null;
    },
  }), [videoIdA, videoIdB]);

  useEffect(() => {
    let cancelled = false;

    const resolvedGroupId = groupId
      || import.meta.env.VITE_NANOPLAYER_GROUP_ID
      || DEFAULT_GROUP_ID;

    const syncActiveVideo = (explicitVideo) => {
      if (explicitVideo) {
        activeVideoRef.current = explicitVideo;
        return;
      }
      activeVideoRef.current = pickBestVideo();
    };

    const initPlayer = async () => {
      try {
        await loadNanoPlayerScript();
        if (cancelled || !containerRef.current || !window.NanoPlayer) return;

        if (playerRef.current) {
          try {
            playerRef.current.destroy();
          } catch {
            // ignore destroy errors on re-init
          }
          playerRef.current = null;
        }

        activeVideoRef.current = null;

        const config = {
          source: {
            group: {
              id: resolvedGroupId,
            },
          },
          playback: {
            autoplay: true,
            automute: true,
            muted: true,
            faststart: true,
            videoId: [videoIdA, videoIdB],
          },
          style: {
            controls: !hideControls,
            fullScreenControl: !hideControls,
            interactive: !hideControls,
            centerView: false,
            displayMutedAutoplay: false,
            scaling,
          },
          events: {
            onActiveVideoElementChange: (event) => {
              syncActiveVideo(event?.data?.activeVideoElement || null);
            },
            onPlay: () => {
              syncActiveVideo();
            },
            onLoaded: () => {
              syncActiveVideo();
            },
            onMetaData: () => {
              syncActiveVideo();
            },
            onError: (event) => {
              console.error('NanoPlayer error:', event?.data);
            },
          },
        };

        const player = new window.NanoPlayer(containerId);
        playerRef.current = player;
        await player.setup(config);
        if (!cancelled) {
          syncActiveVideo();
        }
      } catch (error) {
        console.error('NanoPlayer setup failed:', error);
      }
    };

    initPlayer();

    return () => {
      cancelled = true;
      activeVideoRef.current = null;
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore
        }
        playerRef.current = null;
      }
    };
  }, [containerId, groupId, hideControls, scaling, videoIdA, videoIdB]);

  return (
    <div
      ref={rootRef}
      className={`relative w-full h-full overflow-hidden bg-black ${classNames}`}
      title={title}
    >
      <div
        id={containerId}
        ref={containerRef}
        className={`h-full w-full${hideControls ? ' pointer-events-none' : ''}`}
      >
        <video id={videoIdA} playsInline muted autoPlay className="h-full w-full object-contain" />
        <video id={videoIdB} playsInline muted autoPlay className="h-full w-full object-contain" />
      </div>
    </div>
  );
});

NanoPlayerEmbed.displayName = 'NanoPlayerEmbed';

export default NanoPlayerEmbed;
