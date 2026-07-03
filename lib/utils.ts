import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Extract a stable session ID from a Bilibili URL.
 * Uses BV id (e.g. BV1xx411c7mD) as the session key so captures
 * from the same video are grouped together.
 * Falls back to the full URL hash for non-standard URLs.
 */
export function urlToSessionId(url: string): string {
  // BV id: /video/BV1xx411c7mD or b23.tv short link resolved
  const bvMatch = url.match(/BV[a-zA-Z0-9]{10}/);
  if (bvMatch) return bvMatch[0];
  // ep id (番剧): /ep/12345
  const epMatch = url.match(/\/ep(\d+)/);
  if (epMatch) return 'ep' + epMatch[1];
  // bangumi ss id: /ss12345
  const ssMatch = url.match(/\/ss(\d+)/);
  if (ssMatch) return 'ss' + ssMatch[1];
  // fallback: hash the URL
  return 'url-' + url.slice(0, 60);
}

/**
 * Extract a human-readable title from a Bilibili URL.
 * Falls back to the BV id or URL prefix.
 */
export function urlToSessionTitle(url: string): string {
  const bvMatch = url.match(/BV[a-zA-Z0-9]{10}/);
  const u = new URL(url);
  // try the document title pattern: bilibili - <title>
  // we can't access document.title here (background context),
  // so just use the path segment
  if (bvMatch) return 'BV' + bvMatch[0].slice(2);
  const epMatch = url.match(/\/ep(\d+)/);
  if (epMatch) return '番剧 ep' + epMatch[1];
  return u.hostname + u.pathname.slice(0, 30);
}