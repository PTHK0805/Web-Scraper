export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { logScrapeEvent } from '@/lib/notion';

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
    fileSize?: number;
}

const getUrlDetails = (urlString: string): { extension?: string; filename?: string } => {
    try {
        const url = new URL(urlString);
        const pathname = url.pathname;
        const filename = pathname.substring(pathname.lastIndexOf('/') + 1);
        const extension = filename.includes('.')
            ? filename.substring(filename.lastIndexOf('.') + 1).toLowerCase()
            : undefined;
        const cleanFilename = filename.split('?')[0].split('#')[0];
        return { extension, filename: cleanFilename || undefined };
    } catch {
        return {};
    }
};

async function getFileSize(imageUrl: string): Promise<number | undefined> {
    try {
        const response = await fetch(imageUrl, {
            method: 'HEAD',
            signal: AbortSignal.timeout(8000),
        });

        if (!response.ok) {
            console.warn(`HEAD request failed for ${imageUrl}: Status ${response.status} ${response.statusText}`);
            return undefined;
        }

        const contentLength = response.headers.get('content-length');
        if (contentLength) {
            const size = parseInt(contentLength, 10);
            return isNaN(size) ? undefined : size;
        }

        console.warn(`Content-Length header missing for ${imageUrl}`);
        return undefined;
    } catch (error: any) {
        if (error.name === 'TimeoutError') {
            console.warn(`HEAD request timed out for ${imageUrl}`);
        } else {
            console.error(`Error fetching image size for ${imageUrl}:`, error.message);
        }
        return undefined;
    }
}

const seleniumServiceUrl = process.env.SELENIUM_SERVICE_URL;
const seleniumServiceTimeout = parseInt(process.env.SELENIUM_SERVICE_TIMEOUT || '60000', 10);

interface SeleniumResponse {
    images: string[];
    videos: string[];
}

async function scrapeWithSelenium(targetUrl: string, validatedUrl: URL): Promise<{ data: MediaItem[]; error?: string; status?: number }> {
    if (!seleniumServiceUrl) {
        return { data: [], error: "Selenium service URL not configured.", status: 501 };
    }

    try {
        const serviceUrl = new URL(seleniumServiceUrl);
        serviceUrl.searchParams.set('url', targetUrl);

        const response = await fetch(serviceUrl.toString(), {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(seleniumServiceTimeout),
        });

        if (!response.ok) {
            let errorMsg = `Selenium service request failed: ${response.statusText} (Status: ${response.status})`;
            try {
                const errorBody = await response.text();
                errorMsg += ` - Body: ${errorBody.substring(0, 200)}`;
            } catch (_) {}
            return { data: [], error: errorMsg, status: response.status };
        }

        const result: SeleniumResponse = await response.json();
        if (!result || !Array.isArray(result.images) || !Array.isArray(result.videos)) {
            return { data: [], error: "Invalid response structure from Selenium service.", status: 500 };
        }

        const uniqueSrcs = new Set<string>();
        const mediaItemsPromises: Promise<MediaItem | null>[] = [];

        for (const src of result.images) {
            if (src) {
                try {
                    const absoluteSrc = new URL(src).toString();
                    if (!uniqueSrcs.has(absoluteSrc)) {
                        uniqueSrcs.add(absoluteSrc);
                        const { extension, filename } = getUrlDetails(absoluteSrc);

                        const itemPromise = (async (): Promise<MediaItem | null> => {
                            try {
                                const fileSize = await getFileSize(absoluteSrc);
                                return { type: 'image', src: absoluteSrc, extension, filename, fileSize };
                            } catch (sizeError) {
                                console.error(`Error getting size for image ${absoluteSrc}:`, sizeError);
                                return { type: 'image', src: absoluteSrc, extension, filename };
                            }
                        })();
                        mediaItemsPromises.push(itemPromise);
                    }
                } catch (e) {
                    console.warn(`Skipping invalid image URL from Selenium: ${src}`, e instanceof Error ? e.message : e);
                }
            }
        }

        for (const src of result.videos) {
            if (src && typeof src === 'string') {
                try {
                    const absoluteSrc = new URL(src).toString();
                    if (!uniqueSrcs.has(absoluteSrc)) {
                        uniqueSrcs.add(absoluteSrc);
                        const { extension, filename } = getUrlDetails(absoluteSrc);

                        const itemPromise = (async (): Promise<MediaItem | null> => {
                            try {
                                const fileSize = await getFileSize(absoluteSrc);
                                return { type: 'video', src: absoluteSrc, extension, filename, fileSize };
                            } catch (sizeError) {
                                console.error(`Error getting size for video ${absoluteSrc}:`, sizeError);
                                return { type: 'video', src: absoluteSrc, extension, filename };
                            }
                        })();
                        mediaItemsPromises.push(itemPromise);
                    }
                } catch (e) {
                    console.warn(`Skipping invalid video URL from Selenium: ${src}`, e instanceof Error ? e.message : e);
                }
            }
        }

        const resolvedItems = (await Promise.all(mediaItemsPromises)).filter(item => item !== null) as MediaItem[];
        return { data: resolvedItems };
    } catch (error: any) {
        console.error("Selenium Service error:", error);
        let errorMessage = "Selenium Service request failed.";
        if (error.name === 'TimeoutError') {
            errorMessage = 'Selenium Service request timed out.';
        } else if (error.message) {
            errorMessage = `Selenium Service error: ${error.message}`;
        }
        return { data: [], error: errorMessage };
    }
}

async function scrapeWithFetch(targetUrl: string, validatedUrl: URL): Promise<{ data: MediaItem[]; error?: string; status?: number }> {
    try {
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.82 Safari/537.36 NextjsMediaDownloader/1.1 (FetchFallback)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
            return { data: [], error: `Fetch failed: ${response.statusText} (Status: ${response.status})`, status: response.status };
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('text/html')) {
            return { data: [], error: `Expected HTML, received ${contentType}`, status: 415 };
        }

        const html = await response.text();
        const $ = cheerio.load(html);
        const baseUrl = validatedUrl.origin;
        const uniqueSrcs = new Set<string>();
        const potentialItems: Omit<MediaItem, 'fileSize'>[] = [];

        const addPotentialItem = (
            type: 'image' | 'video',
            srcAttr: string | undefined | null,
            altAttr?: string | undefined | null,
            posterAttr?: string | undefined | null
        ) => {
            if (!srcAttr) return;
            try {
                const absoluteSrc = new URL(srcAttr, baseUrl).toString();
                if (uniqueSrcs.has(absoluteSrc)) return;

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
                    extension,
                    filename,
                    poster: absolutePoster,
                });
                uniqueSrcs.add(absoluteSrc);
            } catch (e) {
                console.warn(`Skipping invalid media URL: ${srcAttr}`, e instanceof Error ? e.message : e);
            }
        };

        $('img').each((_, el) => {
            const $el = $(el);
            const src = $el.attr('src');
            const dataSrc = $el.attr('data-src');
            addPotentialItem('image', src || dataSrc, $el.attr('alt'));
        });

        $('picture source').each((_, el) => {
            const $el = $(el);
            const srcset = $el.attr('srcset');
            if (srcset) {
                const firstSrc = srcset.split(',')[0].trim().split(' ')[0];
                const parentImgAlt = $el.closest('picture').siblings('img').attr('alt') || $el.closest('picture').find('img').attr('alt');
                addPotentialItem('image', firstSrc, parentImgAlt);
            }
        });

        $('video').each((_, el) => {
            const $el = $(el);
            const poster = $el.attr('poster');
            const videoSrc = $el.attr('src');

            if (videoSrc) {
                addPotentialItem('video', videoSrc, undefined, poster);
            } else {
                $el.find('source').each((_, sourceEl) => {
                    addPotentialItem('video', $(sourceEl).attr('src'), undefined, poster);
                });
            }
        });

        const mediaItemsPromises = potentialItems.map(async (item): Promise<MediaItem> => {
            const fileSize = await getFileSize(item.src);
            return { ...item, fileSize } as MediaItem;
        });

        const finalMediaItems = await Promise.all(mediaItemsPromises);
        return { data: finalMediaItems };
    } catch (error: any) {
        console.error('Fetch scraping error:', error);
        let errorMessage = 'Fetch failed.';
        if (error.name === 'TimeoutError') {
            errorMessage = 'Fetch timed out.';
        } else if (error.message) {
            errorMessage = `Fetch error: ${error.message}`;
        }
        return { data: [], error: errorMessage };
    }
}

export async function POST(request: NextRequest) {
    let targetUrl = '';
    let validatedUrl: URL;
    let methodUsed: 'Selenium' | 'Fetch' | 'None' = 'None';
    let finalData: MediaItem[] = [];
    let finalError: string | undefined = undefined;
    let finalStatus = 200;

    try {
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

        if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
            targetUrl = `https://${targetUrl}`;
        }

        try {
            validatedUrl = new URL(targetUrl);
            targetUrl = validatedUrl.toString();
        } catch (_) {
            await logScrapeEvent({ url: targetUrl, status: 'Failure', errorMessage: 'Invalid URL format' });
            return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
        }

        let seleniumResult = await scrapeWithSelenium(targetUrl, validatedUrl);
        if (!seleniumResult.error) {
            methodUsed = 'Selenium';
            finalData = seleniumResult.data;
            await logScrapeEvent({ url: targetUrl, status: 'Success', method: methodUsed, itemsFound: finalData.length });
            return NextResponse.json({ data: finalData });
        }

        const seleniumFailReason = seleniumResult.error || 'Unknown Selenium failure';
        const seleniumStatus = seleniumResult.status && seleniumResult.status >= 400 ? seleniumResult.status : 500;
        await logScrapeEvent({
            url: targetUrl,
            status: 'Failure',
            method: 'Selenium',
            itemsFound: 0,
            errorMessage: seleniumFailReason,
            statusCode: seleniumStatus
        });

        finalError = `Selenium failed: ${seleniumFailReason}`;
        finalStatus = seleniumStatus >= 500 ? 502 : seleniumStatus;

        let fetchResult = await scrapeWithFetch(targetUrl, validatedUrl);
        if (!fetchResult.error) {
            methodUsed = 'Fetch';
            finalData = fetchResult.data;
            await logScrapeEvent({
                url: targetUrl,
                status: 'Success',
                method: methodUsed,
                itemsFound: finalData.length,
                errorMessage: `Success via Fetch (Selenium failed: ${seleniumFailReason})`
            });
            return NextResponse.json({ data: finalData });
        }

        const fetchFailReason = fetchResult.error || 'Unknown Fetch failure';
        const fetchStatus = fetchResult.status;
        await logScrapeEvent({
            url: targetUrl,
            status: 'Failure',
            method: 'Fetch',
            itemsFound: 0,
            errorMessage: `Fetch failed (${fetchFailReason}) after Selenium failure (${seleniumFailReason})`,
            statusCode: fetchStatus
        });

        finalError += `; Fetch fallback failed: ${fetchFailReason}`;
        finalStatus = (fetchStatus && fetchStatus >= 400) ? fetchStatus : (finalStatus === 502 ? 502 : 500);

        return NextResponse.json({ error: `Scraping failed after trying Selenium and Fetch. Details: ${finalError}` }, { status: finalStatus });
    } catch (error: any) {
        console.error('Unhandled API Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await logScrapeEvent({
            url: targetUrl || 'N/A',
            status: 'Failure',
            errorMessage: `Unhandled API Error: ${errorMessage}`
        });
        return NextResponse.json({ error: 'An unexpected server error occurred.', details: errorMessage }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    return NextResponse.json({
        error: 'Method Not Allowed',
        details: 'Please use POST with a JSON body containing the target URL.'
    }, { status: 405 });
}