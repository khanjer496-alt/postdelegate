import { ssrfSafeFetch } from '@gitroom/nestjs-libraries/dtos/webhooks/ssrf.safe.dispatcher';
import { parseDataUrl } from './data.url';

const MAX_BYTES = 10 * 1024 * 1024;
const tooLarge = () => new Error('Upload exceeds 10 MB.');

export async function simpleUploadBody(value: string): Promise<Buffer> {
  // Bound decoding too: percent-encoded bytes can take three characters each.
  if (value.startsWith('data:') && value.length > MAX_BYTES * 3 + 1024) throw tooLarge();
  const data = value.startsWith('data:') ? parseDataUrl(value) : null;
  if (data) {
    if (data.buffer.length > MAX_BYTES) throw tooLarge();
    return data.buffer;
  }
  const response = await ssrfSafeFetch(value);
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error('Unable to download the file.');
  }
  if (Number(response.headers.get('content-length')) > MAX_BYTES) {
    await response.body?.cancel().catch(() => undefined);
    throw tooLarge();
  }
  const reader = response.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value: chunk } = await reader.read();
      if (done) break;
      size += chunk.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw tooLarge();
      }
      chunks.push(Buffer.from(chunk));
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks, size);
}
