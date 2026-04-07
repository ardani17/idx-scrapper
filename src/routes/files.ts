// Routes — File browsing, serving, deletion

import { Elysia, t } from 'elysia';
import { promises as fs } from 'fs';
import type { FileDownloader } from '../downloaders/file-downloader';
import { MIME_TYPES } from '../types';
import { formatBytes } from '../utils/format';

const security = [{ ApiKeyAuth: [] }];
const securityAdmin = [{ AdminKeyAuth: [] }];
const errResponses = {
  401: { $ref: '#/components/responses/Unauthorized' },
  429: { $ref: '#/components/responses/RateLimited' },
};

const ADMIN_KEY = process.env.ADMIN_API_KEY || 'admin-secret';
function isAdmin(request: Request): boolean {
  const key = request.headers.get('x-admin-key') || request.headers.get('authorization')?.replace('Bearer ', '');
  return key === ADMIN_KEY;
}

export function fileRoutes(downloader: FileDownloader) {
  return new Elysia({ prefix: '/disclosure' })
    .get('/files', async ({ query }) => {
      const listing = await downloader.listFiles(query.folder);
      return { success: true, ...listing, totalSizeFormatted: formatBytes(listing.totalSize) };
    }, {
      query: t.Object({ folder: t.Optional(t.String({ default: '' })) }),
      detail: {
        tags: ['Files'],
        summary: 'List downloaded files',
        description: 'Browse downloaded disclosure files on the server. Optionally filter by folder.',
        security,
        parameters: [
          { name: 'folder', in: 'query', schema: { type: 'string', default: '' }, description: 'Subfolder to browse (e.g. stock code)' },
        ],
        responses: {
          200: { description: 'File listing', content: { 'application/json': { example: { success: true, files: [{ name: 'report.pdf', size: 1024000, modified: '2025-01-01T00:00:00.000Z' }], totalFiles: 10, totalSize: 50000000, totalSizeFormatted: '50 MB' } } } },
          ...errResponses,
        },
      },
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
      detail: {
        tags: ['Files'],
        summary: 'Download a file',
        description: 'Serve a downloaded file from the server storage. Returns the raw file content.',
        security,
        parameters: [
          { name: 'path', in: 'query', required: true, schema: { type: 'string' }, description: 'Relative file path within the disclosure storage' },
        ],
        responses: {
          200: { description: 'File content (binary)' },
          404: { description: 'File not found' },
          ...errResponses,
        },
      },
    })

    .delete('/file', async ({ query, request, set }) => {
      if (!isAdmin(request)) {
        set.status = 401;
        return { success: false, error: 'Admin key required', statusCode: 401 };
      }
      try {
        const fullPath = downloader.resolvePath(decodeURIComponent(query.path));
        const stat = await fs.stat(fullPath);
        if (stat.isDirectory()) await fs.rm(fullPath, { recursive: true });
        else await fs.unlink(fullPath);
        return { success: true, message: `Deleted: ${query.path}` };
      } catch (err: any) {
        const msg = err?.message || String(err);
        if (msg.includes('traversal') || msg.includes('ENOENT')) {
          return { success: false, error: msg, statusCode: 400 };
        }
        throw err;
      }
    }, {
      query: t.Object({ path: t.String() }),
      detail: {
        tags: ['Files'],
        summary: 'Delete a file',
        description: 'Delete a file or folder from the server storage. Requires X-Admin-Key header.',
        security: securityAdmin,
        parameters: [
          { name: 'path', in: 'query', required: true, schema: { type: 'string' }, description: 'Relative path to delete' },
        ],
        responses: {
          200: { description: 'File deleted', content: { 'application/json': { example: { success: true, message: 'Deleted: folder/file.pdf' } } } },
          400: { description: 'Invalid path or file not found' },
          401: { description: 'Admin key required' },
          ...errResponses,
        },
      },
    });
}
