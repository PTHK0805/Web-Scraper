import React from 'react';
import { MediaItemCard } from './MediaItemCard'; // Adjust path
import type { MediaItem } from '@/app/api/scrape/route'; // Adjust path
import type { ImageDimensions } from '@/lib/utils'; // Adjust path

interface MediaGridProps {
    mediaItems: MediaItem[];
    imageDetails: Record<string, ImageDimensions>;
    onDownload: (item: MediaItem) => void;
    onImageLoadComplete: (src: string, dimensions: ImageDimensions) => void;
    onCopyLink: (src: string) => void;
}

export function MediaGrid({
                              mediaItems,
                              imageDetails,
                              onDownload,
                              onImageLoadComplete,
                              onCopyLink
                          }: MediaGridProps) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {mediaItems.map((item, index) => (
                <MediaItemCard
                    key={item.src + index} // Consider a more stable key if possible
                    item={item}
                    dimensions={imageDetails[item.src]}
                    onDownload={onDownload}
                    onImageLoadComplete={onImageLoadComplete}
                    onCopyLink={onCopyLink}
                />
            ))}
        </div>
    );
}