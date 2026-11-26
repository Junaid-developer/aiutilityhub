import * as ort from 'onnxruntime-web/wasm';
import type {
  WorkerOutboundMessage,
  WorkerRemoveRequest,
} from '../workers/backgroundRemoval.worker';
import {
  formatFileSize,
  MAX_IMAGE_FILE_SIZE_BYTES,
  validateImageFile,
} from './imageResizer';
import {
  loadSegmentationModelBytes,
  MAX_BG_REMOVAL_DIMENSION,
  MAX_BG_REMOVAL_PIXELS,
  ModelLoadProgress,
  normalizeMaskFloatToUint8,
  rgbaToNchwFloat32,
  SegmentationModelSpec,
  validateBackgroundRemovalDimensions,
} from './onnxSegmentation';

export type BackgroundRemovalProgress = ModelLoadProgress;

export interface RefinementOptions {
  edgeFeather: number;
  refineHair: boolean;
}

export interface AlphaMaskStats {
  transparentPixels: number;
  semiTransparentPixels: number;
  opaquePixels: number;
  totalPixels: number;
  transparentPercent: number;
}

export interface BackgroundRemovalRawResult {
  rawPngBlob: Blob;
  usedWorker: boolean;
  durationMs: number;
  modelName: string;
  fromCache: boolean;
}

export interface LoadedImageSource {
  file: File;
  objectUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
  formatLabel: string;
}

export interface ClassifiedBackgroundRemovalError {
  userMessage: string;
  diagnosticDetail: string;
  canRetry: boolean;
}

export function buildBackgroundRemovedFilename(originalName: string): string {
  const trimmed = originalName.trim();
  const base = trimmed.replace(/\.[^.]+$/, '') || 'image';
  return `${base}-background-removed.png`;
}

export function validateBackgroundRemovalFile(file: {
  name: string;
  type: string;
  size: number;
}) {
  return validateImageFile(file);
}

export function formatImageFileSize(bytes: number): string {
  return formatFileSize(bytes);
}

export function classifyBackgroundRemovalError(
  err: unknown
): ClassifiedBackgroundRemovalError {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  const lower = raw.toLowerCase();

  if (raw.startsWith('MODEL_DOWNLOAD_FAILED:')) {
    const detail = raw.slice('MODEL_DOWNLOAD_FAILED:'.length).trim();
    return {
      userMessage:
        'Unable to download the AI segmentation model from public model hosts (Hugging Face & IMG.LY). Check your network connection or disable strict CDN/ad blockers, then click Retry.',
      diagnosticDetail: detail,
      canRetry: true,
    };
  }

  if (raw.startsWith('WASM_INIT_FAILED:')) {
    const detail = raw.slice('WASM_INIT_FAILED:'.length).trim();
    return {
      userMessage:
        'Local ONNX WebAssembly engine failed to initialize in this browser context. Please verify WebAssembly is enabled and try again.',
      diagnosticDetail: detail,
      canRetry: true,
    };
  }

  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('http 4') ||
    lower.includes('http 5') ||
    lower.includes('net::')
  ) {
    return {
      userMessage:
        'Network request failed while loading AI model assets. Please check your connection and try again.',
      diagnosticDetail: raw,
      canRetry: true,
    };
  }

  if (
    lower.includes('webassembly') ||
    lower.includes('offscreencanvas') ||
    lower.includes('createimagebitmap') ||
    lower.includes('typedarray not supported')
  ) {
    return {
      userMessage:
        'Your browser does not support required local AI features (WebAssembly / Canvas / ImageBitmap). Please use a modern Chrome, Edge, Firefox, or Safari browser.',
      diagnosticDetail: raw,
      canRetry: false,
    };
  }

  if (
    lower.includes('out of memory') ||
    lower.includes('oom') ||
    lower.includes('allocation') ||
    lower.includes('rangeerror')
  ) {
    return {
      userMessage:
        'This image exceeds available browser memory during AI segmentation. Try closing unused tabs or resizing the image first.',
      diagnosticDetail: raw,
      canRetry: true,
    };
  }

  if (
    lower.includes('invalid format') ||
    lower.includes('decode') ||
    lower.includes('corrupt')
  ) {
    return {
      userMessage:
        'Unable to decode this image file. Please verify it is a valid JPG, PNG, or WebP photo.',
      diagnosticDetail: raw,
      canRetry: false,
    };
  }

  return {
    userMessage: raw
      ? `Background removal failed: ${raw}`
      : 'An unexpected error occurred while removing the image background.',
    diagnosticDetail: raw,
    canRetry: true,
  };
}

/**
 * Pure pixel-level refinement operating strictly on an immutable copy of the raw
 * AI RGBA output so repeated slider/toggle changes never degrade the original
 * segmentation mask.
 */
export function refineCutoutRgbaPixels(
  rawRgba: Uint8ClampedArray,
  width: number,
  height: number,
  options: RefinementOptions
): { data: Uint8ClampedArray; stats: AlphaMaskStats } {
  const totalPixels = width * height;
  const out = new Uint8ClampedArray(rawRgba);

  const featherRadius = Math.max(0, Math.min(8, Math.round(options.edgeFeather)));

  const baseAlpha = new Uint8Array(totalPixels);
  for (let i = 0; i < totalPixels; i += 1) {
    let a = rawRgba[i * 4 + 3];
    if (!options.refineHair) {
      if (a <= 28) {
        a = 0;
      } else if (a >= 225) {
        a = 255;
      } else {
        const t = (a - 28) / (225 - 28);
        a = Math.round(t * t * (3 - 2 * t) * 255);
      }
    }
    baseAlpha[i] = a;
  }

  let finalAlpha = baseAlpha;
  if (featherRadius > 0) {
    const horiz = new Float32Array(totalPixels);
    const vert = new Uint8Array(totalPixels);
    const windowSize = featherRadius * 2 + 1;

    for (let y = 0; y < height; y += 1) {
      const rowOffset = y * width;
      let sum = 0;
      for (let dx = -featherRadius; dx <= featherRadius; dx += 1) {
        const clampedX = Math.max(0, Math.min(width - 1, dx));
        sum += baseAlpha[rowOffset + clampedX];
      }
      for (let x = 0; x < width; x += 1) {
        horiz[rowOffset + x] = sum / windowSize;
        const removeX = Math.max(0, x - featherRadius);
        const addX = Math.min(width - 1, x + featherRadius + 1);
        sum += baseAlpha[rowOffset + addX] - baseAlpha[rowOffset + removeX];
      }
    }

    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let dy = -featherRadius; dy <= featherRadius; dy += 1) {
        const clampedY = Math.max(0, Math.min(height - 1, dy));
        sum += horiz[clampedY * width + x];
      }
      for (let y = 0; y < height; y += 1) {
        const idx = y * width + x;
        const blurredVal = Math.round(sum / windowSize);
        vert[idx] = Math.min(baseAlpha[idx], blurredVal);
        const removeY = Math.max(0, y - featherRadius);
        const addY = Math.min(height - 1, y + featherRadius + 1);
        sum += horiz[addY * width + x] - horiz[removeY * width + x];
      }
    }

    finalAlpha = vert;
  }

  let transparentPixels = 0;
  let semiTransparentPixels = 0;
  let opaquePixels = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      const p = idx * 4;
      const a = finalAlpha[idx];
      out[p + 3] = a;

      if (a === 0) {
        transparentPixels += 1;
        out[p] = 0;
        out[p + 1] = 0;
        out[p + 2] = 0;
      } else if (a >= 245) {
        opaquePixels += 1;
      } else {
        semiTransparentPixels += 1;
        if (options.refineHair) {
          let rSum = 0;
          let gSum = 0;
          let bSum = 0;
          let count = 0;
          for (let dy = -2; dy <= 2; dy += 1) {
            const ny = y + dy;
            if (ny < 0 || ny >= height) continue;
            for (let dx = -2; dx <= 2; dx += 1) {
              const nx = x + dx;
              if (nx < 0 || nx >= width) continue;
              const nIdx = ny * width + nx;
              if (baseAlpha[nIdx] >= 240) {
                const np = nIdx * 4;
                rSum += rawRgba[np];
                gSum += rawRgba[np + 1];
                bSum += rawRgba[np + 2];
                count += 1;
              }
            }
          }
          if (count > 0) {
            const blend = 0.55;
            const nr = rSum / count;
            const ng = gSum / count;
            const nb = bSum / count;
            out[p] = Math.round(rawRgba[p] * (1 - blend) + nr * blend);
            out[p + 1] = Math.round(rawRgba[p + 1] * (1 - blend) + ng * blend);
            out[p + 2] = Math.round(rawRgba[p + 2] * (1 - blend) + nb * blend);
          }
        }
      }
    }
  }

  return {
    data: out,
    stats: {
      transparentPixels,
      semiTransparentPixels,
      opaquePixels,
      totalPixels,
      transparentPercent:
        totalPixels > 0
          ? Math.round((transparentPixels / totalPixels) * 1000) / 10
          : 0,
    },
  };
}

export async function decodePngBlobToImageData(blob: Blob): Promise<ImageData> {
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context is unavailable.');
    }
    ctx.drawImage(bitmap, 0, 0);
    return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

export async function encodeImageDataToPngBlob(
  imageData: ImageData
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context is unavailable.');
  }
  ctx.putImageData(imageData, 0, 0);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to encode transparent PNG output.'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
}

export async function loadUploadedImageForRemoval(
  file: File
): Promise<LoadedImageSource> {
  const validation = validateBackgroundRemovalFile(file);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () =>
        reject(
          new Error(
            'Unable to decode this image. Please upload a valid JPG, PNG, or WebP file.'
          )
        );
      el.src = objectUrl;
    });

    const dimCheck = validateBackgroundRemovalDimensions(
      img.naturalWidth,
      img.naturalHeight
    );
    if (!dimCheck.ok) {
      throw new Error(dimCheck.error);
    }

    return {
      file,
      objectUrl,
      width: img.naturalWidth,
      height: img.naturalHeight,
      sizeBytes: file.size,
      formatLabel: validation.detectedFormat.toUpperCase(),
    };
  } catch (err) {
    URL.revokeObjectURL(objectUrl);
    throw err;
  }
}

// Persistent Worker & Main-Thread session cache to avoid duplicate model downloads
let persistentWorker: Worker | null = null;
let workerBusy = false;

let mainThreadSession: ort.InferenceSession | null = null;
let mainThreadSpec: SegmentationModelSpec | null = null;

function disposeWorker() {
  if (persistentWorker) {
    persistentWorker.terminate();
    persistentWorker = null;
  }
  workerBusy = false;
}

function runInPersistentWorker(
  imageBlob: Blob,
  onProgress?: (progress: BackgroundRemovalProgress) => void
): Promise<{ pngBlob: Blob; modelName: string; fromCache: boolean }> {
  return new Promise((resolve, reject) => {
    if (
      typeof Worker === 'undefined' ||
      typeof OffscreenCanvas === 'undefined'
    ) {
      reject(new Error('WORKER_UNSUPPORTED'));
      return;
    }

    if (workerBusy) {
      disposeWorker();
    }

    if (!persistentWorker) {
      try {
        persistentWorker = new Worker(
          new URL('../workers/backgroundRemoval.worker.ts', import.meta.url),
          { type: 'module' }
        );
      } catch {
        reject(new Error('WORKER_UNSUPPORTED'));
        return;
      }
    }

    const worker = persistentWorker;
    const requestId = Date.now() + Math.floor(Math.random() * 1000);
    let settled = false;
    workerBusy = true;

    const detach = () => {
      worker.onmessage = null;
      worker.onerror = null;
      workerBusy = false;
    };

    worker.onmessage = (event: MessageEvent<WorkerOutboundMessage>) => {
      const msg = event.data;
      if (!msg || msg.id !== requestId) return;

      if (msg.type === 'progress') {
        onProgress?.(msg.progress);
      } else if (msg.type === 'result') {
        settled = true;
        detach();
        resolve({
          pngBlob: new Blob([msg.pngBuffer], { type: 'image/png' }),
          modelName: msg.modelName,
          fromCache: msg.fromCache,
        });
      } else if (msg.type === 'error') {
        settled = true;
        detach();
        reject(new Error(msg.message));
      }
    };

    worker.onerror = (ev) => {
      if (settled) return;
      settled = true;
      detach();
      disposeWorker();
      reject(
        new Error(
          ev.message ? `WORKER_ERROR:${ev.message}` : 'WORKER_UNSUPPORTED'
        )
      );
    };

    const payload: WorkerRemoveRequest = {
      id: requestId,
      imageBlob,
      origin: window.location.origin,
    };
    worker.postMessage(payload);
  });
}

async function runOnMainThread(
  imageBlob: Blob,
  onProgress?: (progress: BackgroundRemovalProgress) => void
): Promise<{ pngBlob: Blob; modelName: string; fromCache: boolean }> {
  const origin = window.location.origin;
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  ort.env.wasm.wasmPaths = {
    mjs: new URL('/ort-wasm/ort-wasm-simd-threaded.mjs', origin).href,
    wasm: new URL('/ort-wasm/ort-wasm-simd-threaded.wasm', origin).href,
  };

  let session = mainThreadSession;
  let spec = mainThreadSpec;
  let fromCache = true;

  if (!session || !spec) {
    const loaded = await loadSegmentationModelBytes(onProgress);
    spec = loaded.spec;
    fromCache = loaded.fromCache;

    onProgress?.({
      phase: 'processing',
      percent: 38,
      statusText: 'Initializing local ONNX WebAssembly engine...',
      detailText: `Preparing ${spec.displayName}`,
    });

    try {
      session = await ort.InferenceSession.create(loaded.bytes, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });
      mainThreadSession = session;
      mainThreadSpec = spec;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`WASM_INIT_FAILED: ${msg}`);
    }
  }

  onProgress?.({
    phase: 'processing',
    percent: 55,
    statusText: 'Detecting subject & removing background...',
    detailText: `Running ${spec.displayName} locally (${spec.inputSize}×${spec.inputSize})`,
  });

  const bitmap = await createImageBitmap(imageBlob);
  try {
    const origW = bitmap.width;
    const origH = bitmap.height;

    const dimCheck = validateBackgroundRemovalDimensions(origW, origH);
    if (!dimCheck.ok) {
      throw new Error(dimCheck.error);
    }

    const origCanvas = document.createElement('canvas');
    origCanvas.width = origW;
    origCanvas.height = origH;
    const origCtx = origCanvas.getContext('2d');
    if (!origCtx) throw new Error('Canvas 2D context is unavailable.');
    origCtx.drawImage(bitmap, 0, 0);
    const origImageData = origCtx.getImageData(0, 0, origW, origH);

    const inputSize = spec.inputSize;
    const modelCanvas = document.createElement('canvas');
    modelCanvas.width = inputSize;
    modelCanvas.height = inputSize;
    const modelCtx = modelCanvas.getContext('2d');
    if (!modelCtx) throw new Error('Canvas 2D context is unavailable.');
    modelCtx.imageSmoothingEnabled = true;
    modelCtx.imageSmoothingQuality = 'high';
    modelCtx.drawImage(bitmap, 0, 0, inputSize, inputSize);
    const resizedData = modelCtx.getImageData(0, 0, inputSize, inputSize);

    const nchw = rgbaToNchwFloat32(
      resizedData.data,
      inputSize,
      spec.mean,
      spec.std
    );
    const inputName = session.inputNames[0] ?? 'input';
    const outputName = session.outputNames[0] ?? 'output';
    const inputTensor = new ort.Tensor('float32', nchw, [
      1,
      3,
      inputSize,
      inputSize,
    ]);

    const outputs = await session.run({ [inputName]: inputTensor });
    const rawMask = outputs[outputName].data as Float32Array;
    const maskAlpha = normalizeMaskFloatToUint8(rawMask);

    onProgress?.({
      phase: 'processing',
      percent: 90,
      statusText: 'Applying transparency mask at full resolution...',
      detailText: `Compositing ${origW} × ${origH} alpha PNG`,
    });

    const maskRgba = new Uint8ClampedArray(inputSize * inputSize * 4);
    for (let i = 0; i < inputSize * inputSize; i += 1) {
      const p = i * 4;
      maskRgba[p] = 255;
      maskRgba[p + 1] = 255;
      maskRgba[p + 2] = 255;
      maskRgba[p + 3] = maskAlpha[i];
    }
    modelCtx.putImageData(
      new ImageData(maskRgba, inputSize, inputSize),
      0,
      0
    );

    const scaledCanvas = document.createElement('canvas');
    scaledCanvas.width = origW;
    scaledCanvas.height = origH;
    const scaledCtx = scaledCanvas.getContext('2d');
    if (!scaledCtx) throw new Error('Canvas 2D context is unavailable.');
    scaledCtx.imageSmoothingEnabled = true;
    scaledCtx.imageSmoothingQuality = 'high';
    scaledCtx.drawImage(modelCanvas, 0, 0, origW, origH);
    const scaledData = scaledCtx.getImageData(0, 0, origW, origH).data;

    for (let i = 0; i < origW * origH; i += 1) {
      origImageData.data[i * 4 + 3] = scaledData[i * 4 + 3];
    }
    origCtx.putImageData(origImageData, 0, 0);

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      origCanvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('PNG encoding failed.'))),
        'image/png'
      );
    });

    return {
      pngBlob,
      modelName: spec.displayName,
      fromCache,
    };
  } finally {
    bitmap.close();
  }
}

export async function removeBackgroundInBrowser(
  imageBlob: Blob,
  options?: {
    onProgress?: (progress: BackgroundRemovalProgress) => void;
  }
): Promise<BackgroundRemovalRawResult> {
  const start = performance.now();

  if (typeof WebAssembly === 'undefined') {
    throw new Error(
      'WebAssembly is required to run local AI background removal in your browser.'
    );
  }

  try {
    const res = await runInPersistentWorker(imageBlob, options?.onProgress);
    return {
      rawPngBlob: res.pngBlob,
      usedWorker: true,
      durationMs: Math.round(performance.now() - start),
      modelName: res.modelName,
      fromCache: res.fromCache,
    };
  } catch (workerErr) {
    const msg = workerErr instanceof Error ? workerErr.message : '';
    const lower = msg.toLowerCase();

    // Only fall back to main thread for Worker/OffscreenCanvas/WASM-in-worker quirks,
    // never mask genuine MODEL_DOWNLOAD_FAILED (already retried across all mirrors).
    const canFallback =
      !msg.startsWith('MODEL_DOWNLOAD_FAILED:') &&
      (msg === 'WORKER_UNSUPPORTED' ||
        msg.startsWith('WORKER_ERROR:') ||
        msg.startsWith('WASM_INIT_FAILED:') ||
        lower.includes('offscreencanvas') ||
        lower.includes('document') ||
        lower.includes('window'));

    if (!canFallback) {
      throw workerErr;
    }

    const res = await runOnMainThread(imageBlob, options?.onProgress);
    return {
      rawPngBlob: res.pngBlob,
      usedWorker: false,
      durationMs: Math.round(performance.now() - start),
      modelName: res.modelName,
      fromCache: res.fromCache,
    };
  }
}

export function disposeBackgroundRemovalResources() {
  disposeWorker();
}

export {
  MAX_BG_REMOVAL_DIMENSION,
  MAX_BG_REMOVAL_PIXELS,
  MAX_IMAGE_FILE_SIZE_BYTES,
  validateBackgroundRemovalDimensions,
};
