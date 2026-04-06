// Announcements Client — Pengumuman & Berita Pengumuman IDX
// Dipisah dari disclosure-client.ts untuk maintainability

import { fetchIdxApi } from '../utils/idx-api';
import { scrapeAnnouncementsHTML } from './announcements-html';
import type { Announcement } from '../types';
import { DEFAULT_CONFIG } from '../types';

// ── Date Formatting ─────────────────────────────
/**
 * Format tanggal ISO → format Indonesia untuk backward compatibility.
 * "2026-04-05T21:13:14" → { date: "05 April 2026", time: "21:13" }
 */
export function formatPublishDate(isoDate: string): { date: string; time: string } {
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return { date: isoDate, time: '' };

    const months = [
      'Januari','Februari','Maret','April','Mei','Juni',
      'Juli','Agustus','September','Oktober','November','Desember'
    ];

    const day   = String(d.getDate()).padStart(2, '0');
    const month = months[d.getMonth()];
    const year  = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins  = String(d.getMinutes()).padStart(2, '0');

    return {
      date: `${day} ${month} ${year}`,
      time: `${hours}:${mins}`,
    };
  } catch {
    return { date: isoDate, time: '' };
  }
}

// ── API Response Mapping ────────────────────────
/** Map IDX API raw item → Announcement interface */
function mapApiItem(item: any, urlField: 'PdfUrl' | 'FullSavePath' = 'FullSavePath'): Announcement {
  const { date, time } = formatPublishDate(item.PublishDate || '');
  return {
    date, time,
    title: item.Title || '',
    stockCode: (item.Code || null)?.trim() || null,
    files: (item.Attachments || []).map((att: any) => ({
      name: att.OriginalFilename || att.PDFFilename || att.FullNamePDF || 'file.pdf',
      url: att.FullSavePath || att.PdfUrl || att[urlField] || '',
    })),
  };
}

export class AnnouncementsClient {
  private baseUrl: string;

  constructor(config?: { idxBaseUrl?: string }) {
    this.baseUrl = config?.idxBaseUrl || DEFAULT_CONFIG.idxBaseUrl;
  }

  // ── API-based Announcements ────────────────────

  /** Ambil pengumuman via IDX API (lebih cepat & reliable) */
  async getAnnouncementsAPI(limit = 50, dateFrom?: string, dateTo?: string): Promise<Announcement[]> {
    console.log('[Announcements] Fetching via API...');

    const params: Record<string, string> = {
      keywords: '', pageNumber: '1',
      pageSize: String(Math.min(limit, 200)), lang: 'id',
    };
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo)   params.dateTo = dateTo;

    const raw = await fetchIdxApi({
      landingPage: `${this.baseUrl}/id/perusahaan-tercatat/keterbukaan-informasi/`,
      apiPath: '/primary/NewsAnnouncement/GetAllAnnouncement',
      params,
    });

    const items = (raw.Items || []).map((item: any) => mapApiItem(item, 'FullSavePath'));
    console.log(`[Announcements] API returned ${items.length} items`);
    return items.slice(0, limit);
  }

  /** Ambil pengumuman — API dengan fallback HTML scrape */
  async getAnnouncements(max = 50): Promise<Announcement[]> {
    try {
      return await this.getAnnouncementsAPI(max);
    } catch (apiErr) {
      console.warn(`[Announcements] API failed, falling back to HTML:`,
        apiErr instanceof Error ? apiErr.message : apiErr);
      return scrapeAnnouncementsHTML(this.baseUrl, max);
    }
  }

  // ── Berita Pengumuman ─────────────────────────

  /**
   * Ambil data dari halaman Berita Pengumuman IDX.
   * API endpoint SAMA dengan Keterbukaan Informasi, tapi landing page berbeda.
   */
  async getBeritaPengumuman(
    limit = 20, pageNumber?: number, keywords?: string,
  ): Promise<{ items: Announcement[]; totalCount: number; page: number; pageSize: number }> {
    console.log('[Announcements] Fetching Berita Pengumuman...');

    const raw = await fetchIdxApi({
      landingPage: `${this.baseUrl}/id/berita/pengumuman/`,
      apiPath: '/primary/NewsAnnouncement/GetAllAnnouncement',
      params: {
        keywords: keywords || '',
        pageNumber: String(pageNumber || 1),
        pageSize: String(Math.min(limit, 200)),
        lang: 'id',
      },
    });

    // Berita Pengumuman pakai FullSavePath (bukan PdfUrl)
    const items = (raw.Items || []).map((item: any) => mapApiItem(item, 'FullSavePath'));
    console.log(`[Announcements] Berita Pengumuman: ${items.length} items (total: ${raw.TotalCount || 0})`);

    return {
      items: items.slice(0, limit),
      totalCount: raw.TotalCount || items.length,
      page: pageNumber || 1,
      pageSize: Math.min(limit, 200),
    };
  }
}
