import { useState } from 'react';
import Head from 'next/head';
import axios from 'axios';
import download from 'downloadjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Download, Loader2, File, FileImage, FileVideo } from 'lucide-react';
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner"


interface MediaData {
  images: string[];
  videos: string[];
}

interface FileInfo {
  name: string;
  type: string;
  extension: string;
  url: string;
}

function getFileInfo(url: string): FileInfo {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop() || 'unknown';
    const extension = filename.split('.').pop()?.toLowerCase() || '';

    let type = 'Unknown';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)) {
      type = 'Image';
    } else if (['mp4', 'webm', 'ogg', 'mov'].includes(extension)) {
      type = 'Video';
    }

    return {
      name: filename,
      type,
      extension: extension.toUpperCase(),
      url
    };
  } catch (error) {
    return {
      name: 'unknown',
      type: 'Unknown',
      extension: 'Unknown',
      url
    };
  }
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mediaData, setMediaData] = useState<MediaData | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMediaData(null);

    try {
      const response = await axios.get('/api/scrape', {
        params: { url }
      });
      setMediaData(response.data);
    } catch (err) {
      setError('Failed to scrape media. Please check the URL and try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (fileInfo: FileInfo) => {
    try {
      const response = await axios.get(fileInfo.url, { responseType: 'blob' });
      download(response.data, fileInfo.name);
    } catch (err: any) {
      console.error('Download failed:', err);
      // alert('Failed to download file');
      toast('Failed to download file', {
        description: err?.message || 'An unexpected error occurred.',
        action: {
          label: 'Close',
          onClick: () => toast.dismiss()
        }
      });
    }
  };

  const handleDownloadAll = async () => {
    if (!mediaData) return;

    const allMedia = [...mediaData.images, ...mediaData.videos];
    for (const mediaUrl of allMedia) {
      const fileInfo = getFileInfo(mediaUrl);
      await handleDownload(fileInfo);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Head>
        <title>Web Media Scraper</title>
        <meta name="description" content="Scrape and download media from websites" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center mb-8">
          Web Media Scraper
        </h1>

        <Card className="max-w-xl mx-auto mb-8">
          <CardHeader>
            <CardTitle>Enter Website URL</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex gap-4">
              <Input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                required
                className="flex-1"
              />
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Scraping
                  </>
                ) : (
                  'Scrape'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {error && (
          <Card className="max-w-xl mx-auto mb-8 border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {mediaData && (
          <div className="space-y-8">
            {mediaData.images.length > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="flex items-center gap-2">
                    <FileImage className="h-6 w-6" />
                    Images ({mediaData.images.length})
                  </CardTitle>
                  <Button onClick={handleDownloadAll} variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    Download All
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {mediaData.images.map((imageUrl, index) => {
                      const fileInfo = getFileInfo(imageUrl);
                      return (
                        <Card key={index} className="overflow-hidden">
                          <CardContent className="p-2">
                            <div className="relative aspect-square mb-2">
                              <img
                                src={imageUrl}
                                alt={fileInfo.name}
                                className="w-full h-full object-contain"
                              />
                            </div>
                            <div className="space-y-2">
                              <div className="text-sm truncate" title={fileInfo.name}>
                                {fileInfo.name}
                              </div>
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span className="flex items-center">
                                  <FileImage className="h-3 w-3 mr-1" />
                                  {fileInfo.type}
                                </span>
                                <span className="font-mono">{fileInfo.extension}</span>
                              </div>
                              <Button
                                onClick={() => handleDownload(fileInfo)}
                                variant="secondary"
                                className="w-full"
                                size="sm"
                              >
                                <Download className="mr-2 h-4 w-4" />
                                Download
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {mediaData.videos.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileVideo className="h-6 w-6" />
                    Videos ({mediaData.videos.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {mediaData.videos.map((videoUrl, index) => {
                      const fileInfo = getFileInfo(videoUrl);
                      return (
                        <Card key={index}>
                          <CardContent className="p-2">
                            <video
                              controls
                              className="w-full aspect-video mb-2 bg-muted"
                            >
                              <source src={videoUrl} />
                              Your browser does not support the video tag.
                            </video>
                            <div className="space-y-2">
                              <div className="text-sm truncate" title={fileInfo.name}>
                                {fileInfo.name}
                              </div>
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span className="flex items-center">
                                  <FileVideo className="h-3 w-3 mr-1" />
                                  {fileInfo.type}
                                </span>
                                <span className="font-mono">{fileInfo.extension}</span>
                              </div>
                              <Button
                                onClick={() => handleDownload(fileInfo)}
                                variant="secondary"
                                className="w-full"
                                size="sm"
                              >
                                <Download className="mr-2 h-4 w-4" />
                                Download
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
        <Toaster />

      </main>
    </div>
  );
}
