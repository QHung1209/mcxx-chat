import { Injectable } from '@nestjs/common';
import { getLinkPreview } from 'link-preview-js';
import { lookup } from 'dns/promises';

export interface LinkPreview {
  link: string;
  title: string | null;
  description: string | null;
  image: string | null;
}

@Injectable()
export class LinkPreviewService {
  private static readonly URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;

  extractUrls(content?: string): string[] {
    if (!content) return [];
    return [...new Set(content.match(LinkPreviewService.URL_REGEX) ?? [])];
  }

  async fetchPreview(url: string): Promise<LinkPreview | null> {
    try {
      const data = await getLinkPreview(url, {
        timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; mcxxBot/1.0)' },
        resolveDNSHost: async (target) => {
          const { hostname } = new URL(target);
          const { address } = await lookup(hostname);
          return address;
        },
      });

      if ('title' in data) {
        return {
          link: url,
          title: data.title ?? null,
          description: data.description ?? null,
          image: data.images?.[0] ?? null,
        };
      }

      return { link: url, title: null, description: null, image: null };
    } catch (err) {
      console.warn(`[link-preview] Failed to fetch preview for ${url}:`, err);
      return null;
    }
  }
}
