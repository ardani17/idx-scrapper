// Response Enrichment Helpers
// Fungsi shared untuk menambahkan metadata ke response (directUrl, dll)
// Dipakai oleh announcements, berita-pengumuman, dan financial-reports

import type { Announcement, FinancialReport } from '../types';

// ── Announcement File Enrichment ────────────────
/** Tambahkan `.directUrl` ke setiap file dalam announcement */
export function enrichAnnouncementFiles(items: Announcement[]): Announcement[] {
  return items.map(item => ({
    ...item,
    files: item.files.map(f => ({
      ...f,
      directUrl: f.url,
    })),
  }));
}

// ── Financial Report Attachment Enrichment ──────
/** Tambahkan `.directUrl` ke setiap attachment laporan keuangan */
export function enrichFinancialReportAttachments(results: FinancialReport[]): FinancialReport[] {
  return results.map(r => ({
    ...r,
    attachments: r.attachments.map(a => ({
      ...a,
      directUrl: a.filePath.startsWith('http')
        ? a.filePath
        : `https://www.idx.co.id${a.filePath}`,
    })),
  }));
}
