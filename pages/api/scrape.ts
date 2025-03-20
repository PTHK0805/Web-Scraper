import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import * as cheerio from 'cheerio';

type MediaData = {
  images: string[];
  videos: string[];
};

function makeUrlAbsolute(relativeUrl: string, baseUrl: string): string {
  try {
    return new URL(relativeUrl, baseUrl).href;
  } catch {
    return relativeUrl;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MediaData | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);
    
    const imageUrls = new Set<string>();
    const videoUrls = new Set<string>();

    // Extract image URLs
    $('img').each((_, element) => {
      const src = $(element).attr('src');
      const dataSrc = $(element).attr('data-src'); // For lazy-loaded images
      const srcset = $(element).attr('srcset');

      if (src) {
        imageUrls.add(makeUrlAbsolute(src, url));
      }
      if (dataSrc) {
        imageUrls.add(makeUrlAbsolute(dataSrc, url));
      }
      if (srcset) {
        srcset.split(',').forEach(src => {
          const srcUrl = src.trim().split(' ')[0];
          if (srcUrl) {
            imageUrls.add(makeUrlAbsolute(srcUrl, url));
          }
        });
      }
    });

    // Extract video URLs
    $('video').each((_, element) => {
      const src = $(element).attr('src');
      if (src) {
        videoUrls.add(makeUrlAbsolute(src, url));
      }

      // Check for source tags within video elements
      $(element).find('source').each((_, sourceElement) => {
        const sourceSrc = $(sourceElement).attr('src');
        if (sourceSrc) {
          videoUrls.add(makeUrlAbsolute(sourceSrc, url));
        }
      });
    });

    // Convert Sets to Arrays
    const images = Array.from(imageUrls);
    const videos = Array.from(videoUrls);

    res.status(200).json({
      images,
      videos,
    });
  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({ error: 'Failed to scrape the website' });
  }
}