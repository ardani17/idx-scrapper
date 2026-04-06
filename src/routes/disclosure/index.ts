// Disclosure Routes — Index (Route Assembler)
// Menggabungkan semua sub-routes disclosure ke dalam satu Elysia group.

import { Elysia } from 'elysia';
import type { DisclosureClient } from '../../clients/disclosure-client';
import type { FileDownloader } from '../../downloaders/file-downloader';
import { announcementsRoutes } from './announcements';
import { financialReportsRoutes } from './financial-reports';
import { monitorRoutes } from './monitor';

/**
 * Build semua disclosure routes dengan prefix `/disclosure`.
 *
 * Sub-routes:
 *   - announcements:  /redirect, /berita-pengumuman, /announcements
 *   - financial-reports: /financial-reports, /download
 *   - monitor:        /monitor, /check-new, /state, /state/reset
 */
export function disclosureRoutes(
  disclosure: DisclosureClient,
  downloader: FileDownloader,
  stateFile: string,
) {
  return new Elysia({ prefix: '/disclosure' })
    .use(announcementsRoutes(disclosure))
    .use(financialReportsRoutes(disclosure, downloader))
    .use(monitorRoutes(disclosure, downloader, stateFile));
}
