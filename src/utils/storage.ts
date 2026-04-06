// Simple JSON file persistence

import { promises as fs } from 'fs';
import { join } from 'path';

export async function loadJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return fallback;
  }
}

export async function saveJson<T>(filePath: string, data: T): Promise<void> {
  const dir = join(filePath, '..');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}
