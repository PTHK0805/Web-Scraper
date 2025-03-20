import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import * as cheerio from 'cheerio';

type MediaData = {
  images: string[];
  videos: string[];
};

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
      if (src) {
        // Convert relative URLs to absolute URLs
        const absoluteUrl = new URL(src, url).href;
        images.push(absoluteUrl);
      }
    });

    // Extract video URLs
    $('video').each((_, element) => {
      const src = $(element).attr('src');
      if (src) {
        const absoluteUrl = new URL(src, url).href;
        videos.push(absoluteUrl);
      }

      // Check for source tags within video elements
      $(element).find('source').each((_, sourceElement) => {
        const sourceSrc = $(sourceElement).attr('src');
        if (sourceSrc) {
          const absoluteUrl = new URL(sourceSrc, url).href;
          videos.push(absoluteUrl);
        }
      });
    });

    res.status(200).json({
      images: [...new Set(images)], // Remove duplicates
      videos: [...new Set(videos)], // Remove duplicates
    });
  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({ error: 'Failed to scrape the website' });
  }
}