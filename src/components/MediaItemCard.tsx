import React from 'react';
import NextImage from 'next/image';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Link as LinkIcon, Video as VideoIcon } from "lucide-react"; // Renamed Link import
import type { MediaItem } from '@/app/api/scrape/route'; // Adjust path if needed
import type { ImageDimensions } from '@/lib/utils'; // Adjust path
import { copyToClipboard } from '@/lib/utils'; // Adjust path

interface MediaItemCardProps {
    item: MediaItem;
    dimensions?: ImageDimensions;
    onDownload: (item: MediaItem) => void;
    onImageLoadComplete: (src: string, dimensions: ImageDimensions) => void;
    onCopyLink: (src: string) => void; // Use shared copy function
}

export function MediaItemCard({
                                  item,
                                  dimensions,
                                  onDownload,
                                  onImageLoadComplete,
                                  onCopyLink
                              }: MediaItemCardProps) {

    const handleImageLoad = (img: HTMLImageElement) => {
        // Only update if dimensions aren't already set for this src
        if (!dimensions && img.naturalWidth > 0 && img.naturalHeight > 0) {
            onImageLoadComplete(item.src, { width: img.naturalWidth, height: img.naturalHeight });
        }
    };

    const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
        console.warn(`Failed to load image: ${item.src}`);
        (e.target as HTMLImageElement).style.opacity = '0'; // Hide broken image placeholder
        // Optionally set dimensions to 0x0 or handle error state
        // onImageLoadComplete(item.src, { width: 0, height: 0 });
    };

    const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
        console.warn(`Failed to load video preview: ${item.src}`, e);
        // Optionally trigger placeholder display state here
    };

    const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
        // Prevent card click from triggering actions if a button inside was clicked
        if ((e.target as HTMLElement).closest('button')) {
            e.stopPropagation();
        } else {
            // Optional: Add action for clicking the card itself, e.g., open in modal
            console.log("Card clicked:", item.src);
        }
    };

    const fileNameDisplay = item.filename || '...';
    const fileTitle = item.filename || item.src;

    return (
        <Card
            // Removed flex flex-col, use relative parent for absolute children
            className="overflow-hidden group h-72 relative rounded-lg border border-transparent hover:border-muted-foreground/30 hover:shadow-lg transition-all duration-300 ease-in-out bg-muted/40 dark:bg-gray-800/40"
            onClick={handleCardClick} // Handle clicks on the card
        >
            {/* Media Display Area */}
            <div className="absolute inset-0 overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center"> {/* Ensure centering for fallback */}
                {item.type === 'image' ? (
                    <NextImage
                        src={item.src}
                        alt={item.alt || `Scraped Image: ${fileNameDisplay}`}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        className="object-cover w-full h-full transition-all duration-300 ease-in-out group-hover:opacity-80 group-hover:scale-105"
                        unoptimized={item.src.endsWith('.svg')}
                        onLoadingComplete={handleImageLoad}
                        onError={handleImageError}
                        loading="lazy" // Add lazy loading
                    />
                ) : ( // Video or other types
                    <video
                        src={item.src}
                        className="object-cover w-full h-full"
                        preload="metadata" // Load only metadata initially
                        muted
                        controls={false} // No native controls shown by default
                        title={fileTitle}
                        onError={handleVideoError}
                    >
                        {/* Fallback content if video fails or cannot render */}
                        <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground p-2">
                            <VideoIcon className="w-1/2 h-1/2 mb-1 opacity-50 flex-shrink-0" />
                            <span className="text-xs text-center break-words">Video Preview Unavailable</span>
                        </div>
                    </video>
                )}
            </div>

            {/* Info Footer (Mobile Only - Absolute Positioned) */}
            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 via-black/60 to-transparent text-white text-xs flex sm:hidden items-center justify-between gap-2 z-10 pointer-events-none">
                <span className="truncate font-medium" title={fileTitle}>
                    {fileNameDisplay}
                </span>
                <div className='flex items-center gap-2 text-gray-300 flex-shrink-0'>
                    {item.extension && (
                        <span className="border border-gray-500 px-1 rounded-sm bg-black/30 text-[10px] leading-tight">
                            {item.extension.toUpperCase()}
                        </span>
                    )}
                    {dimensions && (
                        <span className='whitespace-nowrap text-[10px]'>
                            {`${dimensions.width}x${dimensions.height}`}
                        </span>
                    )}
                </div>
            </div>

            {/* Hover Overlay (Desktop Only - Absolute Positioned) */}
            <div className="absolute inset-0 hidden sm:flex flex-col justify-between p-3 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-20">
                {/* Buttons at top */}
                <div className="flex justify-end items-center gap-1 pointer-events-auto">
                    <Button variant="secondary" size="icon" className="h-8 w-8 bg-white/20 hover:bg-white/40 border-none" onClick={(e) => { e.stopPropagation(); onCopyLink(item.src); }} title="Copy media link">
                        <LinkIcon className="h-4 w-4 text-white" />
                    </Button>
                    <Button variant="secondary" size="icon" className="h-8 w-8 bg-white/20 hover:bg-white/40 border-none" onClick={(e) => { e.stopPropagation(); onDownload(item); }} title="Download this item">
                        <Download className="h-4 w-4 text-white" />
                    </Button>
                </div>
                {/* Info at bottom */}
                <div className="text-white text-xs flex items-center justify-between gap-2 pointer-events-auto">
                    <span className="truncate font-medium" title={fileTitle}>
                        {fileNameDisplay}
                    </span>
                    <div className='flex items-center gap-2 text-gray-300 flex-shrink-0'>
                        {item.extension && (
                            <span className="border border-gray-500 px-1 rounded-sm bg-black/30 text-[10px] leading-tight">
                                {item.extension.toUpperCase()}
                            </span>
                        )}
                        {dimensions && (
                            <span className='whitespace-nowrap text-[10px]'>
                                {`${dimensions.width}x${dimensions.height}`}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Button Group (Mobile Only - Top Right - Absolute Positioned) */}
            <div className="absolute top-2 right-2 z-30 block sm:hidden flex items-center gap-1">
                <Button variant="secondary" size="icon" className="h-8 w-8 bg-black/40 hover:bg-black/70 text-white backdrop-blur-sm border-none flex items-center justify-center p-0" onClick={(e) => { e.stopPropagation(); onCopyLink(item.src); }} title="Copy media link">
                    <LinkIcon className="h-4 w-4" />
                </Button>
                <Button variant="secondary" size="icon" className="h-8 w-8 bg-black/40 hover:bg-black/70 text-white backdrop-blur-sm border-none flex items-center justify-center p-0" onClick={(e) => { e.stopPropagation(); onDownload(item); }} title="Download this item">
                    <Download className="h-4 w-4" />
                </Button>
            </div>
        </Card>
    );
}