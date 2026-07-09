import React, { useMemo } from 'react';

const NANOPLAYER_EMBED_BASE = 'https://demo.nanocosmos.de/nanoplayer/embed/2.0.0/nanoplayer.html';
const DEFAULT_GROUP_ID = 'a40b45f5-c759-49d1-8b2d-369d81420140';

const NanoPlayerEmbed = ({
    groupId,
    classNames = '',
    title = 'Live stream',
    hideControls = false,
    scaling = 'letterbox',
}) => {
    const embedUrl = useMemo(() => {
        const resolvedGroupId = groupId
            || import.meta.env.VITE_NANOPLAYER_GROUP_ID
            || DEFAULT_GROUP_ID;

        const params = new URLSearchParams({ 'group.id': resolvedGroupId });

        if (hideControls) {
            params.set('style.controls', 'false');
            params.set('style.fullScreenControl', 'false');
            params.set('style.interactive', 'false');
            params.set('style.centerView', 'false');
            params.set('style.displayMutedAutoplay', 'false');
        }

        if (scaling && scaling !== 'letterbox') {
            params.set('style.scaling', scaling);
        }

        return `${NANOPLAYER_EMBED_BASE}?${params.toString()}`;
    }, [groupId, hideControls, scaling]);

    return (
        <div className={`relative w-full h-full overflow-hidden ${classNames}`}>
            <iframe
                src={embedUrl}
                title={title}
                className={`h-full w-full border-0 bg-black${hideControls ? ' pointer-events-none' : ''}`}
                allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                allowFullScreen
            />
        </div>
    );
};

export default NanoPlayerEmbed;
