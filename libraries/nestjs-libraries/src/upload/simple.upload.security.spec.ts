jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn().mockResolvedValue({ ext: 'png', mime: 'image/png' }) }));
const send = jest.fn().mockResolvedValue({});
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: class { send = send; middlewareStack = { add: jest.fn() }; },
  PutObjectCommand: class { constructor(public input: any) {} },
}));
jest.mock('@aws-sdk/lib-storage', () => ({ Upload: jest.fn() }));
import { mkdtempSync, rmSync, readdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { LocalStorage } from './local.storage';
import { CloudflareStorage } from './cloudflare.storage';

describe.each(['local', 'r2'])('uploadSimple %s security', provider => {
  let dir: string;
  let storage: LocalStorage | CloudflareStorage;
  const originalFetch = global.fetch;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'pd-simple-upload-'));
    storage = provider === 'local' ? new LocalStorage(dir) : new CloudflareStorage('account', 'access', 'secret-test', 'auto', 'bucket', 'https://media.example');
    send.mockClear();
    global.fetch = jest.fn();
  });
  afterEach(() => { global.fetch = originalFetch; rmSync(dir, { recursive: true, force: true }); });
  it('rejects a public URL redirecting to loopback before following it', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://127.0.0.1/private' } }));
    await expect(storage.uploadSimple('https://8.8.8.8/image')).rejects.toThrow();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();
    expect(readdirSync(dir)).toEqual([]);
  });
  it('caps actual streamed bytes without relying on content length', async () => {
    const cancel = jest.fn();
    const body = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(10 * 1024 * 1024)); c.enqueue(new Uint8Array(1)); }, cancel });
    (global.fetch as jest.Mock).mockResolvedValue(new Response(body));
    await expect(storage.uploadSimple('https://8.8.8.8/image')).rejects.toThrow(/10 MB/);
    expect(cancel).toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(readdirSync(dir)).toEqual([]);
  });
  it('rejects failed downloads instead of storing their response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(new Response('not found', { status: 404 }));
    await expect(storage.uploadSimple('https://8.8.8.8/image')).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
  });
  it('still stores valid downloaded bytes', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(new Response(new Uint8Array([137,80,78,71])));
    await expect(storage.uploadSimple('https://8.8.8.8/image')).resolves.toMatch(/\.png$/);
  });
  it('rejects a data URL whose decoded bytes exceed the same cap', async () => {
    const data = 'data:image/png;base64,' + Buffer.alloc(10 * 1024 * 1024 + 1).toString('base64');
    await expect(storage.uploadSimple(data)).rejects.toThrow(/10 MB/);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});
