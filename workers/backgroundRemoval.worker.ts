import * as ort from 'onnxruntime-web/wasm';
import {
  loadSegmentationModelBytes,
  ModelLoadProgress,
  normalizeMaskFloatToUint8,
  rgbaToNchwFloat32,
  SegmentationModelSpec,
  validateBackgroundRemovalDimensions,
} from '../utils/onnxSegmentation';

export interface WorkerRemoveRequest {
  id: number;
  imageBlob: Blob;
  origin: string;
}

export type WorkerOutboundMessage =
  | {
      id: number;
      type: 'progress';
      progress: ModelLoadProgress;
    }
  | {
      id: number;
      type: 'result';
      pngBuffer: ArrayBuffer;
      modelName: string;
      fromCache: boolean;
    }
  | {
      id: number;
      type: 'error';
      message: string;
    };

let cachedSession: ort.InferenceSession | null = null;
let cachedSpec: SegmentationModelSpec | null = null;
let wasmConfiguredOrigin: string | null = null;

function ensureLocalWasmPaths(origin: string) {
  if (wasmConfiguredOrigin === origin) return;
  const baseOrigin = origin || self.location.origin;
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  ort.env.wasm.wasmPaths = {
    mjs: new URL('/ort-wasm/ort-wasm-simd-threaded.mjs', baseOrigin).href,
    wasm: new URL('/ort-wasm/ort-wasm-simd-threaded.wasm', baseOrigin).href,
  };
  wasmConfiguredOrigin = origin;
}

async function getOrCreateSession(
  origin: string,
  onProgress: (progress: ModelLoadProgress) => void
): Promise<{
  session: ort.InferenceSession;
  spec: SegmentationModelSpec;
  fromCache: boolean;
}> {
  ensureLocalWasmPaths(origin);

  if (cachedSession && cachedSpec) {
    onProgress({
      phase: 'processing',
      percent: 25,
      statusText: `Using active ${cachedSpec.displayName} session...`,
      detailText: 'Model already initialized in browser memory',
    });
    return {
      session: cachedSession,
      spec: cachedSpec,
      fromCache: true,
    };
  }

  const loaded = await loadSegmentationModelBytes(onProgress);

  onProgress({
    phase: 'processing',
    percent: 38,
    statusText: 'Initializing local ONNX WebAssembly engine...',
    detailText: `Preparing ${loaded.spec.displayName}`,
  });

  try {
    const session = await ort.InferenceSession.create(loaded.bytes, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });
    cachedSession = session;
    cachedSpec = loaded.spec;
    return {
      session,
      spec: loaded.spec,
      fromCache: loaded.fromCache,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`WASM_INIT_FAILED: ${msg}`);
  }
}

const ctx = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRemoveRequest>) => void) | null;
  postMessage: (
    message: WorkerOutboundMessage,
    transfer?: Transferable[]
  ) => void;
};

ctx.onmessage = async (event: MessageEvent<WorkerRemoveRequest>) => {
  const { id, imageBlob, origin } = event.data;

  const sendProgress = (progress: ModelLoadProgress) => {
    ctx.postMessage({ id, type: 'progress', progress });
  };

  try {
    const { session, spec, fromCache } = await getOrCreateSession(
      origin,
      sendProgress
    );

    sendProgress({
      phase: 'processing',
      percent: 50,
      statusText: 'Decoding image for AI segmentation...',
      detailText: 'Preparing full-resolution canvas pixels',
    });

    const bitmap = await createImageBitmap(imageBlob);
    const origW = bitmap.width;
    const origH = bitmap.height;

    try {
      const dimCheck = validateBackgroundRemovalDimensions(origW, origH);
      if (!dimCheck.ok) {
        throw new Error(dimCheck.error);
      }

      const origCanvas = new OffscreenCanvas(origW, origH);
      const origCtx = origCanvas.getContext('2d');
      if (!origCtx) {
        throw new Error('OffscreenCanvas 2D context is unavailable.');
      }
      origCtx.drawImage(bitmap, 0, 0);
      const origImageData = origCtx.getImageData(0, 0, origW, origH);

      const inputSize = spec.inputSize;
      const modelCanvas = new OffscreenCanvas(inputSize, inputSize);
      const modelCtx = modelCanvas.getContext('2d');
      if (!modelCtx) {
        throw new Error('OffscreenCanvas 2D context is unavailable.');
      }
      modelCtx.imageSmoothingEnabled = true;
      modelCtx.imageSmoothingQuality = 'high';
      modelCtx.drawImage(bitmap, 0, 0, inputSize, inputSize);
      const resizedData = modelCtx.getImageData(0, 0, inputSize, inputSize);

      sendProgress({
        phase: 'processing',
        percent: 68,
        statusText: 'Detecting subject & removing background...',
        detailText: `Running ${spec.displayName} locally (${inputSize}×${inputSize})`,
      });

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
      const outTensor = outputs[outputName];
      const rawMask = outTensor.data as Float32Array;
      const maskAlpha = normalizeMaskFloatToUint8(rawMask);

      sendProgress({
        phase: 'processing',
        percent: 88,
        statusText: 'Applying transparency mask at full resolution...',
        detailText: `Compositing ${origW} × ${origH} alpha PNG`,
      });

      // Draw 1024x1024 alpha into modelCanvas and rescale hardware-accelerated back to origW x origH
      const maskRgba = new Uint8ClampedArray(inputSize * inputSize * 4);
      for (let i = 0; i < inputSize * inputSize; i += 1) {
        const p = i * 4;
        const a = maskAlpha[i];
        maskRgba[p] = 255;
        maskRgba[p + 1] = 255;
        maskRgba[p + 2] = 255;
        maskRgba[p + 3] = a;
      }
      modelCtx.putImageData(
        new ImageData(maskRgba, inputSize, inputSize),
        0,
        0
      );

      const scaledMaskCanvas = new OffscreenCanvas(origW, origH);
      const scaledMaskCtx = scaledMaskCanvas.getContext('2d');
      if (!scaledMaskCtx) {
        throw new Error('OffscreenCanvas 2D context is unavailable.');
      }
      scaledMaskCtx.imageSmoothingEnabled = true;
      scaledMaskCtx.imageSmoothingQuality = 'high';
      scaledMaskCtx.drawImage(modelCanvas, 0, 0, origW, origH);
      const scaledMaskData = scaledMaskCtx.getImageData(0, 0, origW, origH).data;

      const totalPixels = origW * origH;
      for (let i = 0; i < totalPixels; i += 1) {
        origImageData.data[i * 4 + 3] = scaledMaskData[i * 4 + 3];
      }
      origCtx.putImageData(origImageData, 0, 0);

      const pngBlob = await origCanvas.convertToBlob({
        type: 'image/png',
        quality: 1,
      });
      const pngBuffer = await pngBlob.arrayBuffer();

      sendProgress({
        phase: 'processing',
        percent: 100,
        statusText: 'Background removed cleanly',
        detailText: 'Encoding transparent PNG output',
      });

      ctx.postMessage(
        {
          id,
          type: 'result',
          pngBuffer,
          modelName: spec.displayName,
          fromCache,
        },
        [pngBuffer]
      );
    } finally {
      bitmap.close();
    }
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : 'Unexpected failure in background removal worker.';
    ctx.postMessage({
      id,
      type: 'error',
      message,
    });
  }
};
