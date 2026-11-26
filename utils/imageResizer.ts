export type OutputImageFormat = 'jpeg' | 'png' | 'webp';

export interface ResizePreset {
  id: string;
  label: string;
  width: number;
  height: number;
}

export const MAX_IMAGE_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
export const MIN_RESIZE_DIMENSION = 1;
export const MAX_RESIZE_DIMENSION = 8192;
export const MAX_RESIZE_PIXELS = 33_177_600; // ~33.2 MP (covers 8K 7680x4320 safely)
export const MAX_SOURCE_DECODE_PIXELS = 65_000_000; // 65 MP source decode cap
export const DEFAULT_RESIZE_QUALITY = 85;
export const DEFAULT_JPEG_BACKGROUND = '#FFFFFF';

export const RESIZE_PRESETS: ResizePreset[] = [
  { id: '256x256', label: '256 × 256', width: 256, height: 256 },
  { id: '512x512', label: '512 × 512', width: 512, height: 512 },
  { id: '800x600', label: '800 × 600', width: 800, height: 600 },
  { id: '1080x1080', label: '1080 × 1080', width: 1080, height: 1080 },
  { id: '1920x1080', label: '1920 × 1080', width: 1920, height: 1080 },
];

export const OUTPUT_FORMAT_META: Record<
  OutputImageFormat,
  {
    label: string;
    mimeType: string;
    extension: string;
    supportsQuality: boolean;
    preservesTransparency: boolean;
  }
> = {
  jpeg: {
    label: 'JPEG',
    mimeType: 'image/jpeg',
    extension: 'jpg',
    supportsQuality: true,
    preservesTransparency: false,
  },
  png: {
    label: 'PNG',
    mimeType: 'image/png',
    extension: 'png',
    supportsQuality: false,
    preservesTransparency: true,
  },
  webp: {
    label: 'WebP',
    mimeType: 'image/webp',
    extension: 'webp',
    supportsQuality: true,
    preservesTransparency: true,
  },
};

export type FileValidationResult =
  | { ok: true; detectedFormat: OutputImageFormat }
  | { ok: false; error: string };

export function validateImageFile(file: {
  name: string;
  type: string;
  size: number;
}): FileValidationResult {
  const mime = file.type.toLowerCase().trim();
  const extMatch = file.name.toLowerCase().match(/\.([a-z0-9]+)$/);
  const ext = extMatch ? extMatch[1] : '';

  let detectedFormat: OutputImageFormat | null = null;

  if (mime === 'image/jpeg' || mime === 'image/jpg') {
    detectedFormat = 'jpeg';
  } else if (mime === 'image/png') {
    detectedFormat = 'png';
  } else if (mime === 'image/webp') {
    detectedFormat = 'webp';
  } else if (!mime || mime === 'application/octet-stream') {
    if (ext === 'jpg' || ext === 'jpeg') {
      detectedFormat = 'jpeg';
    } else if (ext === 'png') {
      detectedFormat = 'png';
    } else if (ext === 'webp') {
      detectedFormat = 'webp';
    }
  }

  if (!detectedFormat) {
    return {
      ok: false,
      error:
        'Unsupported file format. Please upload a JPG/JPEG, PNG, or WebP image.',
    };
  }

  if (file.size <= 0) {
    return {
      ok: false,
      error: 'The selected image file appears to be empty.',
    };
  }

  if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
    return {
      ok: false,
      error: `Image exceeds the ${formatFileSize(
        MAX_IMAGE_FILE_SIZE_BYTES
      )} limit. Please choose a smaller file.`,
    };
  }

  return { ok: true, detectedFormat };
}

export function calculateLockedHeight(
  targetWidth: number,
  originalWidth: number,
  originalHeight: number
): number {
  if (
    !Number.isFinite(targetWidth) ||
    !Number.isFinite(originalWidth) ||
    !Number.isFinite(originalHeight) ||
    originalWidth <= 0 ||
    originalHeight <= 0
  ) {
    return MIN_RESIZE_DIMENSION;
  }
  const scaled = Math.round((targetWidth * originalHeight) / originalWidth);
  return Math.min(MAX_RESIZE_DIMENSION, Math.max(MIN_RESIZE_DIMENSION, scaled));
}

export function calculateLockedWidth(
  targetHeight: number,
  originalWidth: number,
  originalHeight: number
): number {
  if (
    !Number.isFinite(targetHeight) ||
    !Number.isFinite(originalWidth) ||
    !Number.isFinite(originalHeight) ||
    originalWidth <= 0 ||
    originalHeight <= 0
  ) {
    return MIN_RESIZE_DIMENSION;
  }
  const scaled = Math.round((targetHeight * originalWidth) / originalHeight);
  return Math.min(MAX_RESIZE_DIMENSION, Math.max(MIN_RESIZE_DIMENSION, scaled));
}

export type DimensionsValidationResult =
  | { ok: true; width: number; height: number }
  | { ok: false; error: string };

export function validateDimensions(
  rawWidth: number | string,
  rawHeight: number | string
): DimensionsValidationResult {
  const widthStr = String(rawWidth).trim();
  const heightStr = String(rawHeight).trim();

  if (!widthStr || !heightStr) {
    return {
      ok: false,
      error: 'Please enter both width and height in pixels.',
    };
  }

  const widthNum = Number(widthStr);
  const heightNum = Number(heightStr);

  if (!Number.isFinite(widthNum) || !Number.isFinite(heightNum)) {
    return {
      ok: false,
      error: 'Width and height must be valid numbers.',
    };
  }

  const width = Math.round(widthNum);
  const height = Math.round(heightNum);

  if (width < MIN_RESIZE_DIMENSION || height < MIN_RESIZE_DIMENSION) {
    return {
      ok: false,
      error: 'Width and height must be greater than 0 pixels.',
    };
  }

  if (width > MAX_RESIZE_DIMENSION || height > MAX_RESIZE_DIMENSION) {
    return {
      ok: false,
      error: `Dimensions cannot exceed ${MAX_RESIZE_DIMENSION.toLocaleString()} pixels.`,
    };
  }

  if (width * height > MAX_RESIZE_PIXELS) {
    const mp = ((width * height) / 1_000_000).toFixed(1);
    return {
      ok: false,
      error: `Target resolution (${width.toLocaleString()} × ${height.toLocaleString()}, ${mp} MP) exceeds the safe 33.2 MP browser memory limit. Please reduce width or height.`,
    };
  }

  return { ok: true, width, height };
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

export function formatSizeDelta(originalBytes: number, outputBytes: number): string {
  if (!Number.isFinite(originalBytes) || originalBytes <= 0) return '0%';
  const pct = Math.round(((outputBytes - originalBytes) / originalBytes) * 100);
  if (pct === 0) return '0% change';
  return pct < 0 ? `${pct}% smaller` : `+${pct}% larger`;
}

export function buildOutputFilename(
  originalName: string,
  width: number,
  height: number,
  format: OutputImageFormat
): string {
  const stripped = originalName
    .replace(/\.[^.]+$/, '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const baseName = stripped || 'image';
  const ext = OUTPUT_FORMAT_META[format].extension;
  return `${baseName}-${width}x${height}.${ext}`;
}

export interface LoadedImageMeta {
  objectUrl: string;
  width: number;
  height: number;
}

export function loadImageDimensions(file: File): Promise<LoadedImageMeta> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      if (img.naturalWidth <= 0 || img.naturalHeight <= 0) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('The uploaded image has invalid dimensions.'));
        return;
      }
      if (img.naturalWidth * img.naturalHeight > MAX_SOURCE_DECODE_PIXELS) {
        const mp = (
          (img.naturalWidth * img.naturalHeight) /
          1_000_000
        ).toFixed(1);
        URL.revokeObjectURL(objectUrl);
        reject(
          new Error(
            `Source image resolution (${img.naturalWidth.toLocaleString()} × ${img.naturalHeight.toLocaleString()}, ${mp} MP) exceeds the safe 65 MP browser decoding limit.`
          )
        );
        return;
      }
      resolve({
        objectUrl,
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(
        new Error(
          'Unable to decode this image file. It may be corrupted or unsupported by your browser.'
        )
      );
    };

    img.src = objectUrl;
  });
}

export interface ResizeImageParams {
  sourceUrl: string;
  width: number;
  height: number;
  format: OutputImageFormat;
  qualityPercent: number;
  backgroundColor: string;
}

export interface ResizedImageResult {
  blob: Blob;
  objectUrl: string;
  size: number;
  width: number;
  height: number;
  format: OutputImageFormat;
}

export function resizeImageOnCanvas(
  params: ResizeImageParams
): Promise<ResizedImageResult> {
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
      width < MIN_RESIZE_DIMENSION ||
      height < MIN_RESIZE_DIMENSION ||
      width > MAX_RESIZE_DIMENSION ||
      height > MAX_RESIZE_DIMENSION ||
      width * height > MAX_RESIZE_PIXELS
    ) {
      reject(
        new Error(
          `Target dimensions (${width} × ${height}) exceed safe browser canvas memory limits (max ${MAX_RESIZE_DIMENSION.toLocaleString()}px per side and 33.2 MP total).`
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
                  `Unable to encode output as ${meta.label}. Try selecting JPEG or PNG.`
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
            : new Error('An unexpected error occurred while resizing the image.')
        );
      }
    };

    img.onerror = () => {
      reject(new Error('Could not read the source image for resizing.'));
    };

    img.src = sourceUrl;
  });
}
