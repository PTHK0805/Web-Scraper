import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const fileUrl = searchParams.get('url');
    const filename = searchParams.get('filename'); // Optional, pass desired filename

    if (!fileUrl) {
        return NextResponse.json({ error: 'Missing file URL parameter (url)' }, { status: 400 });
    }

    let validatedUrl: URL;
    try {
        validatedUrl = new URL(fileUrl);
        // Basic Security: Optional - Restrict domains if needed
        // const allowedDomains = ['example.com', 'anothersite.org'];
        // if (!allowedDomains.includes(validatedUrl.hostname)) {
        //     return NextResponse.json({ error: 'Downloading from this domain is not allowed' }, { status: 403 });
        // }
    } catch (_) {
        return NextResponse.json({ error: 'Invalid file URL format' }, { status: 400 });
    }

    console.log(`Proxying download for: ${validatedUrl.toString()}`);

    try {
        // Fetch the actual media file from the target URL
        const response = await fetch(validatedUrl.toString(), {
            headers: {
                 // Mimic a browser request if necessary, but often not needed for direct file access
                'User-Agent': 'Mozilla/5.0 NextjsMediaDownloader/1.0',
            },
             signal: AbortSignal.timeout(60000), // Longer timeout for potentially large files (60s)
        });

        if (!response.ok) {
            // Forward the error status from the target server
            return NextResponse.json(
                { error: `Failed to fetch file: ${response.statusText}` },
                { status: response.status }
            );
        }

        // Get the content type from the original response
        const contentType = response.headers.get('content-type') || 'application/octet-stream';

        // Determine filename: use provided param, or extract from URL, or default
        const finalFilename = filename || validatedUrl.pathname.split('/').pop() || 'downloaded_file';

        // Stream the response body back to the client
        const readableStream = response.body;

        if (!readableStream) {
             return NextResponse.json({ error: 'Failed to get readable stream from response' }, { status: 500 });
        }

        // Create a new response streaming the file content
        return new NextResponse(readableStream, {
            headers: {
                'Content-Type': contentType,
                // Crucial header to trigger browser download prompt with the correct filename
                'Content-Disposition': `attachment; filename="${finalFilename}"`,
                // Optional: Include Content-Length if available from original response
                ...(response.headers.get('content-length') && {
                    'Content-Length': response.headers.get('content-length')!,
                }),
            },
        });

    } catch (error: any) {
        console.error('Download Proxy Error:', error);
         let errorMessage = 'An error occurred while trying to download the file.';
         if (error.name === 'TimeoutError') {
             errorMessage = 'The request timed out while trying to fetch the file.';
         }
        return NextResponse.json({ error: errorMessage, details: error.message }, { status: 500 });
    }
}