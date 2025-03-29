// src/app/api/scrape/route.ts
import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { logScrapeEvent } from '@/lib/notion'; // Assuming Notion util exists

// --- Interfaces & Helpers ---
interface ScrapeRequestBody { url: string; }
export interface MediaItem {
    type: 'image' | 'video';
    src: string;
    alt?: string;
    extension?: string;
    filename?: string;
    poster?: string;
}
const getUrlDetails = (urlString: string): { extension?: string; filename?: string } => { try { const url = new URL(urlString); const pathname = url.pathname; const filename = pathname.substring(pathname.lastIndexOf('/') + 1); const extension = filename.includes('.') ? filename.substring(filename.lastIndexOf('.') + 1).toLowerCase() : undefined; const cleanFilename = filename.split('?')[0].split('#')[0]; return { extension, filename: cleanFilename || undefined }; } catch { return {}; } };

// --- Environment Variable Checks ---
// Removed ScrapingBee variables
const seleniumServiceUrl = process.env.SELENIUM_SERVICE_URL; // URL for your Selenium service
const seleniumServiceTimeout = parseInt(process.env.SELENIUM_SERVICE_TIMEOUT || '60000', 10); // Timeout for Selenium service call in ms

// --- Helper: Add Media Item (Used by Fetch method) ---
function addMediaItem(
    mediaItems: MediaItem[],
    uniqueSrcs: Set<string>,
    baseUrl: string, // Base URL of the *original* target site
    type: 'image' | 'video',
    srcAttr: string | undefined | null,
    altAttr?: string | undefined | null,
    posterAttr?: string | undefined | null
) {
    if (!srcAttr) return;
    try {
        const absoluteSrc = new URL(srcAttr, baseUrl).toString();
        if (uniqueSrcs.has(absoluteSrc)) return;

        let absolutePoster: string | undefined = undefined;
        if (posterAttr) {
            try {
                absolutePoster = new URL(posterAttr, baseUrl).toString();
            } catch { /* ignore invalid poster */ }
        }

        const { extension, filename } = getUrlDetails(absoluteSrc);
        mediaItems.push({
            type,
            src: absoluteSrc,
            alt: altAttr || undefined,
            extension: extension,
            filename: filename,
            poster: absolutePoster,
        });
        uniqueSrcs.add(absoluteSrc);
    } catch (e) {
        console.warn(`Skipping invalid media URL: ${srcAttr}`, e instanceof Error ? e.message : e);
    }
}

// --- Method 1: Scraping with External Selenium Service ---
interface SeleniumResponse {
    images: string[];
    videos: string[];
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
            return { data: [], error: errorMsg, status: response.status };
        }

        const result: SeleniumResponse = await response.json();

        if (!result || !Array.isArray(result.images) || !Array.isArray(result.videos)) {
             console.error("Invalid response structure from Selenium service:", result);
            return { data: [], error: "Invalid response structure from Selenium service.", status: 500 }; // Indicate internal error processing service response
        }

        const mediaItems: MediaItem[] = [];
        const uniqueSrcs = new Set<string>();
        const baseUrl = validatedUrl.origin; // For getUrlDetails consistency if needed, though service should provide absolute

        // Process images from Selenium response
        for (const src of result.images) {
            if (src && typeof src === 'string') {
                 try {
                    const absoluteSrc = new URL(src).toString(); // Validate & normalize
                     if (!uniqueSrcs.has(absoluteSrc)) {
                        const { extension, filename } = getUrlDetails(absoluteSrc);
                        mediaItems.push({ type: 'image', src: absoluteSrc, extension, filename });
                        uniqueSrcs.add(absoluteSrc);
                    }
                 } catch (e) { console.warn(`Skipping invalid image URL from Selenium service: ${src}`, e); }
            }
        }

        // Process videos from Selenium response
        for (const src of result.videos) {
            if (src && typeof src === 'string') {
                 try {
                    const absoluteSrc = new URL(src).toString(); // Validate & normalize
                     if (!uniqueSrcs.has(absoluteSrc)) {
                        const { extension, filename } = getUrlDetails(absoluteSrc);
                        mediaItems.push({ type: 'video', src: absoluteSrc, extension, filename });
                        uniqueSrcs.add(absoluteSrc);
                    }
                 } catch (e) { console.warn(`Skipping invalid video URL from Selenium service: ${src}`, e); }
            }
        }

        console.log(`Selenium Service method found ${mediaItems.length} items.`);
        return { data: mediaItems };

    } catch (error: any) {
        console.error("Selenium Service request/processing error:", error);
        let errorMessage = "Selenium Service request failed.";
        if (error.name === 'TimeoutError') errorMessage = 'Selenium Service request timed out.';
        else if (error.message) errorMessage = error.message;
        return { data: [], error: errorMessage };
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
        const mediaItems: MediaItem[] = [];
        const baseUrl = validatedUrl.origin;
        const uniqueSrcs = new Set<string>();

        // Use addMediaItem helper
        $('img').each((_, el) => { addMediaItem(mediaItems, uniqueSrcs, baseUrl, 'image', $(el).attr('src') || $(el).attr('data-src'), $(el).attr('alt')); });
        $('picture source').each((_, el) => { const srcset = $(el).attr('srcset'); if (srcset) addMediaItem(mediaItems, uniqueSrcs, baseUrl, 'image', srcset.split(',')[0].trim().split(' ')[0], ''); });
        $('video').each((_, el) => {
             const $el = $(el); const poster = $el.attr('poster'); const videoSrc = $el.attr('src');
             if (videoSrc) { addMediaItem(mediaItems, uniqueSrcs, baseUrl, 'video', videoSrc, '', poster); }
             else { $el.find('source').each((_, sourceEl) => { addMediaItem(mediaItems, uniqueSrcs, baseUrl, 'video', $(sourceEl).attr('src'), '', poster); }); }
        });

        console.log(`Fetch (Fallback) method found ${mediaItems.length} items.`);
        return { data: mediaItems };
    } catch (error: any) {
        console.error('Fetch scraping error (Fallback):', error);
        let errorMessage = 'Fetch failed (Fallback).';
        if (error.name === 'TimeoutError') errorMessage = 'Fetch timed out (Fallback).';
        else if (error.message) errorMessage = error.message;
        return { data: [], error: errorMessage };
    }
}

// --- Main POST Handler ---
export async function POST(request: NextRequest) {
    let targetUrl = '';
    let validatedUrl: URL;
    let methodUsed: 'Selenium' | 'Fetch' | 'None' = 'None'; // Removed 'ScrapingBee'
    let finalData: MediaItem[] = [];
    let finalError: string | undefined = undefined;
    let finalStatus: number = 200;

    try {
        // --- URL Validation ---
        const body: ScrapeRequestBody = await request.json();
        targetUrl = body.url;
        if (!targetUrl) { await logScrapeEvent({ url: 'N/A', status: 'Failure', errorMessage: 'URL required' }); return NextResponse.json({ error: 'URL is required' }, { status: 400 }); }
        if (!targetUrl.startsWith('http')) { targetUrl = `https://${targetUrl}`; }
        try { validatedUrl = new URL(targetUrl); targetUrl = validatedUrl.toString(); }
        catch (_) { await logScrapeEvent({ url: targetUrl, status: 'Failure', errorMessage: 'Invalid URL format' }); return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 }); }

        // --- Attempt 1: Selenium Service ---
        let seleniumResult = await scrapeWithSelenium(targetUrl, validatedUrl);
        console.log("Selenium Result: ", seleniumResult);

        if (!seleniumResult.error && seleniumResult.data.length >= 0) { // Selenium succeeded (even if 0 results)
            methodUsed = 'Selenium';
            finalData = seleniumResult.data;
            await logScrapeEvent({ url: targetUrl, status: 'Success', method: methodUsed, itemsFound: finalData.length });
            console.log(`Scraping finished using ${methodUsed}. Found ${finalData.length} items.`);
            return NextResponse.json({ data: finalData });
        }
        // --- Selenium Failed - Log and Prepare for Fetch Fallback ---
        else {
            const seleniumFailReason = seleniumResult.error || 'Unknown Selenium failure';
            const seleniumStatus = seleniumResult.status || 500;
            console.warn(`Selenium method failed (Reason: ${seleniumFailReason}). Status: ${seleniumStatus}. Attempting Fetch fallback...`);
            await logScrapeEvent({ url: targetUrl, status: 'Failure', method: 'Selenium', itemsFound: 0, errorMessage: seleniumFailReason, statusCode: seleniumStatus });
            finalError = `Selenium failed: ${seleniumFailReason}`; // Store initial error
            finalStatus = seleniumStatus >= 500 ? 502 : seleniumStatus; // Set initial status based on Selenium failure type

            // --- Attempt 2: Fetch + Cheerio (Fallback) ---
            console.log("Attempting Fetch as fallback...");
            let fetchResult = await scrapeWithFetch(targetUrl, validatedUrl);
            console.log("Fetch Result: ", fetchResult);

            if (!fetchResult.error && fetchResult.data.length > 0) { // Fetch succeeded AND found items
                methodUsed = 'Fetch';
                finalData = fetchResult.data;
                await logScrapeEvent({ url: targetUrl, status: 'Success', method: methodUsed, itemsFound: finalData.length, errorMessage: `Success via Fetch (Selenium failed: ${seleniumFailReason})` });
                console.log(`Scraping finished using ${methodUsed} (Fallback). Found ${finalData.length} items.`);
                return NextResponse.json({ data: finalData }); // Return Fetch success data
            }
            // --- Fetch also failed or found nothing ---
            else {
                const fetchFailReason = fetchResult.error || (fetchResult.data.length === 0 ? 'Found 0 items' : 'Unknown Fetch failure');
                const fetchStatus = fetchResult.status;
                console.error(`Fetch method also failed or found nothing (Reason: ${fetchFailReason}). Status: ${fetchStatus}. All methods exhausted.`);
                await logScrapeEvent({ url: targetUrl, status: 'Failure', method: 'Fetch', itemsFound: 0, errorMessage: `Fetch failed/found 0 (${fetchFailReason}) after Selenium failure`, statusCode: fetchStatus});
                finalError += `; Fetch failed/found 0: ${fetchFailReason}`; // Append Fetch error
                finalStatus = 500; // If both failed, return a generic server error or keep 502 if that was the original issue
            }
        }

        // --- If we reach here, both attempts failed or found nothing actionable ---
        console.error(`All scraping methods failed or returned no results for ${targetUrl}. Error accumulation: ${finalError}`);
        // Ensure status is appropriate for the combined failure
        if (finalStatus === 200) finalStatus = 500; // If initial status was somehow ok, set to 500 for final failure
        return NextResponse.json({ error: `Scraping failed after trying Selenium and Fetch. Details: ${finalError || 'Unknown failure'}` }, { status: finalStatus });

    } catch (error: any) {
        // Catch unexpected errors (e.g., initial JSON parsing)
        console.error('Unhandled API Error:', error);
        await logScrapeEvent({ url: targetUrl || 'N/A', status: 'Failure', errorMessage: `Unhandled API Error: ${error.message}` });
        return NextResponse.json({ error: 'An unexpected server error occurred.', details: error.message }, { status: 500 });
    }
}

// Optional: Add handler for GET requests if needed, or just return method not allowed
export async function GET() {
    return NextResponse.json({ error: 'Method Not Allowed', details: 'Please use POST with a URL in the body.' }, { status: 405 });
}