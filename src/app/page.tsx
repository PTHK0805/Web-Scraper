// src/app/page.tsx
'use client';

import React, { useState, useMemo, FormEvent, useEffect } from 'react'; // Added useEffect
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
} from "@/components/ui/pagination"; // Import Pagination components
import { Loader2, Download, Image as ImageIcon, Video as VideoIcon, Filter, X, Link } from "lucide-react";

// Type matching the API response
import type { MediaItem } from './api/scrape/route';

// Function to trigger download (remains the same)
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
const ITEMS_PER_PAGE = 20; // Number of media items to show per page

export default function HomePage() {
    // --- State Variables ---
    const [url, setUrl] = useState<string>('');
    const [allMedia, setAllMedia] = useState<MediaItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // --- Filtering State ---
    const [showFilters, setShowFilters] = useState<boolean>(false);
    const [selectedTypes, setSelectedTypes] = useState<Record<'image' | 'video', boolean>>({ image: true, video: true });
    const [availableExtensions, setAvailableExtensions] = useState<string[]>([]);
    const [selectedExtensions, setSelectedExtensions] = useState<string[]>([]);

    // --- Download State ---
    const [downloadingCount, setDownloadingCount] = useState<number>(0);

    // --- Pagination State ---
    const [currentPage, setCurrentPage] = useState<number>(1); // State for current page number

    // --- Derived State: Filtered Media ---
    const filteredMedia = useMemo(() => {
        return allMedia.filter(item => {
            if (!selectedTypes[item.type]) return false;
            if (selectedExtensions.length > 0 && !selectedExtensions.includes(item.extension || '')) return false;
            return true;
        });
    }, [allMedia, selectedTypes, selectedExtensions]);

    // --- Effect to Reset Page on Filter Change ---
    // When filters change, reset to page 1 to show the start of the new results
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedTypes, selectedExtensions]); // Dependency array includes filter states


    // --- Derived State: Pagination Calculation ---
    const totalPages = useMemo(() => {
        return Math.ceil(filteredMedia.length / ITEMS_PER_PAGE);
    }, [filteredMedia.length]);

    // Calculate the items to display on the current page
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
        setCurrentPage(1); // Reset to page 1 on new scrape

        // ... (rest of handleScrape fetch logic remains the same) ...
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

    // Filter handlers remain the same...
    const handleTypeToggle = (type: 'image' | 'video') => setSelectedTypes(prev => ({ ...prev, [type]: !prev[type] }));
    const handleExtensionToggle = (extension: string) => setSelectedExtensions(prev => prev.includes(extension) ? prev.filter(ext => ext !== extension) : [...prev, extension]);
    const handleSelectAllExtensions = () => setSelectedExtensions(availableExtensions);
    const handleDeselectAllExtensions = () => setSelectedExtensions([]);

    // Download handlers remain the same...
    // handleDownloadSingle and handleDownloadSelected work on `filteredMedia`,
    // so they correctly target all filtered items, not just the current page.
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
            }
        }
        setTimeout(() => setDownloadingCount(0), filteredMedia.length * 250 + 2000);
    };


    // --- Pagination Handlers ---
    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
            // Optional: Scroll to top when page changes
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handlePreviousPage = () => {
        handlePageChange(currentPage - 1);
    };

    const handleNextPage = () => {
        handlePageChange(currentPage + 1);
    };

    // Helper function to generate page numbers for the pagination component
    // Shows first page, last page, pages around current, and ellipses
    const getPageNumbers = () => {
        const pageNumbers = [];
        const maxPagesToShow = 5; // Adjust how many page numbers to show (excluding first/last/ellipses)
        const halfMaxPages = Math.floor(maxPagesToShow / 2);

        if (totalPages <= maxPagesToShow + 2) { // Show all pages if total is small
            for (let i = 1; i <= totalPages; i++) {
                pageNumbers.push(i);
            }
        } else {
            pageNumbers.push(1); // Always show first page

            let startPage = Math.max(2, currentPage - halfMaxPages);
            let endPage = Math.min(totalPages - 1, currentPage + halfMaxPages);

            if (currentPage - halfMaxPages <= 2) {
                endPage = startPage + maxPagesToShow - 1;
            }
            if (currentPage + halfMaxPages >= totalPages - 1) {
                startPage = endPage - maxPagesToShow + 1;
            }

            if (startPage > 2) {
                pageNumbers.push('...'); // Ellipsis before current range
            }

            for (let i = startPage; i <= endPage; i++) {
                pageNumbers.push(i);
            }

            if (endPage < totalPages - 1) {
                pageNumbers.push('...'); // Ellipsis after current range
            }

            pageNumbers.push(totalPages); // Always show last page
        }
        return pageNumbers;
    };


    // --- Render ---
    return (
        <div className="container mx-auto p-4 md:p-8">
            {/* Main application card */}
            <Card className="max-w-4xl mx-auto shadow-lg dark:border-gray-700">
                <CardHeader>
                    <CardTitle className="text-center text-2xl md:text-3xl font-bold text-primary">
                        Media Extractor
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {/* URL Input Form (remains the same) */}
                    <form onSubmit={handleScrape} className="space-y-4 mb-8">
                        {/* ... form content ... */}
                        <div className="space-y-1">
                            <Label htmlFor="urlInput" className="font-medium">Website URL</Label>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <Input
                                    id="urlInput" type="text" value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    placeholder=""
                                    required disabled={isLoading}
                                    className="flex-grow dark:bg-gray-800 dark:border-gray-600"
                                />
                                <Button type="submit" disabled={isLoading || !url} className="w-full sm:w-auto">
                                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {isLoading ? 'Extracting...' : 'Extract Media'}
                                </Button>
                            </div>
                        </div>
                    </form>

                    {error && (
                        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 text-destructive rounded-md dark:bg-red-900/30 dark:border-red-700/50 dark:text-red-300">
                            <p className="font-semibold">Error:</p>
                            <p>{error}</p>
                        </div>
                    )}

                    {/* --- Filters Section --- (remains the same) */}
                    {allMedia.length > 0 && (
                        <Card className="mb-6 bg-muted/50 dark:bg-gray-800/60">
                            {/* ... CardHeader with Filter/X toggle ... */}
                            <CardHeader className="pb-2 pt-4">
                                <CardTitle className="text-lg flex justify-between items-center">
                                    Filters
                                    <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)}>
                                        {showFilters ? <X className="h-4 w-4" /> : <Filter className="h-4 w-4" />}
                                    </Button>
                                </CardTitle>
                            </CardHeader>
                            {showFilters && (
                                <CardContent className="space-y-4 pt-2 pb-4">
                                    {/* ... Type Filters ... */}
                                    <div>
                                        <Label className="font-semibold block mb-2">Media Type</Label>
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
                                    {/* ... Extension Filters ... */}
                                    {availableExtensions.length > 0 && (
                                        <div>
                                            <Label className="font-semibold block mb-2">File Extension</Label>
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

                    {/* --- Download All Button --- (remains the same, applies to filteredMedia) */}
                    {filteredMedia.length > 0 && (
                        <div className="mb-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                            <Button onClick={handleDownloadSelected} disabled={downloadingCount > 0} className="w-full sm:w-auto">
                                {downloadingCount > 0 ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                {downloadingCount > 0 ? `Downloading (${downloadingCount})...` : `Download ${filteredMedia.length} Filtered`} {/* Updated text */}
                            </Button>
                            {downloadingCount > 0 && <p className="text-sm text-muted-foreground animate-pulse">Download in progress...</p>}
                        </div>
                    )}

                    {/* --- Results Section --- */}
                    {/* Show only if media has been scraped */}
                    {allMedia.length > 0 && (
                        <div>
                            {/* Updated count display to show current page info */}
                            <p className="text-sm text-muted-foreground mb-4 text-center">
                                Showing {paginatedMedia.length} items (Page {currentPage} of {totalPages}) - Total Found: {filteredMedia.length} {filteredMedia.length !== allMedia.length ? '(Filters Applied)' : ''}
                            </p>

                            {/* --- Results Grid --- */}
                            {/* Map over paginatedMedia instead of filteredMedia */}
                            {/* --- Results Grid --- */}
                            {/* Map over paginatedMedia */}
                            {/* Added mb-8 for spacing below grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                                {paginatedMedia.map((item, index) => (
                                    // --- CARD HEIGHT ---
                                    // 1. Add a fixed height class (e.g., h-64, h-72). Adjust as needed.
                                    // 2. Add flex flex-col to manage internal layout vertically.
                                    <Card
                                        key={item.src + index}
                                        className="overflow-hidden group dark:border-gray-700 h-72 relative shadow-md rounded-lg"
                                    >
                                        {/* Media Display Area (no changes) */}
                                        <div className="absolute inset-0 bg-muted dark:bg-gray-800">
                                            {item.type === 'image' ? (<img src={item.src} alt={item.alt || `Scraped Image ${index + 1}`} className="object-cover w-full h-full transition-opacity duration-300 group-hover:opacity-75" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }} />)
                                                : (
                                                    <video
                                                        // Use item.src as the source
                                                        src={item.src}
                                                        // Fill the container, maintain aspect ratio (cover)
                                                        className="object-cover w-full h-full"
                                                        // Preload only metadata (duration, dimensions) initially to save bandwidth
                                                        preload="metadata"
                                                        // Mute the video to increase chances of displaying/potentially autoplaying
                                                        muted
                                                        // Usually want playsinline for mobile contexts if autoplaying
                                                        // playsInline
                                                        // Disable default controls for a cleaner preview in the grid
                                                        controls={false}
                                                        // Optional: Add a title for accessibility/hover
                                                        title={item.filename || 'Scraped Video'}
                                                        // You could add loop attribute if desired: loop
                                                        // Handle potential video loading errors (optional)
                                                        onError={(e) => {
                                                            console.warn(`Failed to load video preview: ${item.src}`, e);
                                                            // Optionally replace with placeholder on error
                                                            // (e.target as HTMLVideoElement).style.display = 'none';
                                                            // Consider showing the icon again if error occurs
                                                        }}
                                                    >
                                                        {/* Fallback text if browser doesn't support video tag */}
                                                        <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground p-2 transition-opacity duration-300 group-hover:opacity-75"><VideoIcon className="w-1/2 h-1/2 mb-1 opacity-50 flex-shrink-0" /><span className="text-xs text-center break-words">Video Preview</span></div>
                                                    </video>
                                                )}
                                        </div>

                                        {/* Hover Overlay with Gradient and Info (DESKTOP HOVER) */}
                                        <div className="absolute inset-0 hidden sm:flex flex-col justify-end p-3 bg-gradient-to-t from-black/80 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                            <div className="flex justify-between items-center gap-2">
                                                {/* Filename */}
                                                <span className="text-white text-xs font-medium truncate" title={item.filename || item.src}>
                                                    {item.filename || 'Unknown Filename'}
                                                </span>
                                                {/* Button Group (Desktop) */}
                                                <div className="flex items-center gap-1 flex-shrink-0"> {/* Group buttons */}
                                                    {/* Copy Button (Desktop) */}
                                                    <Button
                                                        variant="secondary" size="icon"
                                                        className="h-8 w-8 bg-white/20 hover:bg-white/40 border-none"
                                                        onClick={(e) => {
                                                            e.stopPropagation(); // Prevent potential parent clicks
                                                            navigator.clipboard.writeText(item.src)
                                                                .then(() => toast.success("Link copied to clipboard!"))
                                                                .catch(err => toast.error("Failed to copy link."));
                                                        }} title="Copy media link"
                                                    >
                                                        <Link className="h-4 w-4 text-white" />
                                                    </Button>
                                                    {/* Download Button (Desktop) */}
                                                    <Button
                                                        variant="secondary" size="icon"
                                                        className="h-8 w-8 bg-white/20 hover:bg-white/40 border-none"
                                                        onClick={(e) => { e.stopPropagation(); handleDownloadSingle(item); }} title="Download this item"
                                                    >
                                                        <Download className="h-4 w-4 text-white" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Button Group (MOBILE / TOUCH) */}
                                        {/* Wrapper div is positioned, uses flex for button layout */}
                                        <div className="absolute top-2 right-2 z-10 block sm:hidden flex items-center gap-1">
                                            {/* Copy Button (Mobile) */}
                                            <Button
                                                variant="secondary" size="icon"
                                                className="h-8 w-8 bg-black/40 hover:bg-black/70 text-white backdrop-blur-sm border-none flex items-center justify-center p-0"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigator.clipboard.writeText(item.src)
                                                        .then(() => toast.success("Link copied!"))
                                                        .catch(err => toast.error("Failed to copy."));
                                                }} title="Copy media link"
                                            >
                                                <Link className="h-4 w-4" />
                                            </Button>
                                            {/* Download Button (Mobile) */}
                                            <Button
                                                variant="secondary" size="icon"
                                                className="h-8 w-8 bg-black/40 hover:bg-black/70 text-white backdrop-blur-sm border-none flex items-center justify-center p-0"
                                                onClick={(e) => { e.stopPropagation(); handleDownloadSingle(item); }} title="Download this item"
                                            >
                                                <Download className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </Card>
                                ))}
                            </div>

                            {/* --- Pagination Controls --- */}
                            {/* Show pagination only if there's more than one page */}
                            {totalPages > 1 && (
                                <Pagination>
                                    <PaginationContent>
                                        {/* Previous Button */}
                                        <PaginationItem>
                                            <PaginationPrevious
                                                href="#" // Use href="#" for SPA behavior or handle routing properly if needed
                                                onClick={(e) => { e.preventDefault(); handlePreviousPage(); }}
                                                aria-disabled={currentPage === 1}
                                                className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                                            />
                                        </PaginationItem>

                                        {/* Page Number Links */}
                                        {getPageNumbers().map((page, index) => (
                                            <PaginationItem key={index}>
                                                {typeof page === 'number' ? (
                                                    <PaginationLink
                                                        href="#"
                                                        onClick={(e) => { e.preventDefault(); handlePageChange(page); }}
                                                        isActive={currentPage === page} // Highlight current page
                                                        aria-current={currentPage === page ? "page" : undefined}
                                                    >
                                                        {page}
                                                    </PaginationLink>
                                                ) : (
                                                    // Ellipsis
                                                    <PaginationEllipsis />
                                                )}
                                            </PaginationItem>
                                        ))}

                                        {/* Next Button */}
                                        <PaginationItem>
                                            <PaginationNext
                                                href="#"
                                                onClick={(e) => { e.preventDefault(); handleNextPage(); }}
                                                aria-disabled={currentPage === totalPages}
                                                className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                                            />
                                        </PaginationItem>
                                    </PaginationContent>
                                </Pagination>
                            )}

                        </div> // End Results Section div
                    )}

                    {/* Loading/No Results States (remain the same) */}
                    {isLoading && ( /* ... loading indicator ... */
                        <div className="text-center text-muted-foreground mt-8 flex justify-center items-center gap-2">
                            <Loader2 className="h-5 w-5 animate-spin" /> Fetching data... {/* Simplified message */}
                        </div>
                    )}
                    {!isLoading && !error && allMedia.length === 0 && url && ( /* ... no results message ... */
                        <div className="text-center text-muted-foreground mt-8">
                            No media found matching the criteria on the specified page.
                        </div>
                    )}

                </CardContent>
                {/* Footer (remains the same) */}
                <CardFooter className="text-center text-xs text-muted-foreground justify-center pt-6 pb-4">
                    Scrape and download responsibly. Respect copyright and website terms of service.
                </CardFooter>
            </Card>
        </div>
    );
}