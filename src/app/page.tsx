// src/app/page.tsx
'use client';

import React, { useState, useMemo, FormEvent, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";
import { Loader2, Download, Image as ImageIcon, Video as VideoIcon, Filter, X, Link } from "lucide-react";
import NextImage from 'next/image'; // Renamed import to avoid conflict with Lucide icon

// Type matching the API response
import type { MediaItem } from './api/scrape/route';

// Function to trigger download
const triggerDownload = (mediaItem: MediaItem) => {
    const downloadUrl = `/api/download?url=${encodeURIComponent(mediaItem.src)}&filename=${encodeURIComponent(mediaItem.filename || 'download')}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', mediaItem.filename || 'download');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// --- Pagination Configuration ---
const ITEMS_PER_PAGE = 20;

// --- Interface for Image Details ---
interface ImageDimensions {
    width: number;
    height: number;
}

export default function HomePage() {
    // --- State Variables ---
    const [url, setUrl] = useState<string>('');
    const [allMedia, setAllMedia] = useState<MediaItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [imageDetails, setImageDetails] = useState<Record<string, ImageDimensions>>({});
    const [showFilters, setShowFilters] = useState<boolean>(false);
    const [selectedTypes, setSelectedTypes] = useState<Record<'image' | 'video', boolean>>({ image: true, video: true });
    const [availableExtensions, setAvailableExtensions] = useState<string[]>([]);
    const [selectedExtensions, setSelectedExtensions] = useState<string[]>([]);
    const [downloadingCount, setDownloadingCount] = useState<number>(0);
    const [currentPage, setCurrentPage] = useState<number>(1);

    // --- Derived State: Filtered Media ---
    const filteredMedia = useMemo(() => {
        return allMedia.filter(item => {
            if (!selectedTypes[item.type]) return false;
            if (selectedExtensions.length > 0 && !selectedExtensions.includes(item.extension || '')) return false;
            return true;
        });
    }, [allMedia, selectedTypes, selectedExtensions]);

    // --- Effect to Reset Page on Filter Change ---
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedTypes, selectedExtensions]);

    // --- Effect to Clear Details on New Scrape ---
    useEffect(() => {
        if (isLoading) {
            setImageDetails({});
        }
    }, [isLoading]);

    // --- Derived State: Pagination Calculation ---
    const totalPages = useMemo(() => {
        return Math.ceil(filteredMedia.length / ITEMS_PER_PAGE);
    }, [filteredMedia.length]);

    const paginatedMedia = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        return filteredMedia.slice(startIndex, endIndex);
    }, [filteredMedia, currentPage]);

    // --- Event Handlers ---
    const handleScrape = async (event?: FormEvent<HTMLFormElement>) => {
        event?.preventDefault();
        if (!url || isLoading) return;
        setIsLoading(true);
        setError(null);
        setAllMedia([]);
        setAvailableExtensions([]);
        setSelectedExtensions([]);
        setShowFilters(false);
        setCurrentPage(1);
        setImageDetails({}); // Clear dimensions cache
        try {
            const response = await fetch('/api/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || `API Error: ${response.statusText}`);
            if (result.data && Array.isArray(result.data)) {
                const mediaData = result.data as MediaItem[];
                setAllMedia(mediaData);
                const extensions = [...new Set(mediaData.map(item => item.extension).filter(Boolean))] as string[];
                setAvailableExtensions(extensions.sort());
                setSelectedExtensions([]);
                toast.success("Extracting successful!", { description: `Found ${mediaData.length} media items.` });
                if (mediaData.length > 0) setShowFilters(true);
            } else {
                setAllMedia([]);
                toast.info("No Media Found", { description: "The scraper didn't find any images or videos." });
            }
        } catch (err: any) {
            console.error("Extracting failed:", err);
            const errorMessage = err.message || 'An unexpected error occurred.';
            setError(errorMessage);
            toast.error("Extracting Error", { description: errorMessage });
        } finally {
            setIsLoading(false);
        }
    };

    // Filter handlers
    const handleTypeToggle = (type: 'image' | 'video') => setSelectedTypes(prev => ({ ...prev, [type]: !prev[type] }));
    const handleExtensionToggle = (extension: string) => setSelectedExtensions(prev => prev.includes(extension) ? prev.filter(ext => ext !== extension) : [...prev, extension]);
    const handleSelectAllExtensions = () => setSelectedExtensions(availableExtensions);
    const handleDeselectAllExtensions = () => setSelectedExtensions([]);

    // Download handlers
    const handleDownloadSingle = (item: MediaItem) => {
        setDownloadingCount(prev => prev + 1);
        try {
            triggerDownload(item);
            toast.info("Download Started", { description: item.filename || item.src });
        } catch (err) {
            console.error("Download trigger failed:", err);
            toast.error("Download Error", { description: "Could not start download." });
        } finally {
            setTimeout(() => setDownloadingCount(prev => Math.max(0, prev - 1)), 2000);
        }
    };
    const handleDownloadSelected = async () => {
        if (filteredMedia.length === 0) {
            toast.warning("Nothing to Download", { description: "No media items match the current filters." });
            return;
        }
        setDownloadingCount(filteredMedia.length);
        toast.info(`Starting ${filteredMedia.length} Downloads...`, { description: "Your browser may ask for confirmation." });
        for (const item of filteredMedia) {
            try {
                triggerDownload(item);
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (err) {
                console.error(`Failed to trigger download for ${item.src}`, err);
                toast.error("Download Error", { description: `Could not start download for ${item.filename || 'file'}.` });
                setDownloadingCount(prev => Math.max(0, prev - 1));
            }
        }
        setTimeout(() => setDownloadingCount(0), filteredMedia.length * 250 + 2000);
    };

    // Pagination Handlers
    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };
    const handlePreviousPage = () => handlePageChange(currentPage - 1);
    const handleNextPage = () => handlePageChange(currentPage + 1);
    const getPageNumbers = () => {
        const pageNumbers: (number | string)[] = [];
        const maxPagesToShow = 5;
        const halfMaxPages = Math.floor(maxPagesToShow / 2);
        if (totalPages <= maxPagesToShow + 2) {
            for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
        } else {
            pageNumbers.push(1);
            let startPage = Math.max(2, currentPage - halfMaxPages);
            let endPage = Math.min(totalPages - 1, currentPage + halfMaxPages);
            if (currentPage - halfMaxPages <= 2) endPage = startPage + maxPagesToShow - 1;
            if (currentPage + halfMaxPages >= totalPages - 1) startPage = endPage - maxPagesToShow + 1;
            if (startPage > 2) pageNumbers.push('...');
            for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);
            if (endPage < totalPages - 1) pageNumbers.push('...');
            pageNumbers.push(totalPages);
        }
        return pageNumbers;
    };

    // Helper to get image details
    const getImageDetail = (src: string): ImageDimensions | undefined => imageDetails[src];

    // --- Render ---
    return (
        <div className="container mx-auto p-4 md:p-8">
            {/* Use transparent card as main container for padding/max-width control */}
            <Card className="max-w-4xl mx-auto border-none shadow-none bg-transparent dark:bg-transparent">
                <CardHeader className="pt-0 pb-4 md:pt-2 md:pb-6">
                    <CardTitle className="text-center text-2xl md:text-3xl font-bold text-foreground">
                        Media Extractor
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0 md:p-4">
                    {/* URL Input Form in its own card */}
                    <Card className="mb-6 bg-muted/30 dark:bg-gray-800/30 shadow-sm">
                        <CardContent className="p-4 md:p-6">
                           <form onSubmit={handleScrape} className="space-y-4">
                                <div className="space-y-1">
                                    <Label htmlFor="urlInput" className="font-medium">Website URL</Label>
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <Input
                                            id="urlInput"
                                            type="text"
                                            value={url}
                                            onChange={(e) => setUrl(e.target.value)}
                                            placeholder="e.g., example.com or https://example.com"
                                            required
                                            disabled={isLoading}
                                            className="flex-grow dark:bg-gray-700 dark:border-gray-600 focus-visible:ring-primary/50"
                                        />
                                        <Button type="submit" disabled={isLoading || !url} className="w-full sm:w-auto">
                                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            {isLoading ? 'Extracting...' : 'Extract Media'}
                                        </Button>
                                    </div>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    {/* Error Display */}
                    {error && (
                        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 text-destructive rounded-md dark:bg-red-900/30 dark:border-red-700/50 dark:text-red-300">
                            <p className="font-semibold">Error:</p>
                            <p>{error}</p>
                        </div>
                    )}

                    {/* Filters Section in its own card */}
                    {allMedia.length > 0 && (
                        <Card className="mb-6 bg-muted/30 dark:bg-gray-800/30 shadow-sm">
                            <CardHeader className="pb-2 pt-4">
                                <CardTitle className="text-lg flex justify-between items-center font-semibold">
                                    Filters
                                    <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)}>
                                        {showFilters ? <X className="h-4 w-4" /> : <Filter className="h-4 w-4" />}
                                    </Button>
                                </CardTitle>
                            </CardHeader>
                            {showFilters && (
                                <CardContent className="space-y-4 pt-2 pb-4">
                                    {/* Type Filters */}
                                    <div>
                                        <Label className="font-medium block mb-2">Media Type</Label>
                                        <div className="flex gap-4">
                                            <div className="flex items-center space-x-2">
                                                <Checkbox id="type-image" checked={selectedTypes.image} onCheckedChange={() => handleTypeToggle('image')} />
                                                <Label htmlFor="type-image" className="cursor-pointer font-normal">Images</Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <Checkbox id="type-video" checked={selectedTypes.video} onCheckedChange={() => handleTypeToggle('video')} />
                                                <Label htmlFor="type-video" className="cursor-pointer font-normal">Videos</Label>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Extension Filters */}
                                    {availableExtensions.length > 0 && (
                                        <div>
                                            <Label className="font-medium block mb-2">File Extension</Label>
                                            <div className="flex gap-2 mb-2 flex-wrap">
                                                <Button variant="outline" size="sm" onClick={handleSelectAllExtensions}>Select All ({availableExtensions.length})</Button>
                                                <Button variant="outline" size="sm" onClick={handleDeselectAllExtensions} disabled={selectedExtensions.length === 0}>Deselect All</Button>
                                            </div>
                                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-x-4 gap-y-2 max-h-36 overflow-y-auto p-2 border rounded-md dark:border-gray-700">
                                                {availableExtensions.map(ext => (
                                                    <div key={ext} className="flex items-center space-x-2">
                                                        <Checkbox id={`ext-${ext}`} checked={selectedExtensions.includes(ext)} onCheckedChange={() => handleExtensionToggle(ext)} />
                                                        <Label htmlFor={`ext-${ext}`} className="text-sm cursor-pointer font-normal">{ext}</Label>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            )}
                        </Card>
                    )}

                    {/* Download All Button */}
                    {filteredMedia.length > 0 && (
                        <div className="mb-4 flex flex-col sm:flex-row justify-center items-center gap-4">
                            <Button onClick={handleDownloadSelected} disabled={downloadingCount > 0} className="w-full sm:w-auto shadow-sm">
                                {downloadingCount > 0 ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                {downloadingCount > 0 ? `Downloading (${downloadingCount})...` : `Download ${filteredMedia.length} Filtered Item${filteredMedia.length === 1 ? '' : 's'}`}
                            </Button>
                            {downloadingCount > 0 && <p className="text-sm text-muted-foreground animate-pulse">Download in progress...</p>}
                        </div>
                    )}

                    {/* Results Section */}
                    {allMedia.length > 0 && (
                        <div>
                            {/* Result Count Info */}
                            <p className="text-sm text-muted-foreground mb-4 text-center">
                                Showing {paginatedMedia.length} of {filteredMedia.length} item{filteredMedia.length === 1 ? '' : 's'} on Page {currentPage} of {totalPages}
                                {filteredMedia.length !== allMedia.length ? ' (Filters Applied)' : ''}
                            </p>

                            {/* Results Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                                {paginatedMedia.map((item, index) => {
                                    const dimensions = getImageDetail(item.src);
                                    return (
                                        <Card
                                            key={item.src + index}
                                            // Removed flex flex-col, use relative parent for absolute children
                                            className="overflow-hidden group h-72 relative rounded-lg border border-transparent hover:border-muted-foreground/30 hover:shadow-lg transition-all duration-300 ease-in-out bg-muted/40 dark:bg-gray-800/40"
                                        >
                                            {/* Media Display Area - Absolute Positioned to Fill Card */}
                                            <div className="absolute inset-0 overflow-hidden bg-gray-200 dark:bg-gray-700"> {/* Background color for fallback */}
                                                {item.type === 'image' ? (
                                                    <NextImage
                                                        src={item.src}
                                                        alt={item.alt || `Scraped Image ${index + 1}`}
                                                        fill
                                                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                                                        // object-cover is crucial here to make fill work as expected
                                                        className="object-cover w-full h-full transition-all duration-300 ease-in-out group-hover:opacity-80 group-hover:scale-105"
                                                        unoptimized={item.src.endsWith('.svg')}
                                                        onLoadingComplete={(img) => { if (!imageDetails[item.src]) setImageDetails(prev => ({ ...prev, [item.src]: { width: img.naturalWidth, height: img.naturalHeight } })); }}
                                                        onError={(e) => { console.warn(`Failed to load image: ${item.src}`); (e.target as HTMLImageElement).style.opacity = '0'; /* Hide broken image */ }}
                                                    />
                                                ) : item.poster ? (
                                                    <NextImage
                                                        src={item.poster}
                                                        alt={item.alt || `Video Poster: ${item.filename || 'Video'}`}
                                                        fill
                                                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                                                        className="object-cover w-full h-full transition-all duration-300 ease-in-out group-hover:opacity-80 group-hover:scale-105"
                                                        unoptimized={item.poster.endsWith('.svg')}
                                                        onLoadingComplete={(img) => { if (!imageDetails[item.src]) setImageDetails(prev => ({ ...prev, [item.src]: { width: img.naturalWidth, height: img.naturalHeight } })); }}
                                                        onError={(e) => { console.warn(`Failed to load poster: ${item.poster}`); (e.target as HTMLImageElement).style.opacity = '0'; }}
                                                    />
                                                ) : ( // Video without poster - Placeholder fills the space
                                                    <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground p-2">
                                                        <VideoIcon className="w-1/2 h-1/2 mb-1 opacity-50 flex-shrink-0" />
                                                        <span className="text-xs text-center break-words">Video Preview Unavailable</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* --- Info Footer (Mobile Only - Absolute Positioned) --- */}
                                            {/* Sits on top of the image at the bottom */}
                                            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 via-black/60 to-transparent text-white text-xs flex sm:hidden items-center justify-between gap-2 z-10">
                                                <span className="truncate font-medium" title={item.filename || item.src}>
                                                    {item.filename || '...'} {/* Show ellipsis if no filename */}
                                                </span>
                                                <div className='flex items-center gap-2 text-gray-300 flex-shrink-0'>
                                                    {item.extension && (
                                                        <span className="border border-gray-500 px-1 rounded-sm bg-black/30 text-[10px] leading-tight">
                                                            {item.extension.toUpperCase()}
                                                        </span>
                                                    )}
                                                    {(item.type === 'image' || item.poster) && dimensions && (
                                                        <span className='whitespace-nowrap text-[10px]'>
                                                            {`${dimensions.width}x${dimensions.height}`}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* --- Hover Overlay (Desktop Only - Absolute Positioned) --- */}
                                            {/* Covers the whole card, sits above the image but below mobile buttons */}
                                            <div className="absolute inset-0 hidden sm:flex flex-col justify-between p-3 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-20">
                                                {/* Buttons at top */}
                                                <div className="flex justify-end items-center gap-1 pointer-events-auto">
                                                    <Button variant="secondary" size="icon" className="h-8 w-8 bg-white/20 hover:bg-white/40 border-none" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(item.src).then(() => toast.success("Link copied!")).catch(err => toast.error("Failed to copy link.")); }} title="Copy media link">
                                                        <Link className="h-4 w-4 text-white" />
                                                    </Button>
                                                    <Button variant="secondary" size="icon" className="h-8 w-8 bg-white/20 hover:bg-white/40 border-none" onClick={(e) => { e.stopPropagation(); handleDownloadSingle(item); }} title="Download this item">
                                                        <Download className="h-4 w-4 text-white" />
                                                    </Button>
                                                </div>
                                                {/* Info at bottom */}
                                                <div className="text-white text-xs flex items-center justify-between gap-2 pointer-events-auto">
                                                    <span className="truncate font-medium" title={item.filename || item.src}>
                                                        {item.filename || 'Unknown Filename'}
                                                    </span>
                                                    <div className='flex items-center gap-2 text-gray-300 flex-shrink-0'>
                                                        {item.extension && (
                                                            <span className="border border-gray-500 px-1 rounded-sm bg-black/30 text-[10px] leading-tight">
                                                                {item.extension.toUpperCase()}
                                                            </span>
                                                        )}
                                                        {(item.type === 'image' || item.poster) && dimensions && (
                                                            <span className='whitespace-nowrap text-[10px]'>
                                                                {`${dimensions.width}x${dimensions.height}`}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* --- Button Group (Mobile Only - Top Right - Absolute Positioned) --- */}
                                            {/* Sits on top of everything */}
                                            <div className="absolute top-2 right-2 z-30 block sm:hidden flex items-center gap-1">
                                                <Button variant="secondary" size="icon" className="h-8 w-8 bg-black/40 hover:bg-black/70 text-white backdrop-blur-sm border-none flex items-center justify-center p-0" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(item.src).then(() => toast.success("Link copied!")).catch(err => toast.error("Failed to copy.")); }} title="Copy media link">
                                                    <Link className="h-4 w-4" />
                                                </Button>
                                                <Button variant="secondary" size="icon" className="h-8 w-8 bg-black/40 hover:bg-black/70 text-white backdrop-blur-sm border-none flex items-center justify-center p-0" onClick={(e) => { e.stopPropagation(); handleDownloadSingle(item); }} title="Download this item">
                                                    <Download className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </Card>
                                    );
                                })}
                            </div>

                            {/* Pagination Controls */}
                            {totalPages > 1 && (
                                <Pagination>
                                    <PaginationContent>
                                        <PaginationItem>
                                            <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); handlePreviousPage(); }} aria-disabled={currentPage === 1} className={currentPage === 1 ? "pointer-events-none opacity-50" : ""} />
                                        </PaginationItem>
                                        {getPageNumbers().map((page, index) => (
                                            <PaginationItem key={index}>
                                                {typeof page === 'number' ? (
                                                    <PaginationLink href="#" onClick={(e) => { e.preventDefault(); handlePageChange(page); }} isActive={currentPage === page} aria-current={currentPage === page ? "page" : undefined}>
                                                        {page}
                                                    </PaginationLink>
                                                ) : (
                                                    <PaginationEllipsis />
                                                )}
                                            </PaginationItem>
                                        ))}
                                        <PaginationItem>
                                            <PaginationNext href="#" onClick={(e) => { e.preventDefault(); handleNextPage(); }} aria-disabled={currentPage === totalPages} className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""} />
                                        </PaginationItem>
                                    </PaginationContent>
                                </Pagination>
                            )}
                        </div>
                    )}

                    {/* Loading/No Results States */}
                    {isLoading && (
                        <div className="text-center text-muted-foreground mt-8 flex justify-center items-center gap-2">
                            <Loader2 className="h-5 w-5 animate-spin" /> Fetching data...
                        </div>
                    )}
                    {!isLoading && !error && allMedia.length === 0 && url && ( // Show only after an attempt
                        <div className="text-center text-muted-foreground mt-8">
                            No media found matching the criteria on the specified page, or the attempt failed.
                        </div>
                    )}
                     {!isLoading && !error && allMedia.length > 0 && filteredMedia.length === 0 && ( // Show when filters result in no items
                        <div className="text-center text-muted-foreground mt-8">
                            No media items match your current filter selection.
                        </div>
                    )}

                </CardContent>

                {/* Footer */}
                 <CardFooter className="text-center text-xs text-muted-foreground justify-center pt-6 pb-4 border-t dark:border-gray-700/50 mt-8"> {/* Added top border */}
                    Scrape and download responsibly. Respect copyright and website terms of service.
                </CardFooter>
            </Card>
        </div>
    );
}