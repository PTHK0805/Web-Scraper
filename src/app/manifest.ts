import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Media Extractor',
        short_name: 'MediaExtract',
        description: 'Extract and download various media types from websites with just a few clicks. Simple, fast, and reliable',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#000000',
        icons: [
            {
                src: '/web-app-manifest-192x192.png',
                sizes: '192x192',
                type: 'image/png',
            },
            {
                src: '/web-app-manifest-512x512.png',
                sizes: '512x512',
                type: 'image/png',
            },
        ],
        screenshots: [
            {
                src: '/screenshot-wide.png',
                sizes: '1919x1016',
                type: 'image/png',
                form_factor: 'wide',
            },
            {
                src: '/screenshot-mobile.png',
                sizes: '650x988',
                type: 'image/png',
            },
        ],
    };
}