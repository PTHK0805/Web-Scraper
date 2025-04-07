import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { MediaItem } from '@/app/api/scrape/route'; // Adjust path if needed
import { toast } from "sonner";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// --- Type Definitions ---
export interface ImageDimensions {
  width: number;
  height: number;
}

// --- Utility Functions ---

/**
 * Converts a VAPID public key string to a Uint8Array.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Triggers a file download via a server-side endpoint.
 */
export const triggerDownload = (mediaItem: MediaItem) => {
  try {
    const downloadUrl = `/api/download?url=${encodeURIComponent(mediaItem.src)}&filename=${encodeURIComponent(mediaItem.filename || 'download')}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', mediaItem.filename || 'download');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.info("Download Started", { description: mediaItem.filename || mediaItem.src });
  } catch (err) {
    console.error("Download trigger failed:", err);
    toast.error("Download Error", { description: "Could not start download." });
    throw err; // Re-throw to allow caller to handle state
  }
};

/**
 * Copies text to the clipboard and shows a toast message.
 */
export const copyToClipboard = (text: string, successMessage = "Link copied!") => {
  navigator.clipboard.writeText(text)
      .then(() => toast.success(successMessage))
      .catch(err => {
        console.error("Failed to copy:", err);
        toast.error("Failed to copy text.");
      });
};

/**
 * Calculates pagination numbers with ellipsis.
 */
export const getPaginationItems = (currentPage: number, totalPages: number, maxPagesToShow = 5): (number | string)[] => {
  if (totalPages <= 1) return [];

  const pageNumbers: (number | string)[] = [];
  const halfMaxPages = Math.floor(maxPagesToShow / 2);

  if (totalPages <= maxPagesToShow + 2) {
    // Show all pages if total is small
    for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
  } else {
    // Show first page
    pageNumbers.push(1);

    // Calculate start and end pages for the middle section
    let startPage = Math.max(2, currentPage - halfMaxPages);
    let endPage = Math.min(totalPages - 1, currentPage + halfMaxPages);

    // Adjust start/end if near the beginning or end
    if (currentPage - halfMaxPages <= 2) {
      endPage = startPage + maxPagesToShow - 1;
    }
    if (currentPage + halfMaxPages >= totalPages - 1) {
      startPage = endPage - maxPagesToShow + 1;
    }

    // Add start ellipsis if needed
    if (startPage > 2) pageNumbers.push('...');

    // Add middle page numbers
    for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);

    // Add end ellipsis if needed
    if (endPage < totalPages - 1) pageNumbers.push('...');

    // Show last page
    pageNumbers.push(totalPages);
  }
  return pageNumbers;
};

/**
 * Formats bytes into a human-readable string (KB, MB, GB, etc.).
 * @param bytes The number of bytes.
 * @param decimals The number of decimal places (default: 1).
 * @returns A formatted string like "1.5 MB", or null if bytes is undefined, null or NaN.
 */
export function formatBytes(bytes: number | undefined | null, decimals = 1): string | null {
  if (bytes == null || isNaN(bytes)) return null; // Handle undefined, null, NaN
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  // Ensure index is within bounds, default to Bytes if something strange happens
  const unit = sizes[i] ?? sizes[0];
  // Use parseFloat to remove trailing zeros from toFixed if dm is 0
  const value = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));

  return `${value} ${unit}`;
}