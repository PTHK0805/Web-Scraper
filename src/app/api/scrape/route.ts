// src/app/api/scrape/route.ts
import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
// Import the utility function and the log data type
import { logScrapeEvent, NotionScrapeLogData } from '@/lib/notion'; // Adjust path if necessary


interface ScrapeRequestBody {
    url: string;
}

export interface MediaItem {
    type: 'image' | 'video';
    src: string;
    alt?: string;
    extension?: string;
    filename?: string;
}

const getUrlDetails = (urlString: string): { extension?: string; filename?: string } => {
    // ... (getUrlDetails function remains the same)
     try { const url = new URL(urlString); const pathname = url.pathname; const filename = pathname.substring(pathname.lastIndexOf('/') + 1); const extension = filename.includes('.') ? filename.substring(filename.lastIndexOf('.') + 1).toLowerCase() : undefined; const cleanFilename = filename.split('?')[0].split('#')[0]; return { extension, filename: cleanFilename || undefined }; } catch { return {}; }
};

export async function POST(request: NextRequest) {
    // No need for logData variable here anymore, call directly
    let targetUrl = ''; // Keep URL accessible for logging

    try {
        const body: ScrapeRequestBody = await request.json();
        targetUrl = body.url;

        if (!targetUrl) {
             // Call the utility function directly
             await logScrapeEvent({ url: 'N/A', status: 'Failure', errorMessage: 'URL is required in request' });
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }
        if (!targetUrl.startsWith('http')) {
            targetUrl = `https://${targetUrl}`;
        }

        let validatedUrl: URL;
        try {
            validatedUrl = new URL(targetUrl);
            targetUrl = validatedUrl.toString();
        } catch (_) {
             // Call the utility function directly
             await logScrapeEvent({ url: targetUrl, status: 'Failure', errorMessage: 'Invalid URL format provided' });
            return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
        }

        console.log(`Scraping: ${targetUrl}`);

        const response = await fetch(targetUrl, {
            headers: { /* ... headers ... */
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 NextjsMediaDownloader/1.0',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            },
            signal: AbortSignal.timeout(20000),
        });

        if (!response.ok) {
            const errorMsg = `Failed to fetch URL: ${response.statusText} (Status: ${response.status})`;
            // Call the utility function directly
            await logScrapeEvent({ url: targetUrl, status: 'Failure', itemsFound: 0, errorMessage: errorMsg });
            return NextResponse.json({ error: errorMsg }, { status: response.status });
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('text/html')) {
             const errorMsg = `Expected HTML content, but received ${contentType}`;
              // Call the utility function directly
             await logScrapeEvent({ url: targetUrl, status: 'Failure', itemsFound: 0, errorMessage: errorMsg });
             console.warn(errorMsg + ` for ${targetUrl}`);
             // Optional: return NextResponse.json({ error: errorMsg }, { status: 400 });
        }

        const html = await response.text();
        const $ = cheerio.load(html);
        const mediaItems: MediaItem[] = [];
        const baseUrl = validatedUrl.origin;
        const uniqueSrcs = new Set<string>();

        const addMediaItem = (type: 'image' | 'video', srcAttr: string | undefined | null, altAttr?: string | undefined | null) => {
            // ... (addMediaItem logic remains the same) ...
             if (!srcAttr) return; try { const absoluteSrc = new URL(srcAttr, baseUrl).toString(); if (uniqueSrcs.has(absoluteSrc)) return; const { extension, filename } = getUrlDetails(absoluteSrc); mediaItems.push({ type, src: absoluteSrc, alt: altAttr || undefined, extension: extension, filename: filename }); uniqueSrcs.add(absoluteSrc); } catch (e) { console.warn(`Skipping invalid media URL: ${srcAttr}`); }
        };

        // --- Selectors (remain the same) ---
        $('img').each((_, el) => { addMediaItem('image', $(el).attr('src') || $(el).attr('data-src'), $(el).attr('alt')); });
        $('picture source').each((_, el) => { const srcset = $(el).attr('srcset'); if (srcset) addMediaItem('image', srcset.split(',')[0].trim().split(' ')[0]); });
        $('video').each((_, el) => { const src = $(el).attr('src'); if (src) addMediaItem('video', src); else $(el).find('source').each((_, srcEl) => addMediaItem('video', $(srcEl).attr('src'))); });

        console.log(`Found ${mediaItems.length} unique media items on ${targetUrl}`);

        // --- Log Success using utility function ---
        await logScrapeEvent({ url: targetUrl, status: 'Success', itemsFound: mediaItems.length });

        // --- Return Results ---
        return NextResponse.json({ data: mediaItems });

    } catch (error: any) {
        console.error('Scraping API Error:', error);

        let errorMessage = 'An error occurred during scraping.';
        if (error.name === 'TimeoutError') errorMessage = 'The request timed out while trying to fetch the URL.';
        else if (error.code === 'ENOTFOUND' || error.message?.includes('fetch failed')) errorMessage = 'Could not resolve the provided URL.';
        else if (error.message) errorMessage = error.message;

        // --- Log Failure using utility function ---
        await logScrapeEvent({
            url: targetUrl || 'N/A (Error before URL processing)',
            status: 'Failure',
            itemsFound: 0, // Indicate 0 items on failure
            errorMessage: errorMessage
        });

        // --- Return Error Response ---
        return NextResponse.json({ error: errorMessage, details: error.message }, { status: 500 });
    }
}