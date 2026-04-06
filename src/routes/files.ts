// Routes — File browsing, serving, deletion

import { Elysia, t } from 'elysia';
import { promises as fs } from 'fs';
import type { FileDownloader } from '../downloaders/file-downloader';
import { MIME_TYPES } from '../types';
import { formatBytes } from '../utils/format';

export function fileRoutes(downloader: FileDownloader) {
  return new Elysia({ prefix: '/disclosure' })
    .get('/files', async ({ query }) => {
      const listing = await downloader.listFiles(query.folder);
      return { success: true, ...listing, totalSizeFormatted: formatBytes(listing.totalSize) };
    }, {
      query: t.Object({ folder: t.Optional(t.String({ default: '' })) }),
    })

    .get('/file', async ({ query }) => {
      const fullPath = downloader.resolvePath(decodeURIComponent(query.path));
      const stat = await fs.stat(fullPath);
      if (!stat.isFile()) return new Response('File not found', { status: 404 });

      const buffer = await fs.readFile(fullPath);
      const ext = query.path.split('.').pop()?.toLowerCase() || '';
      const fileName = query.path.split('/').pop() || 'file';

      return new Response(buffer, {
        headers: {
          'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
          'Content-Disposition': `inline; filename="${fileName}"`,
          'Content-Length': stat.size.toString(),
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }, {
      query: t.Object({ path: t.String() }),
    })

    .delete('/file', async ({ query }) => {
      const fullPath = downloader.resolvePath(decodeURIComponent(query.path));
      const stat = await fs.stat(fullPath);
      if (stat.isDirectory()) await fs.rm(fullPath, { recursive: true });
      else await fs.unlink(fullPath);
      return { success: true, message: `Deleted: ${query.path}` };
    }, {
      query: t.Object({ path: t.String() }),
    });
}
