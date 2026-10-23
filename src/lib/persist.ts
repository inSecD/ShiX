const KEY = 'shix.save.v1';

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function gzip(text: string): Promise<string> {
  if (typeof CompressionStream === 'undefined') throw new Error('no compression');
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  const buf = await new Response(stream).arrayBuffer();
  return bytesToBase64(new Uint8Array(buf));
}

async function gunzip(b64: string): Promise<string> {
  const raw = base64ToBytes(b64);
  const buf = new ArrayBuffer(raw.length);
  new Uint8Array(buf).set(raw);
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
  return await new Response(stream).text();
}

export async function saveState(data: unknown): Promise<boolean> {
  try {
    const text = JSON.stringify(data);
    let payload = text;
    try {
      payload = 'gz:' + (await gzip(text));
    } catch {
      payload = 'raw:' + text;
    }
    localStorage.setItem(KEY, payload);
    return true;
  } catch (e) {
    console.warn('[shix] save gagal', e);
    return false;
  }
}

export async function loadState<T>(): Promise<T | null> {
  try {
    const payload = localStorage.getItem(KEY);
    if (!payload) return null;
    if (payload.startsWith('gz:')) {
      const text = await gunzip(payload.slice(3));
      return JSON.parse(text) as T;
    }
    if (payload.startsWith('raw:')) return JSON.parse(payload.slice(4)) as T;
    return null;
  } catch (e) {
    console.warn('[shix] load gagal', e);
    return null;
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function saveSize(): number {
  try {
    return localStorage.getItem(KEY)?.length ?? 0;
  } catch {
    return 0;
  }
}
