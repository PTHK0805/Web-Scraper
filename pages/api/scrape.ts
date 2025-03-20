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

function removeDuplicates(arr: string[]): string[] {
  return Array.from(new Set(arr));
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
    
    const images: string[] = [];
    const videos: string[] = [];

    // Extract image URLs
    $('img').each((_, element) => {
      const src = $(element).attr('src');
      const dataSrc = $(element).attr('data-src'); // For lazy-loaded images
      const srcset = $(element).attr('srcset');

      if (src) {
        images.push(makeUrlAbsolute(src, url));
      }
      if (dataSrc) {
        images.push(makeUrlAbsolute(dataSrc, url));
      }
      if (srcset) {
        srcset.split(',').forEach(src => {
          const srcUrl = src.trim().split(' ')[0];
          if (srcUrl) {
            images.push(makeUrlAbsolute(srcUrl, url));
          }
        });
      }
    });

    // Extract video URLs
    $('video').each((_, element) => {
      const src = $(element).attr('src');
      if (src) {
        videos.push(makeUrlAbsolute(src, url));
      }

      // Check for source tags within video elements
      $(element).find('source').each((_, sourceElement) => {
        const sourceSrc = $(sourceElement).attr('src');
        if (sourceSrc) {
          videos.push(makeUrlAbsolute(sourceSrc, url));
        }
      });
    });

    // Remove duplicates and send response
    res.status(200).json({
      images: removeDuplicates(images),
      videos: removeDuplicates(videos)
    });
  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({ error: 'Failed to scrape the website' });
  }
}