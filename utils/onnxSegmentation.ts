export type SegmentationModelId = 'rmbg-1.4' | 'isnet-quint8' | 'modnet';

export interface SegmentationModelSpec {
  id: SegmentationModelId;
  displayName: string;
  inputSize: number;
  mean: [number, number, number];
  std: [number, number, number];
  expectedBytes: number;
  url: string;
}

export const MAX_BG_REMOVAL_PIXELS = 25_000_000; // 25 MP safe AI RGBA buffer cap
export const MAX_BG_REMOVAL_DIMENSION = 8000;

export function validateBackgroundRemovalDimensions(
  width: number,
  height: number
): { ok: true } | { ok: false; error: string } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return {
      ok: false,
      error: 'The uploaded image has invalid dimensions.',
    };
  }
  if (width > MAX_BG_REMOVAL_DIMENSION || height > MAX_BG_REMOVAL_DIMENSION) {
    return {
      ok: false,
      error: `Image dimensions (${width.toLocaleString()} × ${height.toLocaleString()} px) exceed the ${MAX_BG_REMOVAL_DIMENSION.toLocaleString()} px per-side AI memory limit. Please resize it first using the Image Resizer tool.`,
    };
  }
  if (width * height > MAX_BG_REMOVAL_PIXELS) {
    const mp = ((width * height) / 1_000_000).toFixed(1);
    return {
      ok: false,
      error: `Image resolution (${width.toLocaleString()} × ${height.toLocaleString()}, ${mp} MP) exceeds the safe 25 MP browser AI memory limit. Please resize it below 25 MP using the Image Resizer tool or choose another photo.`,
    };
  }
  return { ok: true };
}

export const MODEL_CACHE_NAME = 'ai-utility-hub-bg-models-v1';
const IMGLY_CDN_BASE =
  'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/';

export const SEGMENTATION_MODELS: SegmentationModelSpec[] = [
  {
    id: 'rmbg-1.4',
    displayName: 'BRIA RMBG-1.4 (IS-Net Quantized)',
    inputSize: 1024,
    mean: [127.5, 127.5, 127.5],
    std: [255, 255, 255],
    expectedBytes: 44_403_226,
    url: 'https://huggingface.co/briaai/RMBG-1.4/resolve/main/onnx/model_quantized.onnx',
  },
  {
    id: 'isnet-quint8',
    displayName: 'IMG.LY IS-Net (Quantized)',
    inputSize: 1024,
    mean: [128, 128, 128],
    std: [256, 256, 256],
    expectedBytes: 44_348_940,
    url: `${IMGLY_CDN_BASE}resources.json`,
  },
  {
    id: 'modnet',
    displayName: 'MODNet (Lightweight Portrait)',
    inputSize: 512,
    mean: [127.5, 127.5, 127.5],
    std: [127.5, 127.5, 127.5],
    expectedBytes: 6_632_188,
    url: 'https://huggingface.co/Xenova/modnet/resolve/main/onnx/model_quantized.onnx',
  },
];

export interface ModelLoadProgress {
  phase: 'downloading' | 'processing';
  percent: number;
  statusText: string;
  detailText: string;
}

export interface LoadedModelPayload {
  spec: SegmentationModelSpec;
  bytes: Uint8Array;
  fromCache: boolean;
}

async function readCachedModel(
  spec: SegmentationModelSpec
): Promise<Uint8Array | null> {
  if (typeof caches === 'undefined') return null;
  try {
    const cache = await caches.open(MODEL_CACHE_NAME);
    const match = await cache.match(spec.url);
    if (!match || !match.ok) return null;
    const buf = await match.arrayBuffer();
    if (buf.byteLength < 500_000) return null;
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

async function writeCachedModel(
  spec: SegmentationModelSpec,
  bytes: Uint8Array
): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    const cache = await caches.open(MODEL_CACHE_NAME);
    const copy = bytes.slice();
    const response = new Response(copy.buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(copy.byteLength),
      },
    });
    await cache.put(spec.url, response);
  } catch {
    // Ignore storage quota or private-browsing cache restrictions
  }
}

async function fetchWithRetry(
  url: string,
  attempts = 2
): Promise<Response> {
  let lastErr: unknown = null;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} (${res.statusText || 'error'})`);
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (i + 1 < attempts) {
        await new Promise((r) => setTimeout(r, 450 * (i + 1)));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function streamSingleOnnxFile(
  spec: SegmentationModelSpec,
  onProgress?: (progress: ModelLoadProgress) => void
): Promise<Uint8Array> {
  const response = await fetchWithRetry(spec.url, 2);
  const headerLen = Number(response.headers.get('content-length') ?? 0);
  const totalBytes = headerLen > 0 ? headerLen : spec.expectedBytes;

  if (!response.body) {
    const buf = new Uint8Array(await response.arrayBuffer());
    onProgress?.({
      phase: 'downloading',
      percent: 100,
      statusText: `Downloaded ${spec.displayName}`,
      detailText: `${(buf.byteLength / (1024 * 1024)).toFixed(1)} MB ready`,
    });
    return buf;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value && value.byteLength > 0) {
      chunks.push(value);
      received += value.byteLength;
      const pct = Math.min(
        99,
        Math.round((received / Math.max(totalBytes, 1)) * 100)
      );
      const gotMb = (received / (1024 * 1024)).toFixed(1);
      const totMb = (totalBytes / (1024 * 1024)).toFixed(1);
      onProgress?.({
        phase: 'downloading',
        percent: pct,
        statusText: `Downloading ${spec.displayName} (first-time setup)...`,
        detailText: `${pct}% · ${gotMb} MB / ${totMb} MB (cached in browser after download)`,
      });
    }
  }

  const combined = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  if (combined.byteLength < 500_000) {
    throw new Error(
      `Incomplete model payload (${combined.byteLength} bytes received).`
    );
  }

  return combined;
}

interface ImglyResourceEntry {
  size: number;
  chunks: Array<{ name: string; offsets: [number, number] }>;
}

async function fetchImglyChunkedModel(
  spec: SegmentationModelSpec,
  onProgress?: (progress: ModelLoadProgress) => void
): Promise<Uint8Array> {
  const resMapResp = await fetchWithRetry(spec.url, 2);
  const resMap = (await resMapResp.json()) as Record<
    string,
    ImglyResourceEntry
  >;
  const entry = resMap['/models/isnet_quint8'];
  if (!entry || !Array.isArray(entry.chunks) || entry.chunks.length === 0) {
    throw new Error('Model manifest entry /models/isnet_quint8 not found.');
  }

  const totalBytes = entry.size || spec.expectedBytes;
  const result = new Uint8Array(totalBytes);
  let downloaded = 0;
  let writeOffset = 0;

  // Fetch sequentially in small batches (2 at a time) to avoid CDN connection resets
  for (let i = 0; i < entry.chunks.length; i += 2) {
    const batch = entry.chunks.slice(i, i + 2);
    const buffers = await Promise.all(
      batch.map(async (chunk) => {
        const chunkUrl = new URL(chunk.name, IMGLY_CDN_BASE).toString();
        const resp = await fetchWithRetry(chunkUrl, 2);
        const buf = new Uint8Array(await resp.arrayBuffer());
        const expectedLen = chunk.offsets[1] - chunk.offsets[0];
        if (buf.byteLength !== expectedLen) {
          throw new Error(
            `Chunk size mismatch (${buf.byteLength} vs ${expectedLen})`
          );
        }
        downloaded += buf.byteLength;
        const pct = Math.min(
          99,
          Math.round((downloaded / Math.max(totalBytes, 1)) * 100)
        );
        onProgress?.({
          phase: 'downloading',
          percent: pct,
          statusText: `Downloading ${spec.displayName} (fallback mirror)...`,
          detailText: `${pct}% · ${(downloaded / (1024 * 1024)).toFixed(
            1
          )} MB / ${(totalBytes / (1024 * 1024)).toFixed(1)} MB`,
        });
        return buf;
      })
    );

    for (const buf of buffers) {
      result.set(buf, writeOffset);
      writeOffset += buf.byteLength;
    }
  }

  return result.subarray(0, writeOffset);
}

export async function loadSegmentationModelBytes(
  onProgress?: (progress: ModelLoadProgress) => void
): Promise<LoadedModelPayload> {
  // 1. Check CacheStorage across any known model before using network
  for (const spec of SEGMENTATION_MODELS) {
    const cached = await readCachedModel(spec);
    if (cached) {
      onProgress?.({
        phase: 'processing',
        percent: 20,
        statusText: `Loaded ${spec.displayName} from browser cache`,
        detailText: `${(cached.byteLength / (1024 * 1024)).toFixed(
          1
        )} MB cached locally · Zero download needed`,
      });
      return { spec, bytes: cached, fromCache: true };
    }
  }

  // 2. Try model sources in priority order with retries & detailed diagnostics
  const errors: string[] = [];

  for (const spec of SEGMENTATION_MODELS) {
    try {
      const bytes =
        spec.id === 'isnet-quint8'
          ? await fetchImglyChunkedModel(spec, onProgress)
          : await streamSingleOnnxFile(spec, onProgress);

      await writeCachedModel(spec, bytes);
      return { spec, bytes, fromCache: false };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      errors.push(`${spec.id} (${new URL(spec.url).hostname}): ${reason}`);
    }
  }

  throw new Error(`MODEL_DOWNLOAD_FAILED: ${errors.join(' | ')}`);
}

/**
 * Converts RGBA pixel buffer (already resized to targetSize x targetSize)
 * into planar NCHW Float32Array [1, 3, targetSize, targetSize].
 */
export function rgbaToNchwFloat32(
  rgba: Uint8ClampedArray | Uint8Array,
  size: number,
  mean: [number, number, number],
  std: [number, number, number]
): Float32Array {
  const stride = size * size;
  const tensorData = new Float32Array(3 * stride);
  const [m0, m1, m2] = mean;
  const [s0, s1, s2] = std;

  for (let i = 0; i < stride; i += 1) {
    const p = i * 4;
    tensorData[i] = (rgba[p] - m0) / s0;
    tensorData[stride + i] = (rgba[p + 1] - m1) / s1;
    tensorData[2 * stride + i] = (rgba[p + 2] - m2) / s2;
  }

  return tensorData;
}

/**
 * Converts raw ONNX alpha output values (Float32Array of size*size) into
 * clamped 0..255 uint8 alpha bytes. If model predictions fall outside [0, 1],
 * falls back to min-max normalization cleanly.
 */
export function normalizeMaskFloatToUint8(maskData: Float32Array): Uint8Array {
  const out = new Uint8Array(maskData.length);
  let min = Infinity;
  let max = -Infinity;

  for (let i = 0; i < maskData.length; i += 1) {
    const v = maskData[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }

  const alreadyProbability = min >= -0.05 && max <= 1.05;
  const span = max - min;

  for (let i = 0; i < maskData.length; i += 1) {
    let prob: number;
    if (alreadyProbability) {
      prob = Math.max(0, Math.min(1, maskData[i]));
    } else if (span > 1e-5) {
      prob = (maskData[i] - min) / span;
    } else {
      prob = 1;
    }
    out[i] = Math.round(prob * 255);
  }

  return out;
}

/**
 * Resizes a single-channel 0..255 mask bilinearly when running without DOM canvas
 * (e.g., in Node tests). In browser/worker, OffscreenCanvas/Canvas performs
 * hardware-accelerated bilinear scaling.
 */
export function resizeAlphaBilinear(
  srcAlpha: Uint8Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
): Uint8Array {
  if (srcW === dstW && srcH === dstH) return srcAlpha;
  const dst = new Uint8Array(dstW * dstH);
  const scaleX = srcW / dstW;
  const scaleY = srcH / dstH;

  for (let y = 0; y < dstH; y += 1) {
    const sy = Math.min(srcH - 1, Math.max(0, y * scaleY));
    const y0 = Math.floor(sy);
    const y1 = Math.min(srcH - 1, y0 + 1);
    const dy = sy - y0;

    for (let x = 0; x < dstW; x += 1) {
      const sx = Math.min(srcW - 1, Math.max(0, x * scaleX));
      const x0 = Math.floor(sx);
      const x1 = Math.min(srcW - 1, x0 + 1);
      const dx = sx - x0;

      const p00 = srcAlpha[y0 * srcW + x0];
      const p10 = srcAlpha[y0 * srcW + x1];
      const p01 = srcAlpha[y1 * srcW + x0];
      const p11 = srcAlpha[y1 * srcW + x1];

      const v =
        (1 - dx) * (1 - dy) * p00 +
        dx * (1 - dy) * p10 +
        (1 - dx) * dy * p01 +
        dx * dy * p11;
      dst[y * dstW + x] = Math.round(v);
    }
  }

  return dst;
}
