import {
  DEFAULT_JPEG_BACKGROUND,
  MAX_RESIZE_PIXELS,
  OUTPUT_FORMAT_META,
  OutputImageFormat,
} from './imageResizer';

export type CompressionPresetId = 'low' | 'medium' | 'high' | 'custom';
export type CompressorOutputChoice = 'original' | OutputImageFormat;

export interface CompressionLevelPreset {
  id: Exclude<CompressionPresetId, 'custom'>;
  label: string;
  description: string;
  quality: number;
}

export const DEFAULT_COMPRESSION_QUALITY = 80;

export const COMPRESSION_LEVELS: CompressionLevelPreset[] = [
  {
    id: 'low',
    label: 'Low Compression',
    description: 'Better image quality',
    quality: 90,
  },
  {
    id: 'medium',
    label: 'Medium Compression',
    description: 'Balanced quality and file size',
    quality: 80,
  },
  {
    id: 'high',
    label: 'High Compression',
    description: 'Smaller file size',
    quality: 60,
  },
];

export function getCompressionPresetForQuality(
  quality: number
): CompressionPresetId {
  const match = COMPRESSION_LEVELS.find((lvl) => lvl.quality === quality);
  return match ? match.id : 'custom';
}

export function resolveEffectiveFormat(
  choice: CompressorOutputChoice,
  sourceFormat: OutputImageFormat
): OutputImageFormat {
  return choice === 'original' ? sourceFormat : choice;
}

export interface CompressionStats {
  deltaBytes: number;
  percentChange: number;
  outcome: 'reduced' | 'unchanged' | 'increased';
  summaryLabel: string;
}

export function calculateCompressionStats(
  originalBytes: number,
  compressedBytes: number
): CompressionStats {
  if (!Number.isFinite(originalBytes) || originalBytes <= 0) {
    return {
      deltaBytes: 0,
      percentChange: 0,
      outcome: 'unchanged',
      summaryLabel: '0% change',
    };
  }

  const deltaBytes = compressedBytes - originalBytes;
  const rawPct = (deltaBytes / originalBytes) * 100;
  const percentChange = Number(rawPct.toFixed(1));

  if (deltaBytes < 0) {
    return {
      deltaBytes,
      percentChange,
      outcome: 'reduced',
      summaryLabel: `${Math.abs(percentChange).toFixed(1)}% smaller`,
    };
  }

  if (deltaBytes > 0) {
    return {
      deltaBytes,
      percentChange,
      outcome: 'increased',
      summaryLabel: `+${percentChange.toFixed(1)}% larger`,
    };
  }

  return {
    deltaBytes: 0,
    percentChange: 0,
    outcome: 'unchanged',
    summaryLabel: '0% change',
  };
}

export function buildCompressedFilename(
  originalName: string,
  format: OutputImageFormat,
  qualityPercent: number
): string {
  const stripped = originalName
    .replace(/\.[^.]+$/, '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const baseName = stripped || 'image';
  const meta = OUTPUT_FORMAT_META[format];
  const qualitySuffix = meta.supportsQuality ? `-q${qualityPercent}` : '';
  return `${baseName}-compressed${qualitySuffix}.${meta.extension}`;
}

export function detectImageTransparency(
  sourceUrl: string,
  width: number,
  height: number
): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const maxScan = 256;
        const scale = Math.min(1, maxScan / Math.max(width, height, 1));
        const scanW = Math.max(1, Math.round(width * scale));
        const scanH = Math.max(1, Math.round(height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = scanW;
        canvas.height = scanH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(false);
          return;
        }

        ctx.clearRect(0, 0, scanW, scanH);
        ctx.drawImage(img, 0, 0, scanW, scanH);
        const { data } = ctx.getImageData(0, 0, scanW, scanH);
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] < 255) {
            resolve(true);
            return;
          }
        }
        resolve(false);
      } catch {
        resolve(false);
      }
    };
    img.onerror = () => resolve(false);
    img.src = sourceUrl;
  });
}

export interface CompressImageParams {
  sourceUrl: string;
  width: number;
  height: number;
  format: OutputImageFormat;
  qualityPercent: number;
  backgroundColor: string;
}

export interface CompressedImageResult {
  blob: Blob;
  objectUrl: string;
  size: number;
  width: number;
  height: number;
  format: OutputImageFormat;
}

export function compressImageOnCanvas(
  params: CompressImageParams
): Promise<CompressedImageResult> {
  const {
    sourceUrl,
    width,
    height,
    format,
    qualityPercent,
    backgroundColor,
  } = params;

  return new Promise((resolve, reject) => {
    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= 0 ||
      height <= 0 ||
      width * height > MAX_RESIZE_PIXELS
    ) {
      const mp = ((width * height) / 1_000_000).toFixed(1);
      reject(
        new Error(
          `Image resolution (${width.toLocaleString()} × ${height.toLocaleString()}, ${mp} MP) exceeds the safe 33.2 MP browser canvas memory limit. Please resize it below 33.2 MP first.`
        )
      );
      return;
    }

    const img = new Image();

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Browser canvas context is unavailable.'));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        if (format === 'jpeg') {
          ctx.fillStyle = backgroundColor || DEFAULT_JPEG_BACKGROUND;
          ctx.fillRect(0, 0, width, height);
        } else {
          ctx.clearRect(0, 0, width, height);
        }

        ctx.drawImage(img, 0, 0, width, height);

        const meta = OUTPUT_FORMAT_META[format];
        const qualityRatio = meta.supportsQuality
          ? Math.min(1, Math.max(0.1, qualityPercent / 100))
          : undefined;

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(
                new Error(
                  `Unable to encode image as ${meta.label}. Try selecting JPEG or WebP.`
                )
              );
              return;
            }
            const objectUrl = URL.createObjectURL(blob);
            resolve({
              blob,
              objectUrl,
              size: blob.size,
              width,
              height,
              format,
            });
          },
          meta.mimeType,
          qualityRatio
        );
      } catch (err) {
        reject(
          err instanceof Error
            ? err
            : new Error(
                'An unexpected error occurred while compressing the image.'
              )
        );
      }
    };

    img.onerror = () => {
      reject(new Error('Could not read the source image for compression.'));
    };

    img.src = sourceUrl;
  });
}
