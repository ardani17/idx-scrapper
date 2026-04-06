// IDX Data Client — Relisting, Emiten, Company Profile

import { createPage } from '../utils/browser';
import type { CompanyProfile, EmitenItem, RelistingData } from '../types';
import { DEFAULT_CONFIG } from '../types';

export class IDXClient {
  private baseUrl: string;
  private timeout: number;

  constructor(config?: { idxBaseUrl?: string; requestTimeout?: number }) {
    this.baseUrl = config?.idxBaseUrl || DEFAULT_CONFIG.idxBaseUrl;
    this.timeout = config?.requestTimeout || DEFAULT_CONFIG.requestTimeout;
  }

  async getRelistingData(pageSize = 10, indexFrom = 0): Promise<RelistingData[]> {
    const page = await createPage();
    try {
      const url = `${this.baseUrl}/primary/Home/GetRelistingData?pageSize=${pageSize}&indexFrom=${indexFrom}`;
      const resp = await page.goto(url, { timeout: this.timeout });
      if (!resp || resp.status() !== 200) throw new Error(`HTTP ${resp?.status()}`);

      const data = await page.evaluate(() => {
        try { return JSON.parse(document.body.innerText || '{}'); } catch { return {}; }
      });

      return (data.Activities || []).map((item: any) => ({
        kodeEmiten: item.KodeEmiten || '',
        namaEmiten: item.NamaEmiten || '',
        efekType: item.EfekType || '',
        papanPencatatan: item.PapanPencatatan || '',
        tanggalPencatatan: item.TanggalPencatatan || '',
        sahamIPOValue: item.SahamIPOValue || 0,
      }));
    } finally {
      await page.close();
    }
  }

  async getCompanyProfile(code: string): Promise<CompanyProfile | null> {
    const page = await createPage();
    try {
      console.log(`[IDX] Scraping profile: ${code}`);
      await page.goto(
        `${this.baseUrl}/id/perusahaan-tercatat/profil-perusahaan-tercatat/${code}`,
        { waitUntil: 'networkidle', timeout: this.timeout },
      );
      await page.waitForTimeout(3000);

      const raw = await page.evaluate(() => {
        const tables = document.querySelectorAll('table');
        if (!tables.length) return null;

        const result: Record<string, any> = {};
        const parseInfoTable = (table: Element) => {
          const data: Record<string, string> = {};
          table.querySelectorAll('tr').forEach(row => {
            const key = row.querySelector('.td-name, .no-wrap')?.textContent?.replace(/:$/, '').trim() || '';
            const val = row.querySelector('.td-content')?.textContent?.trim() || '';
            if (key && val) data[key] = val;
          });
          return data;
        };
        const parseListTable = (table: Element) =>
          Array.from(table.querySelectorAll('tr')).slice(1)
            .map(row => {
              const cells = row.querySelectorAll('td');
              return {
                name: cells[0]?.textContent?.replace(/\s+/g, ' ').trim() || '',
                position: cells[1]?.textContent?.replace(/\s+/g, ' ').trim() || '',
              };
            })
            .filter(d => d.name);

        const parseHoldingTable = (table: Element) =>
          Array.from(table.querySelectorAll('tr')).slice(1)
            .map(row => {
              const c = row.querySelectorAll('td');
              return {
                holder: c[0]?.textContent?.replace(/\s+/g, ' ').trim() || '',
                category: c[1]?.textContent?.replace(/\s+/g, ' ').trim() || '',
                shares: c[2]?.textContent?.replace(/\s+/g, ' ').trim() || '',
                percentage: c[3]?.textContent?.replace(/\s+/g, ' ').trim() || '',
              };
            })
            .filter(h => h.holder);

        result.info = { ...parseInfoTable(tables[0]), ...parseInfoTable(tables[1]) };
        result.corporateSecretary = parseInfoTable(tables[2]);
        result.directors = parseListTable(tables[3]);
        result.commissioners = parseListTable(tables[4]);
        result.ownership = parseHoldingTable(tables[6]);
        result.subsidiaries = parseHoldingTable(tables[7]);
        return result;
      });

      if (!raw) return null;
      const i = raw.info;
      return {
        code, name: i.Nama || '', officeAddress: (i['Alamat Kantor'] || '').replace(/\n/g, ', '),
        email: i['Alamat Email'] || '', phone: i.Telepon || '', fax: i.Fax || '',
        taxId: i.NPWP || '', website: i.Situs || '', listingDate: i['Tanggal Pencatatan'] || '',
        board: i['Papan Pencatatan'] || '', mainBusiness: i['Bidang Usaha Utama'] || '',
        sector: i.Sektor || '', subsector: i.Subsektor || '', industry: i.Industri || '',
        subindustry: i.Subindustri || '', shareRegistrar: i['Biro Administrasi Efek'] || '',
        directors: raw.directors, commissioners: raw.commissioners,
        ownership: raw.ownership, subsidiaries: raw.subsidiaries,
      };
    } finally {
      await page.close();
    }
  }

  async getEmitenList(pageNum = 1): Promise<EmitenItem[]> {
    const page = await createPage();
    try {
      await page.goto(
        `${this.baseUrl}/id/perusahaan-tercatat/profil-perusahaan-tercatat/`,
        { waitUntil: 'networkidle', timeout: this.timeout },
      );
      await page.waitForTimeout(3000);

      if (pageNum > 1) {
        try { await page.click(`a:has-text("${pageNum}")`); await page.waitForTimeout(3000); } catch {}
      }

      return await page.evaluate(() => {
        const items: EmitenItem[] = [];
        document.querySelectorAll('table tr').forEach(row => {
          const cells = row.querySelectorAll('td');
          const kode = cells[0]?.textContent?.trim() || '';
          if (/^[A-Z]{3,6}$/.test(kode)) {
            items.push({
              kode,
              nama: cells[1]?.textContent?.trim() || '',
              tanggalPencatatan: cells[2]?.textContent?.trim() || '',
            });
          }
        });
        return items;
      });
    } finally {
      await page.close();
    }
  }
}
