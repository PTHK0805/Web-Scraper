// src/components/MediaItemCard.tsx
import React from 'react';
import NextImage from 'next/image';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { Download, Link as LinkIcon, Video as VideoIcon } from "lucide-react";
import type { MediaItem } from '@/app/api/scrape/route';
import type { ImageDimensions } from '@/lib/utils';
import { copyToClipboard, formatBytes } from '@/lib/utils';

interface MediaItemCardProps {
    item: MediaItem;
    dimensions?: ImageDimensions;
    onDownload: (item: MediaItem) => void;
    onImageLoadComplete: (src: string, dimensions: ImageDimensions) => void;
    onCopyLink: (src: string) => void;
}

export function MediaItemCard({
                                  item,
                                  dimensions,
                                  onDownload,
                                  onImageLoadComplete,
                                  onCopyLink
                              }: MediaItemCardProps) {
    const [isImageLoading, setIsImageLoading] = React.useState(true);

    const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.currentTarget;
        setIsImageLoading(false);

        if (!dimensions && img.naturalWidth > 0 && img.naturalHeight > 0) {
            onImageLoadComplete(item.src, {
                width: img.naturalWidth,
                height: img.naturalHeight,
            });
        }
    };

    const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
        console.warn(`Failed to load image: ${item.src}`);
        const target = e.target as HTMLImageElement;
        target.style.opacity = '0';
        target.style.display = 'none';
    };

    const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
        console.warn(`Failed to load video preview: ${item.src}`, e);
    };

    const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('button')) {
            e.stopPropagation();
        } else {
            window.open(item.src, '_blank', 'noopener,noreferrer');
        }
    };

    const fileNameDisplay = item.filename || 'Media File';
    const fileTitle = item.filename || item.src;
    const formattedSize = formatBytes(item.fileSize);

    return (
        <Card
            className="overflow-hidden group h-72 relative rounded-lg border border-transparent hover:border-muted-foreground/30 hover:shadow-lg transition-all duration-300 ease-in-out bg-muted/40 dark:bg-gray-800/40 cursor-pointer"
            onClick={handleCardClick}
        >
            {/* Media Display Area */}
            <div className="absolute inset-0 overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-500">
                {item.type === 'image' ? (
                    <>
                        {isImageLoading && (
                            <Skeleton className="absolute inset-0 w-full h-full rounded-none" />
                        )}
                        <NextImage
                            src={item.src}
                            alt={item.alt || `Scraped Image: ${fileNameDisplay}`}
                            fill
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                            className="object-cover w-full h-full transition-all duration-300 ease-in-out group-hover:opacity-80 group-hover:scale-105"
                            unoptimized={item.src.endsWith('.svg') || item.src.endsWith('.gif')}
                            onLoad={handleImageLoad}
                            onError={handleImageError}
                            loading="lazy"
                            quality={75}
                        />
                    </>
                ) : (
                    <video
                        src={item.src}
                        poster={item.poster}
                        className="object-cover w-full h-full"
                        preload="metadata"
                        muted
                        loop
                        playsInline
                        controls={false}
                        title={fileTitle}
                        onError={handleVideoError}
                    >
                        <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground p-2 bg-gray-200 dark:bg-gray-700">
                            <VideoIcon className="w-1/2 h-1/2 mb-1 opacity-50 flex-shrink-0" />
                            <span className="text-xs text-center break-words">Video Preview Unavailable</span>
                        </div>
                    </video>
                )}
            </div>

            {/* Mobile Footer Info */}
            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 via-black/60 to-transparent text-white text-xs flex sm:hidden items-end justify-between gap-1.5 z-10 pointer-events-none">
                <span className="truncate font-medium flex-1 min-w-0" title={fileTitle}>
                    {fileNameDisplay}
                </span>
                <div className='flex items-center gap-1.5 text-gray-300 flex-shrink-0'>
                    {item.extension && (
                        <span className="border border-gray-500 px-1 rounded-sm bg-black/30 text-[10px] leading-tight">
                            {item.extension.toUpperCase()}
                        </span>
                    )}
                    {formattedSize && (
                        <span className='whitespace-nowrap text-[10px]'>{formattedSize}</span>
                    )}
                    {dimensions && (
                        <span className='whitespace-nowrap text-[10px]'>
                            {`${dimensions.width}x${dimensions.height}`}
                        </span>
                    )}
                </div>
            </div>

            {/* Desktop Hover Overlay */}
            <div className="absolute inset-0 hidden sm:flex flex-col justify-between p-3 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-20">
                <div className="flex justify-end items-center gap-1 pointer-events-auto">
                    <Button variant="secondary" size="icon" className="h-8 w-8 bg-white/20 hover:bg-white/40 border-none" onClick={(e) => { e.stopPropagation(); onCopyLink(item.src); }} title="Copy media link">
                        <LinkIcon className="h-4 w-4 text-white" />
                    </Button>
                    <Button variant="secondary" size="icon" className="h-8 w-8 bg-white/20 hover:bg-white/40 border-none" onClick={(e) => { e.stopPropagation(); onDownload(item); }} title="Download this item">
                        <Download className="h-4 w-4 text-white" />
                    </Button>
                </div>
                <div className="text-white text-xs flex items-end justify-between gap-1.5 pointer-events-auto">
                    <span className="truncate font-medium flex-1 min-w-0" title={fileTitle}>
                        {fileNameDisplay}
                    </span>
                    <div className='flex items-center gap-1.5 text-gray-300 flex-shrink-0'>
                        {item.extension && (
                            <span className="border border-gray-500 px-1 rounded-sm bg-black/30 text-[10px] leading-tight">
                                {item.extension.toUpperCase()}
                            </span>
                        )}
                        {formattedSize && (
                            <span className='whitespace-nowrap text-[10px]'>{formattedSize}</span>
                        )}
                        {dimensions && (
                            <span className='whitespace-nowrap text-[10px]'>
                                {`${dimensions.width}x${dimensions.height}`}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile Button Group */}
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
