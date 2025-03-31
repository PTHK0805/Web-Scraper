'use client';

import React, { useState, useMemo, FormEvent, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Download } from "lucide-react";

// Actions and Types
import { sendNotification as serverSendNotification } from './actions'; // Rename server action slightly
import type { MediaItem } from './api/scrape/route';
import type { ImageDimensions } from '@/lib/utils'; // Adjust path

// Utilities
import { triggerDownload, copyToClipboard } from '@/lib/utils'; // Adjust path

// Hooks
import { usePushNotifications } from '@/hooks/usePushNotifications'; // Adjust path

// Components
import { UrlInputForm } from '@/components/UrlInputForm'; // Adjust path
import { FilterControls } from '@/components/FilterControls'; // Adjust path
import { MediaGrid } from '@/components/MediaGrid'; // Adjust path
import { PaginationControls } from '@/components/PaginationControls'; // Adjust path
import { NotificationControls } from '@/components/NotificationControls'; // Adjust path
import { InstallPromptDisplay } from '@/components/InstallPromptDisplay'; // Adjust path

// --- Constants ---
const ITEMS_PER_PAGE = 20;
const DOWNLOAD_DELAY_MS = 200; // Delay between bulk download triggers
const DOWNLOAD_FINISH_BUFFER_MS = 2000; // Extra time after bulk downloads finish

export default function HomePage() {
    // --- State Variables ---
    const [url, setUrl] = useState<string>('');
    const [allMedia, setAllMedia] = useState<MediaItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [scrapeError, setScrapeError] = useState<string | null>(null);
    const [imageDetails, setImageDetails] = useState<Record<string, ImageDimensions>>({});
    const [showFilters, setShowFilters] = useState<boolean>(false);
    const [selectedTypes, setSelectedTypes] = useState<Record<MediaItem['type'], boolean>>({ image: true, video: true });
    const [availableExtensions, setAvailableExtensions] = useState<string[]>([]);
    const [selectedExtensions, setSelectedExtensions] = useState<string[]>([]);
    const [downloadingCount, setDownloadingCount] = useState<number>(0);
    const [currentPage, setCurrentPage] = useState<number>(1);

    // --- Custom Hook for Notifications/PWA ---
    const {
        isSupported: pushSupported,
        subscription,
        subscribe,
        unsubscribe,
        sendTestNotification: sendPushTestNotification, // Renamed to avoid conflict
        isSubscribing,
        isUnsubscribing,
        isIOS,
        isStandalone,
    } = usePushNotifications();

    // --- Derived State (Memoized) ---
    const filteredMedia = useMemo(() => {
        return allMedia.filter(item => {
            if (!selectedTypes[item.type]) return false;
            if (selectedExtensions.length > 0 && !selectedExtensions.includes(item.extension || '')) return false;
            return true;
        });
    }, [allMedia, selectedTypes, selectedExtensions]);

    const totalPages = useMemo(() => {
        return Math.ceil(filteredMedia.length / ITEMS_PER_PAGE);
    }, [filteredMedia.length]);

    const paginatedMedia = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        return filteredMedia.slice(startIndex, endIndex);
    }, [filteredMedia, currentPage]);

    // --- Effects ---

    // Reset page number when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedTypes, selectedExtensions]);

    // Clear image dimensions cache when starting a new scrape
    useEffect(() => {
        if (isLoading) {
            setImageDetails({});
        }
    }, [isLoading]);

    // --- Event Handlers ---

    const handleScrape = useCallback(async (event?: FormEvent<HTMLFormElement>) => {
        event?.preventDefault();
        if (!url || isLoading) return;

        setIsLoading(true);
        setScrapeError(null);
        setAllMedia([]);
        setAvailableExtensions([]);
        setSelectedExtensions([]);
        setShowFilters(false);
        setCurrentPage(1);
        // imageDetails cleared by useEffect [isLoading]

        try {
            const response = await fetch('/api/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
            });
            const result = await response.json();

            if (!response.ok) {
                const errorMsg = result.error || `API Error: ${response.statusText}`;
                // Attempt to send push notification on failure
                if (subscription) {
                    serverSendNotification('Extraction Failed', errorMsg)
                        .catch(err => console.warn("Failed to send failure notification:", err));
                }
                throw new Error(errorMsg);
            }

            if (result.data && Array.isArray(result.data) && result.data.length > 0) {
                const mediaData = result.data as MediaItem[];
                setAllMedia(mediaData);
                const extensions = [...new Set(mediaData.map(item => item.extension).filter(Boolean))] as string[];
                setAvailableExtensions(extensions.sort());
                setSelectedExtensions([]); // Reset extensions on new scrape
                toast.success("Extraction successful!", { description: `Found ${mediaData.length} media items.` });
                // Attempt to send push notification on success
                if (subscription) {
                    serverSendNotification("Extraction successful!", `Found ${mediaData.length} media items.`)
                        .catch(err => console.warn("Failed to send success notification:", err));
                }
                setShowFilters(true); // Show filters if results found
            } else {
                setAllMedia([]); // Ensure empty array if no data
                toast.info("No Media Found", { description: "The scraper didn't find any images or videos on the page." });
            }
        } catch (err: any) {
            console.error("Extraction failed:", err);
            const errorMessage = err.message || 'An unexpected error occurred.';
            setScrapeError(errorMessage);
            toast.error("Extraction Error", { description: errorMessage });
        } finally {
            setIsLoading(false);
        }
    }, [url, isLoading, subscription]); // Added subscription dependency

    // Filter Handlers
    const handleTypeToggle = useCallback((type: MediaItem['type']) => {
        setSelectedTypes(prev => ({ ...prev, [type]: !prev[type] }));
    }, []);

    const handleExtensionToggle = useCallback((extension: string) => {
        setSelectedExtensions(prev =>
            prev.includes(extension)
                ? prev.filter(ext => ext !== extension)
                : [...prev, extension]
        );
    }, []);

    const handleSelectAllExtensions = useCallback(() => {
        setSelectedExtensions(availableExtensions);
    }, [availableExtensions]);

    const handleDeselectAllExtensions = useCallback(() => {
        setSelectedExtensions([]);
    }, []);

    // Download Handlers
    const handleDownloadSingle = useCallback((item: MediaItem) => {
        // Assuming triggerDownload shows its own toasts
        try {
            triggerDownload(item);
        } catch (error) {
            // Error toast is handled within triggerDownload
        }
    }, []);

    const handleDownloadFiltered = useCallback(async () => {
        if (filteredMedia.length === 0) {
            toast.warning("Nothing to Download", { description: "No media items match the current filters." });
            return;
        }
        if (downloadingCount > 0) return; // Prevent multiple concurrent bulk downloads

        setDownloadingCount(filteredMedia.length);
        toast.info(`Starting ${filteredMedia.length} Downloads...`, { description: "Check your browser downloads." });

        let completed = 0;
        for (const item of filteredMedia) {
            try {
                triggerDownload(item);
                completed++;
                // Update count immediately for visual feedback (optional)
                // setDownloadingCount(prev => prev - 1);
                await new Promise(resolve => setTimeout(resolve, DOWNLOAD_DELAY_MS)); // Add delay
            } catch (err) {
                console.error(`Failed to trigger download for ${item.src}`, err);
                // Error handled in triggerDownload, decrement count here
                setDownloadingCount(prev => Math.max(0, prev - 1));
            }
        }

        // Clear the count after a buffer period
        // Use completed count for timeout calculation
        setTimeout(() => {
            setDownloadingCount(0);
            console.log(`Bulk download attempt finished for ${completed} items.`);
        }, DOWNLOAD_FINISH_BUFFER_MS);

    }, [filteredMedia, downloadingCount]);

    // Pagination Handler
    const handlePageChange = useCallback((page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [totalPages]);

    // Image Detail Handler (passed to MediaItemCard via MediaGrid)
    const handleImageLoadComplete = useCallback((src: string, dimensions: ImageDimensions) => {
        setImageDetails(prev => ({ ...prev, [src]: dimensions }));
    }, []);

    // Copy Link Handler
    const handleCopyLink = useCallback((src: string) => {
        copyToClipboard(src);
    }, []);

    // --- Render Logic ---
    const showResults = !isLoading && allMedia.length > 0;
    const showNoResultsMessage = !isLoading && !scrapeError && allMedia.length > 0 && filteredMedia.length === 0;
    const showInitialOrNoDataMessage = !isLoading && !scrapeError && allMedia.length === 0 && url; // After an attempt with URL

    return (
        <div className="container mx-auto p-4 md:p-8">
            {/* Use transparent card as main container */}
            <Card className="max-w-4xl mx-auto border-none shadow-none bg-transparent dark:bg-transparent">
                <CardHeader className="pt-0 pb-4 md:pt-2 md:pb-6">
                    <CardTitle className="text-center text-2xl md:text-3xl font-bold text-foreground">
                        Media Extractor
                    </CardTitle>
                </CardHeader>

                <CardContent className="p-0 md:p-4">
                    {/* Notification and PWA Install Section */}
                    <NotificationControls
                        isSupported={pushSupported}
                        subscription={subscription}
                        onSubscribe={subscribe}
                        onUnsubscribe={unsubscribe}
                        onSendTest={() => sendPushTestNotification("Test Notification", "This is a test message!")}
                        isSubscribing={isSubscribing}
                        isUnsubscribing={isUnsubscribing}
                    />
                    <InstallPromptDisplay isIOS={isIOS} isStandalone={isStandalone} />


                    {/* URL Input */}
                    <UrlInputForm
                        url={url}
                        setUrl={setUrl}
                        onSubmit={handleScrape}
                        isLoading={isLoading}
                    />

                    {/* Error Display */}
                    {scrapeError && (
                        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 text-destructive rounded-md dark:bg-red-900/30 dark:border-red-700/50 dark:text-red-300">
                            <p className="font-semibold">Error:</p>
                            <p>{scrapeError}</p>
                        </div>
                    )}

                    {/* Filters - Only show when media is loaded */}
                    {allMedia.length > 0 && (
                        <FilterControls
                            showFilters={showFilters}
                            onToggleShowFilters={() => setShowFilters(prev => !prev)}
                            selectedTypes={selectedTypes}
                            onTypeToggle={handleTypeToggle}
                            availableExtensions={availableExtensions}
                            selectedExtensions={selectedExtensions}
                            onExtensionToggle={handleExtensionToggle}
                            onSelectAllExtensions={handleSelectAllExtensions}
                            onDeselectAllExtensions={handleDeselectAllExtensions}
                        />
                    )}

                    {/* Download All Button - Only show when filtered media exists */}
                    {filteredMedia.length > 0 && (
                        <div className="mb-4 flex flex-col sm:flex-row justify-center items-center gap-4">
                            <Button onClick={handleDownloadFiltered} disabled={downloadingCount > 0} className="w-full sm:w-auto shadow-sm">
                                {downloadingCount > 0 ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                {downloadingCount > 0 ? `Downloading (${downloadingCount})...` : `Download ${filteredMedia.length} Filtered Item${filteredMedia.length === 1 ? '' : 's'}`}
                            </Button>
                            {downloadingCount > 0 && <p className="text-sm text-muted-foreground animate-pulse">Download in progress...</p>}
                        </div>
                    )}

                    {/* Results Section */}
                    {showResults && (
                        <>
                            <p className="text-sm text-muted-foreground mb-4 text-center">
                                Showing {paginatedMedia.length} of {filteredMedia.length} item{filteredMedia.length === 1 ? '' : 's'} on Page {currentPage} of {totalPages}
                                {filteredMedia.length !== allMedia.length ? ' (Filters Applied)' : ''}
                            </p>

                            <MediaGrid
                                mediaItems={paginatedMedia}
                                imageDetails={imageDetails}
                                onDownload={handleDownloadSingle}
                                onImageLoadComplete={handleImageLoadComplete}
                                onCopyLink={handleCopyLink}
                            />

                            <PaginationControls
                                currentPage={currentPage}
                                totalPages={totalPages}
                                onPageChange={handlePageChange}
                            />
                        </>
                    )}

                    {/* Loading/No Results States */}
                    {isLoading && (
                        <div className="text-center text-muted-foreground mt-8 flex justify-center items-center gap-2">
                            <Loader2 className="h-5 w-5 animate-spin" /> Fetching data...
                        </div>
                    )}
                    {showInitialOrNoDataMessage && (
                        <div className="text-center text-muted-foreground mt-8">
                            No media found on the specified page.
                        </div>
                    )}
                    {showNoResultsMessage && (
                        <div className="text-center text-muted-foreground mt-8">
                            No media items match your current filter selection.
                        </div>
                    )}

                </CardContent>

                <CardFooter className="text-center text-xs text-muted-foreground justify-center pt-6 pb-4 border-t dark:border-gray-700/50 mt-8">
                    Scrape and download responsibly. Respect copyright and website terms of service.
                </CardFooter>
            </Card>
        </div>
    );
}