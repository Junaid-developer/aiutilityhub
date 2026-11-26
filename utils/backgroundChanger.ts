export type BackdropMode = 'color' | 'gradient' | 'image';
export type BackgroundFitMode = 'cover' | 'contain' | 'fill';
export type GradientDirection = 'diagonal' | 'vertical' | 'horizontal' | 'radial';

export interface SolidColorPreset {
  id: string;
  label: string;
  hex: string;
  isTransparent?: boolean;
}

export interface GradientPreset {
  id: string;
  label: string;
  startColor: string;
  endColor: string;
  direction: GradientDirection;
}

export interface DrawRectSpec {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

export interface BackdropConfig {
  mode: BackdropMode;
  solidColor: string;
  isTransparent: boolean;
  gradientStart: string;
  gradientEnd: string;
  gradientDirection: GradientDirection;
  customBgBitmap: CanvasImageSource | null;
  customBgWidth: number;
  customBgHeight: number;
  customBgFit: BackgroundFitMode;
  customBgFallbackColor: string;
}

export const SOLID_COLOR_PRESETS: SolidColorPreset[] = [
  { id: 'transparent', label: 'Transparent', hex: 'transparent', isTransparent: true },
  { id: 'white', label: 'White', hex: '#FFFFFF' },
  { id: 'black', label: 'Black', hex: '#000000' },
  { id: 'light-grey', label: 'Light Grey', hex: '#E5E7EB' },
  { id: 'beige', label: 'Beige', hex: '#EDE9DF' },
  { id: 'blue', label: 'Blue', hex: '#2563EB' },
  { id: 'green', label: 'Green', hex: '#173F35' },
  { id: 'pink', label: 'Pink', hex: '#EC4899' },
];

export const GRADIENT_PRESETS: GradientPreset[] = [
  {
    id: 'ivory-sage',
    label: 'Ivory & Sage',
    startColor: '#EDE9DF',
    endColor: '#C5D8CD',
    direction: 'diagonal',
  },
  {
    id: 'forest-depth',
    label: 'Forest Canopy',
    startColor: '#173F35',
    endColor: '#315D4D',
    direction: 'diagonal',
  },
  {
    id: 'warm-brass',
    label: 'Warm Sand',
    startColor: '#EDE9DF',
    endColor: '#D9B978',
    direction: 'diagonal',
  },
  {
    id: 'ocean-sky',
    label: 'Ocean Mist',
    startColor: '#0F4C81',
    endColor: '#7DD3FC',
    direction: 'vertical',
  },
  {
    id: 'blush-sunset',
    label: 'Blush Dusk',
    startColor: '#FDE68A',
    endColor: '#F472B6',
    direction: 'diagonal',
  },
  {
    id: 'midnight-slate',
    label: 'Midnight Slate',
    startColor: '#111827',
    endColor: '#374151',
    direction: 'radial',
  },
];

export function buildGradientCss(
  startColor: string,
  endColor: string,
  direction: GradientDirection
): string {
  switch (direction) {
    case 'vertical':
      return `linear-gradient(180deg, ${startColor} 0%, ${endColor} 100%)`;
    case 'horizontal':
      return `linear-gradient(90deg, ${startColor} 0%, ${endColor} 100%)`;
    case 'radial':
      return `radial-gradient(circle at center, ${startColor} 0%, ${endColor} 100%)`;
    case 'diagonal':
    default:
      return `linear-gradient(135deg, ${startColor} 0%, ${endColor} 100%)`;
  }
}

export function computeBackgroundDrawRect(
  bgWidth: number,
  bgHeight: number,
  targetWidth: number,
  targetHeight: number,
  fit: BackgroundFitMode
): DrawRectSpec {
  const safeBgW = Math.max(1, bgWidth);
  const safeBgH = Math.max(1, bgHeight);
  const safeTargetW = Math.max(1, targetWidth);
  const safeTargetH = Math.max(1, targetHeight);

  if (fit === 'fill') {
    return {
      sx: 0,
      sy: 0,
      sw: safeBgW,
      sh: safeBgH,
      dx: 0,
      dy: 0,
      dw: safeTargetW,
      dh: safeTargetH,
    };
  }

  const bgAspect = safeBgW / safeBgH;
  const targetAspect = safeTargetW / safeTargetH;

  if (fit === 'cover') {
    if (bgAspect > targetAspect) {
      // Background is wider than target -> crop left & right evenly
      const sw = safeBgH * targetAspect;
      const sx = (safeBgW - sw) / 2;
      return {
        sx,
        sy: 0,
        sw,
        sh: safeBgH,
        dx: 0,
        dy: 0,
        dw: safeTargetW,
        dh: safeTargetH,
      };
    }
    // Background is taller than target -> crop top & bottom evenly
    const sh = safeBgW / targetAspect;
    const sy = (safeBgH - sh) / 2;
    return {
      sx: 0,
      sy,
      sw: safeBgW,
      sh,
      dx: 0,
      dy: 0,
      dw: safeTargetW,
      dh: safeTargetH,
    };
  }

  // 'contain': draw entire background inside target bounds centered
  if (bgAspect > targetAspect) {
    const dw = safeTargetW;
    const dh = safeTargetW / bgAspect;
    const dy = (safeTargetH - dh) / 2;
    return {
      sx: 0,
      sy: 0,
      sw: safeBgW,
      sh: safeBgH,
      dx: 0,
      dy,
      dw,
      dh,
    };
  }

  const dh = safeTargetH;
  const dw = safeTargetH * bgAspect;
  const dx = (safeTargetW - dw) / 2;
  return {
    sx: 0,
    sy: 0,
    sw: safeBgW,
    sh: safeBgH,
    dx,
    dy: 0,
    dw,
    dh,
  };
}

export function buildBackgroundChangedFilename(
  originalName: string,
  backdropMode: BackdropMode,
  isTransparent: boolean,
  ext: 'png' | 'jpg'
): string {
  const trimmed = originalName.trim();
  const base = trimmed.replace(/\.[^.]+$/, '') || 'image';

  const suffix =
    backdropMode === 'color' && isTransparent
      ? 'transparent-background'
      : backdropMode === 'gradient'
        ? 'gradient-background'
        : backdropMode === 'image'
          ? 'custom-background'
          : 'new-background';

  return `${base}-${suffix}.${ext}`;
}

export function renderBackdropToCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  backdrop: BackdropConfig
): void {
  ctx.clearRect(0, 0, width, height);

  if (backdrop.mode === 'color') {
    if (backdrop.isTransparent) {
      return;
    }
    ctx.fillStyle = backdrop.solidColor || '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    return;
  }

  if (backdrop.mode === 'gradient') {
    if (backdrop.gradientDirection === 'radial') {
      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.hypot(width, height) / 2;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      grad.addColorStop(0, backdrop.gradientStart);
      grad.addColorStop(1, backdrop.gradientEnd);
      ctx.fillStyle = grad;
    } else {
      let x0 = 0;
      let y0 = 0;
      let x1 = width;
      let y1 = height;
      if (backdrop.gradientDirection === 'vertical') {
        x0 = 0;
        y0 = 0;
        x1 = 0;
        y1 = height;
      } else if (backdrop.gradientDirection === 'horizontal') {
        x0 = 0;
        y0 = 0;
        x1 = width;
        y1 = 0;
      }
      const grad = ctx.createLinearGradient(x0, y0, x1, y1);
      grad.addColorStop(0, backdrop.gradientStart);
      grad.addColorStop(1, backdrop.gradientEnd);
      ctx.fillStyle = grad;
    }
    ctx.fillRect(0, 0, width, height);
    return;
  }

  // Custom Image Mode
  if (backdrop.customBgBitmap && backdrop.customBgWidth > 0 && backdrop.customBgHeight > 0) {
    if (backdrop.customBgFit === 'contain') {
      ctx.fillStyle = backdrop.customBgFallbackColor || '#EDE9DF';
      ctx.fillRect(0, 0, width, height);
    }
    const rect = computeBackgroundDrawRect(
      backdrop.customBgWidth,
      backdrop.customBgHeight,
      width,
      height,
      backdrop.customBgFit
    );
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      backdrop.customBgBitmap,
      rect.sx,
      rect.sy,
      rect.sw,
      rect.sh,
      rect.dx,
      rect.dy,
      rect.dw,
      rect.dh
    );
    return;
  }

  // Neutral fallback when custom image tab is active prior to uploading a backdrop image
  ctx.fillStyle = backdrop.customBgFallbackColor || '#EDE9DF';
  ctx.fillRect(0, 0, width, height);
}

export async function composeForegroundWithBackdrop(
  foregroundCanvas: HTMLCanvasElement,
  backdrop: BackdropConfig,
  outputMime: 'image/png' | 'image/jpeg',
  jpegQuality = 0.92
): Promise<Blob> {
  const width = foregroundCanvas.width;
  const height = foregroundCanvas.height;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = width;
  outCanvas.height = height;
  const ctx = outCanvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context is unavailable.');
  }

  // JPEG cannot encode alpha; ensure opaque base if exporting JPEG
  if (outputMime === 'image/jpeg' && backdrop.mode === 'color' && backdrop.isTransparent) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
  } else {
    renderBackdropToCanvas(ctx, width, height, backdrop);
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(foregroundCanvas, 0, 0, width, height);

  return new Promise<Blob>((resolve, reject) => {
    outCanvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to encode composed output image.'));
          return;
        }
        resolve(blob);
      },
      outputMime,
      outputMime === 'image/jpeg' ? jpegQuality : undefined
    );
  });
}

export function createCanvasFromImageData(imageData: ImageData): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context is unavailable.');
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}
