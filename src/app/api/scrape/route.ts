// src/app/api/scrape/route.ts
import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { logScrapeEvent } from '@/lib/notion'; // Assuming Notion util exists

// --- Interfaces & Helpers ---
interface ScrapeRequestBody {
    url: string;
}

export interface MediaItem {
    type: 'image' | 'video';
    src: string;
    alt?: string;
    extension?: string;
    filename?: string;
    poster?: string;
    fileSize?: number; // Added: file size in bytes for images
}

const getUrlDetails = (urlString: string): { extension?: string; filename?: string } => {
    try {
        const url = new URL(urlString);
        const pathname = url.pathname;
        const filename = pathname.substring(pathname.lastIndexOf('/') + 1);
        const extension = filename.includes('.') ? filename.substring(filename.lastIndexOf('.') + 1).toLowerCase() : undefined;
        // Remove query parameters and hash fragments from filename
        const cleanFilename = filename.split('?')[0].split('#')[0];
        return { extension, filename: cleanFilename || undefined };
    } catch {
        return {}; // Return empty object if URL parsing fails
    }
};

// --- Helper: Get Image Size ---
/**
 * Fetches the size of an image using a HEAD request.
 * @param imageUrl The URL of the image.
 * @returns The file size in bytes, or undefined if unable to determine.
 */
async function getImageSize(imageUrl: string): Promise<number | undefined> {
    try {
        // Use HEAD request for efficiency - only get headers
        const response = await fetch(imageUrl, {
            method: 'HEAD',
            signal: AbortSignal.timeout(8000), // Timeout for the HEAD request (8 seconds)
            // Consider adding a specific User-Agent if needed, but often not necessary for HEAD
            // headers: { 'User-Agent': '...' }
        });

        if (!response.ok) {
            // Log non-2xx status codes but don't treat as a fatal error for the whole scrape
            console.warn(`HEAD request failed for ${imageUrl}: Status ${response.status} ${response.statusText}`);
            return undefined; // Request failed (404, 500, 403 etc.)
        }

        const contentLength = response.headers.get('content-length');

        if (contentLength) {
            const size = parseInt(contentLength, 10);
            // Check if parsing was successful (returns NaN for invalid numbers)
            return isNaN(size) ? undefined : size;
        } else {
            // Content-Length header might be missing for various reasons (chunked encoding, etc.)
            console.warn(`Content-Length header missing for ${imageUrl}`);
            return undefined; // Header missing or invalid
        }
    } catch (error: any) {
        if (error.name === 'TimeoutError') {
            console.warn(`HEAD request timed out for ${imageUrl}`);
        } else {
            // Log other potential errors (network issues, DNS errors)
            console.error(`Error fetching image size for ${imageUrl}:`, error.message);
        }
        return undefined; // Error occurred during fetch
    }
}


// --- Environment Variable Checks ---
const seleniumServiceUrl = process.env.SELENIUM_SERVICE_URL; // URL for your Selenium service
const seleniumServiceTimeout = parseInt(process.env.SELENIUM_SERVICE_TIMEOUT || '60000', 10); // Timeout for Selenium service call in ms

// --- Method 1: Scraping with External Selenium Service ---
interface SeleniumResponse {
    images: string[]; // Should contain absolute URLs
    videos: string[]; // Should contain absolute URLs
    // Potentially add alt text if service can provide it
}

async function scrapeWithSelenium(targetUrl: string, validatedUrl: URL): Promise<{ data: MediaItem[]; error?: string; status?: number }> {
    if (!seleniumServiceUrl) {
        return { data: [], error: "Selenium service URL not configured.", status: 501 };
    }
    console.log(`Attempting scrape with Selenium Service: ${targetUrl}`);

    try {
        const serviceUrl = new URL(seleniumServiceUrl);
        serviceUrl.searchParams.set('url', targetUrl);

        console.log(`Calling Selenium Service: ${serviceUrl.toString()}`);

        const response = await fetch(serviceUrl.toString(), {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(seleniumServiceTimeout),
        });

        if (!response.ok) {
            let errorMsg = `Selenium service request failed: ${response.statusText} (Status: ${response.status})`;
            try { const errorBody = await response.text(); errorMsg += ` - Body: ${errorBody.substring(0, 200)}`; } catch (_) { /* Ignore */ }
            console.error(errorMsg);
            return { data: [], error: errorMsg, status: response.status };
        }

        const result: SeleniumResponse = await response.json();

        if (!result || !Array.isArray(result.images) || !Array.isArray(result.videos)) {
            console.error("Invalid response structure from Selenium service:", result);
            return { data: [], error: "Invalid response structure from Selenium service.", status: 500 };
        }

        const uniqueSrcs = new Set<string>();
        const mediaItemsPromises: Promise<MediaItem | null>[] = []; // Store promises for concurrent processing

        // --- Process images from Selenium response ---
        for (const src of result.images) {
            if (src && typeof src === 'string') {
                try {
                    const absoluteSrc = new URL(src).toString(); // Validate & normalize (should already be absolute)
                    if (!uniqueSrcs.has(absoluteSrc)) {
                        uniqueSrcs.add(absoluteSrc);
                        const { extension, filename } = getUrlDetails(absoluteSrc);

                        // Create a promise to fetch image size and construct the MediaItem
                        const itemPromise = (async (): Promise<MediaItem | null> => {
                            try {
                                const fileSize = await getImageSize(absoluteSrc);
                                return { type: 'image', src: absoluteSrc, extension, filename, fileSize };
                            } catch (sizeError) {
                                // Log specific error during size fetching but still include the item
                                console.error(`Error getting size for image ${absoluteSrc} from Selenium result:`, sizeError);
                                return { type: 'image', src: absoluteSrc, extension, filename }; // Return without size
                            }
                        })();
                        mediaItemsPromises.push(itemPromise);
                    }
                } catch (e) {
                    console.warn(`Skipping invalid image URL from Selenium service: ${src}`, e instanceof Error ? e.message : e);
                }
            }
        }

        // --- Process videos from Selenium response (no size fetching for videos yet) ---
        const videoItems: MediaItem[] = [];
        for (const src of result.videos) {
            if (src && typeof src === 'string') {
                try {
                    const absoluteSrc = new URL(src).toString(); // Validate & normalize
                    if (!uniqueSrcs.has(absoluteSrc)) {
                        uniqueSrcs.add(absoluteSrc);
                        const { extension, filename } = getUrlDetails(absoluteSrc);
                        // Videos added directly - consider adding poster info if service provides it
                        videoItems.push({ type: 'video', src: absoluteSrc, extension, filename });
                    }
                } catch (e) {
                    console.warn(`Skipping invalid video URL from Selenium service: ${src}`, e instanceof Error ? e.message : e);
                }
            }
        }

        // Wait for all image size fetches to complete (or fail)
        const resolvedImageItems = (await Promise.all(mediaItemsPromises)).filter(item => item !== null) as MediaItem[];

        // Combine image and video items
        const finalMediaItems = [...resolvedImageItems, ...videoItems];

        console.log(`Selenium Service method found ${finalMediaItems.length} items (incl. ${resolvedImageItems.length} images with size check, ${videoItems.length} videos).`);
        return { data: finalMediaItems };

    } catch (error: any) {
        console.error("Selenium Service request/processing error:", error);
        let errorMessage = "Selenium Service request failed.";
        if (error.name === 'TimeoutError') {
            errorMessage = 'Selenium Service request timed out.';
        } else if (error.message) {
            errorMessage = `Selenium Service error: ${error.message}`;
        }
        return { data: [], error: errorMessage }; // Status will be handled by the caller based on error presence
    }
}


// --- Method 2: Scraping with Fetch + Cheerio (Fallback) ---
async function scrapeWithFetch(targetUrl: string, validatedUrl: URL): Promise<{ data: MediaItem[]; error?: string; status?: number }> {
    console.log(`Attempting scrape with Fetch (Fallback): ${targetUrl}`);
    try {
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.82 Safari/537.36 NextjsMediaDownloader/1.1 (FetchFallback)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            signal: AbortSignal.timeout(15000), // Fetch timeout: 15 seconds
        });

        if (!response.ok) {
            return { data: [], error: `Fetch failed: ${response.statusText} (Status: ${response.status})`, status: response.status };
        }
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('text/html')) {
            return { data: [], error: `Expected HTML, received ${contentType}`, status: 415 }; // 415 Unsupported Media Type
        }

        const html = await response.text();
        const $ = cheerio.load(html);
        const baseUrl = validatedUrl.origin;
        const uniqueSrcs = new Set<string>();

        // --- Collect potential media items synchronously ---
        // Temporary storage for items found by Cheerio before async size fetching
        const potentialItems: Omit<MediaItem, 'fileSize'>[] = [];

        // Helper to add potential item (without size yet) ensuring valid URL and uniqueness
        const addPotentialItem = (
            type: 'image' | 'video',
            srcAttr: string | undefined | null,
            altAttr?: string | undefined | null,
            posterAttr?: string | undefined | null
        ) => {
            if (!srcAttr) return;
            try {
                const absoluteSrc = new URL(srcAttr, baseUrl).toString();
                if (uniqueSrcs.has(absoluteSrc)) return; // Skip duplicates

                let absolutePoster: string | undefined = undefined;
                if (posterAttr) {
                    try {
                        absolutePoster = new URL(posterAttr, baseUrl).toString();
                    } catch {
                        console.warn(`Skipping invalid poster URL: ${posterAttr}`);
                    }
                }

                const { extension, filename } = getUrlDetails(absoluteSrc);
                potentialItems.push({
                    type,
                    src: absoluteSrc,
                    alt: altAttr || undefined,
                    extension: extension,
                    filename: filename,
                    poster: absolutePoster,
                });
                uniqueSrcs.add(absoluteSrc); // Add to set after successful processing
            } catch (e) {
                // Log if srcAttr itself is not a valid URL relative to baseUrl
                console.warn(`Skipping invalid media URL during collection: ${srcAttr}`, e instanceof Error ? e.message : e);
            }
        };

        // Collect from <img> tags (check src and data-src)
        $('img').each((_, el) => {
            const $el = $(el);
            const src = $el.attr('src');
            const dataSrc = $el.attr('data-src');
            addPotentialItem('image', src || dataSrc, $el.attr('alt'));
        });

        // Collect from <picture><source> tags (check srcset)
        $('picture source').each((_, el) => {
            const $el = $(el);
            const srcset = $el.attr('srcset');
            if (srcset) {
                // Take the first URL from srcset as a candidate - often the smallest or default
                const firstSrc = srcset.split(',')[0].trim().split(' ')[0];
                // Try to get alt text from the parent img tag if possible
                const parentImgAlt = $el.closest('picture').siblings('img').attr('alt') || $el.closest('picture').find('img').attr('alt');
                addPotentialItem('image', firstSrc, parentImgAlt);
            }
        });

        // Collect from <video> tags (check src attribute and <source> children)
        $('video').each((_, el) => {
            const $el = $(el);
            const poster = $el.attr('poster');
            const videoSrc = $el.attr('src');

            if (videoSrc) {
                // Add video directly if src is on the <video> tag
                addPotentialItem('video', videoSrc, undefined, poster);
            } else {
                // Otherwise, check nested <source> tags
                $el.find('source').each((_, sourceEl) => {
                    addPotentialItem('video', $(sourceEl).attr('src'), undefined, poster);
                });
            }
        });

        // --- Fetch sizes for images asynchronously ---
        const mediaItemsPromises = potentialItems.map(async (item): Promise<MediaItem> => {
            // if (item.type === 'image') {
                // Fetch size only for images
                const fileSize = await getImageSize(item.src);
                // Return the item with the fileSize (which might be undefined)
                return { ...item, fileSize };
            // }
            // Return video items directly without attempting size fetch
            // return item;
        });

        // Wait for all promises (including size fetches for images) to resolve
        const finalMediaItems = await Promise.all(mediaItemsPromises);

        console.log(`Fetch (Fallback) method found ${finalMediaItems.length} items (incl. image size check).`);
        return { data: finalMediaItems };

    } catch (error: any) {
        console.error('Fetch scraping error (Fallback):', error);
        let errorMessage = 'Fetch failed (Fallback).';
        if (error.name === 'TimeoutError') {
            errorMessage = 'Fetch timed out (Fallback).';
        } else if (error.message) {
            errorMessage = `Fetch error (Fallback): ${error.message}`;
        }
        // Let the main handler decide the status based on the error message
        return { data: [], error: errorMessage };
    }
}

// --- Main POST Handler ---
export async function POST(request: NextRequest) {
    let targetUrl = '';
    let validatedUrl: URL;
    let methodUsed: 'Selenium' | 'Fetch' | 'None' = 'None';
    let finalData: MediaItem[] = [];
    let finalError: string | undefined = undefined;
    let finalStatus: number = 200; // Default success, change on error

    try {
        // --- URL Validation ---
        let body: ScrapeRequestBody;
        try {
            body = await request.json();
        } catch (e) {
            await logScrapeEvent({ url: 'N/A', status: 'Failure', errorMessage: 'Invalid JSON body' });
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }

        targetUrl = body.url;
        if (!targetUrl || typeof targetUrl !== 'string') {
            await logScrapeEvent({ url: 'N/A', status: 'Failure', errorMessage: 'URL is required and must be a string' });
            return NextResponse.json({ error: 'URL is required and must be a string' }, { status: 400 });
        }

        // Prepend https:// if scheme is missing
        if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
            targetUrl = `https://${targetUrl}`;
        }

        try {
            validatedUrl = new URL(targetUrl);
            targetUrl = validatedUrl.toString(); // Use the normalized URL
        } catch (_) {
            await logScrapeEvent({ url: targetUrl, status: 'Failure', errorMessage: 'Invalid URL format' });
            return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
        }

        console.log(`Scraping request for: ${targetUrl}`);

        // --- Attempt 1: Selenium Service ---
        console.log("Attempting scrape with Selenium Service...");
        let seleniumResult = await scrapeWithSelenium(targetUrl, validatedUrl);
        console.log("Selenium Result:", { dataLength: seleniumResult.data?.length, error: seleniumResult.error, status: seleniumResult.status });

        // Check if Selenium succeeded (no error reported by the function itself)
        // It's okay if data array is empty, it means Selenium ran but found nothing.
        if (!seleniumResult.error) {
            methodUsed = 'Selenium';
            finalData = seleniumResult.data;
            await logScrapeEvent({ url: targetUrl, status: 'Success', method: methodUsed, itemsFound: finalData.length });
            console.log(`Scraping finished using ${methodUsed}. Found ${finalData.length} items.`);
            return NextResponse.json({ data: finalData });
        }

        // --- Selenium Failed - Log and Prepare for Fetch Fallback ---
        const seleniumFailReason = seleniumResult.error || 'Unknown Selenium failure';
        // Use status from Selenium result if available, otherwise assume 500 level error
        const seleniumStatus = seleniumResult.status && seleniumResult.status >= 400 ? seleniumResult.status : 500;
        console.warn(`Selenium method failed (Reason: ${seleniumFailReason}). Status: ${seleniumStatus}. Attempting Fetch fallback...`);
        await logScrapeEvent({ url: targetUrl, status: 'Failure', method: 'Selenium', itemsFound: 0, errorMessage: seleniumFailReason, statusCode: seleniumStatus });
        finalError = `Selenium failed: ${seleniumFailReason}`; // Store initial error
        // If Selenium failed because of *its* source (e.g., 5xx), return 502 Bad Gateway.
        // If Selenium failed because the *target* URL was bad (e.g., 4xx), propagate that.
        finalStatus = seleniumStatus >= 500 ? 502 : seleniumStatus;

        // --- Attempt 2: Fetch + Cheerio (Fallback) ---
        console.log("Attempting Fetch as fallback...");
        let fetchResult = await scrapeWithFetch(targetUrl, validatedUrl);
        console.log("Fetch Result:", { dataLength: fetchResult.data?.length, error: fetchResult.error, status: fetchResult.status });

        // Check if Fetch succeeded (no error) AND found items (or if Selenium failed but Fetch ran ok even with 0 items)
        // We prefer Fetch results if Selenium failed, even if Fetch finds 0 items, as long as Fetch itself didn't error out.
        if (!fetchResult.error) {
            methodUsed = 'Fetch';
            finalData = fetchResult.data;
            // Log success via fallback, mentioning the initial failure
            await logScrapeEvent({
                url: targetUrl,
                status: 'Success',
                method: methodUsed,
                itemsFound: finalData.length,
                errorMessage: `Success via Fetch (Selenium failed: ${seleniumFailReason})` // Add context
            });
            console.log(`Scraping finished using ${methodUsed} (Fallback). Found ${finalData.length} items.`);
            // Return Fetch success data, even if empty. Status 200.
            return NextResponse.json({ data: finalData });
        }

        // --- Fetch also failed ---
        const fetchFailReason = fetchResult.error || 'Unknown Fetch failure';
        const fetchStatus = fetchResult.status; // Use status from Fetch result if available
        console.error(`Fetch method also failed (Reason: ${fetchFailReason}). Status: ${fetchStatus}. All methods exhausted.`);
        await logScrapeEvent({
            url: targetUrl,
            status: 'Failure',
            method: 'Fetch',
            itemsFound: 0,
            errorMessage: `Fetch failed (${fetchFailReason}) after Selenium failure (${seleniumFailReason})`,
            statusCode: fetchStatus
        });
        // Append Fetch error details
        finalError += `; Fetch fallback failed: ${fetchFailReason}`;
        // If Fetch failed with a specific client/server error status, use that, otherwise default to 500 or keep 502 if Selenium had gateway issue
        finalStatus = (fetchStatus && fetchStatus >= 400) ? fetchStatus : (finalStatus === 502 ? 502 : 500);


        // --- If we reach here, both attempts failed ---
        console.error(`All scraping methods failed for ${targetUrl}. Final Error: ${finalError}`);
        // Ensure status reflects a server-side inability to fulfill if not already set to error
        if (finalStatus < 400) finalStatus = 500;
        return NextResponse.json({ error: `Scraping failed after trying Selenium and Fetch. Details: ${finalError}` }, { status: finalStatus });

    } catch (error: any) {
        // Catch unexpected errors (e.g., initial JSON parsing, unhandled exceptions)
        console.error('Unhandled API Error in POST handler:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await logScrapeEvent({
            url: targetUrl || 'N/A',
            status: 'Failure',
            errorMessage: `Unhandled API Error: ${errorMessage}`
        });
        // Return a generic server error response
        return NextResponse.json({ error: 'An unexpected server error occurred.', details: errorMessage }, { status: 500 });
    }
}

// Optional: Handler for GET requests (Method Not Allowed)
export async function GET(request: NextRequest) {
    // Log attempt if desired
    // await logScrapeEvent({ url: 'N/A', status: 'Failure', errorMessage: 'GET method used', statusCode: 405 });
    // console.log(`Received GET request from ${request.ip || 'unknown IP'}, path: ${request.nextUrl.pathname}`);
    return NextResponse.json({ error: 'Method Not Allowed', details: 'Please use POST with a JSON body containing the target URL.' }, { status: 405 });
}