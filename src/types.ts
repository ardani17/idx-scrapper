// IDX Scraper - Type Definitions & Constants

// ── Cookies ──────────────────────────────────────
export interface CookieJar {
  cookies: string;
  updatedAt: number;
  expiresAt: number;
}

// ── IDX Data ─────────────────────────────────────
export interface EmitenItem {
  kode: string;
  nama: string;
  tanggalPencatatan: string;
}

export interface CompanyProfile {
  code: string;
  name: string;
  officeAddress: string;
  email: string;
  phone: string;
  fax: string;
  taxId: string;
  website: string;
  listingDate: string;
  board: string;
  mainBusiness: string;
  sector: string;
  subsector: string;
  industry: string;
  subindustry: string;
  shareRegistrar: string;
  directors: { name: string; position: string }[];
  commissioners: { name: string; position: string }[];
  ownership: { holder: string; category: string; shares: string; percentage: string }[];
  subsidiaries: { name: string; business: string; shares: string; percentage: string }[];
}

export interface RelistingData {
  kodeEmiten: string;
  namaEmiten: string;
  efekType: string;
  papanPencatatan: string;
  tanggalPencatatan: string;
  sahamIPOValue: number;
}

// ── Disclosure ───────────────────────────────────
export interface Announcement {
  date: string;
  time: string;
  title: string;
  stockCode: string | null;
  files: { name: string; url: string }[];
}

export interface FinancialReportAttachment {
  emitenCode: string;
  fileId: string;
  fileModified: string;
  fileName: string;
  filePath: string;
}

export interface FinancialReport {
  kodeEmiten: string;
  namaEmiten: string;
  reportYear: string;
  reportPeriod: string | null;
  fileModified: string;
  attachments: FinancialReportAttachment[];
}

export type ReportType = 'ra' | 'rdf' | 'rq';

export interface DisclosureMonitorState {
  lastCheckAt: string;
  lastAnnouncementDate: string;
  lastAnnouncementIds: string[];
  newAnnouncements: Announcement[];
  newFinancialReports: FinancialReport[];
  financialReportState: Record<string, { lastCheckAt: string; lastModified: string }>;
}

// ── Config ───────────────────────────────────────
export interface ScraperConfig {
  idxBaseUrl: string;
  cookieMaxAge: number;
  requestTimeout: number;
}

export const DEFAULT_CONFIG: ScraperConfig = {
  idxBaseUrl: 'https://www.idx.co.id',
  cookieMaxAge: 30 * 60 * 1000,
  requestTimeout: 30000,
};

export const REPORT_TYPE_NAMES: Record<ReportType, string> = {
  ra: 'Laporan Tahunan',
  rdf: 'Laporan Keuangan Harian',
  rq: 'Laporan Keuangan Triwulanan',
};

export const MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  zip: 'application/zip',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};
