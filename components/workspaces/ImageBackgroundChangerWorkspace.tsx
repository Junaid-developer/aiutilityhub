import {
  AlertCircle,
  CheckCircle2,
  Columns2,
  Download,
  Image as ImageIcon,
  Loader2,
  Palette,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackdropConfig,
  BackdropMode,
  BackgroundFitMode,
  buildBackgroundChangedFilename,
  buildGradientCss,
  composeForegroundWithBackdrop,
  createCanvasFromImageData,
  GRADIENT_PRESETS,
  GradientDirection,
  SOLID_COLOR_PRESETS,
} from '../../utils/backgroundChanger';
import {
  BackgroundRemovalProgress,
  ClassifiedBackgroundRemovalError,
  classifyBackgroundRemovalError,
  decodePngBlobToImageData,
  disposeBackgroundRemovalResources,
  formatImageFileSize,
  LoadedImageSource,
  loadUploadedImageForRemoval,
  MAX_IMAGE_FILE_SIZE_BYTES,
  refineCutoutRgbaPixels,
  removeBackgroundInBrowser,
} from '../../utils/backgroundRemoval';

type ComparisonViewMode = 'side-by-side' | 'split';

interface SegmentedForeground {
  file: File;
  cutoutCanvas: HTMLCanvasElement;
  width: number;
  height: number;
  transparentPercent: number;
  modelName: string;
  fromCache: boolean;
  durationMs: number;
}

interface LoadedCustomBackdrop {
  file: File;
  objectUrl: string;
  bitmap: ImageBitmap;
  width: number;
  height: number;
}

const CHECKERBOARD_BG =
  'bg-[linear-gradient(45deg,rgba(104,115,109,0.16)_25%,transparent_25%),linear-gradient(-45deg,rgba(104,115,109,0.16)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,rgba(104,115,109,0.16)_75%),linear-gradient(-45deg,transparent_75%,rgba(104,115,109,0.16)_75%)] bg-[length:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0]';

export function ImageBackgroundChangerWorkspace() {
  const fgInputRef = useRef<HTMLInputElement | null>(null);
  const bgInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);
  const processingTokenRef = useRef(0);
  const fgUrlRef = useRef<string | null>(null);
  const bgUrlRef = useRef<string | null>(null);
  const bgBitmapRef = useRef<ImageBitmap | null>(null);
  const composedPreviewUrlRef = useRef<string | null>(null);
  const isProcessingRef = useRef(false);

  const [isDragging, setIsDragging] = useState(false);
  const [foregroundSource, setForegroundSource] =
    useState<LoadedImageSource | null>(null);
  const [segmentedForeground, setSegmentedForeground] =
    useState<SegmentedForeground | null>(null);

  const [backdropMode, setBackdropMode] = useState<BackdropMode>('color');
  const [solidColor, setSolidColor] = useState('#EDE9DF');
  const [isTransparentBg, setIsTransparentBg] = useState(false);

  const [selectedGradientId, setSelectedGradientId] = useState<string>(
    GRADIENT_PRESETS[0].id
  );
  const [gradientStart, setGradientStart] = useState(
    GRADIENT_PRESETS[0].startColor
  );
  const [gradientEnd, setGradientEnd] = useState(GRADIENT_PRESETS[0].endColor);
  const [gradientDirection, setGradientDirection] =
    useState<GradientDirection>(GRADIENT_PRESETS[0].direction);

  const [customBackdrop, setCustomBackdrop] =
    useState<LoadedCustomBackdrop | null>(null);
  const [customBgFit, setCustomBgFit] = useState<BackgroundFitMode>('cover');

  const [comparisonMode, setComparisonMode] =
    useState<ComparisonViewMode>('side-by-side');
  const [splitPosition, setSplitPosition] = useState(50);

  const [composedPreviewUrl, setComposedPreviewUrl] = useState<string | null>(
    null
  );
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<BackgroundRemovalProgress | null>(
    null
  );
  const [errorInfo, setErrorInfo] =
    useState<ClassifiedBackgroundRemovalError | null>(null);

  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  const revokeFgUrl = useCallback(() => {
    if (fgUrlRef.current) {
      URL.revokeObjectURL(fgUrlRef.current);
      fgUrlRef.current = null;
    }
  }, []);

  const revokeBgUrl = useCallback(() => {
    if (bgUrlRef.current) {
      URL.revokeObjectURL(bgUrlRef.current);
      bgUrlRef.current = null;
    }
    if (bgBitmapRef.current) {
      bgBitmapRef.current.close();
      bgBitmapRef.current = null;
    }
  }, []);

  const revokeComposedUrl = useCallback(() => {
    if (composedPreviewUrlRef.current) {
      URL.revokeObjectURL(composedPreviewUrlRef.current);
      composedPreviewUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      processingTokenRef.current += 1;
      if (isProcessingRef.current) {
        disposeBackgroundRemovalResources();
      }
      revokeFgUrl();
      revokeBgUrl();
      revokeComposedUrl();
    };
  }, [revokeBgUrl, revokeComposedUrl, revokeFgUrl]);

  const buildActiveBackdropConfig = useCallback((): BackdropConfig => {
    return {
      mode: backdropMode,
      solidColor,
      isTransparent: backdropMode === 'color' && isTransparentBg,
      gradientStart,
      gradientEnd,
      gradientDirection,
      customBgBitmap: customBackdrop?.bitmap ?? null,
      customBgWidth: customBackdrop?.width ?? 0,
      customBgHeight: customBackdrop?.height ?? 0,
      customBgFit,
      customBgFallbackColor: '#EDE9DF',
    };
  }, [
    backdropMode,
    customBackdrop,
    customBgFit,
    gradientDirection,
    gradientEnd,
    gradientStart,
    isTransparentBg,
    solidColor,
  ]);

  // Live composition whenever segmented foreground OR any backdrop option changes
  // — executes purely on Canvas without repeating AI segmentation.
  useEffect(() => {
    if (!segmentedForeground) {
      revokeComposedUrl();
      setComposedPreviewUrl(null);
      return;
    }

    let cancelled = false;
    const config = buildActiveBackdropConfig();

    const timer = window.setTimeout(async () => {
      try {
        const blob = await composeForegroundWithBackdrop(
          segmentedForeground.cutoutCanvas,
          config,
          'image/png'
        );
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        revokeComposedUrl();
        composedPreviewUrlRef.current = url;
        setComposedPreviewUrl(url);
      } catch (err) {
        if (!cancelled) {
          setErrorInfo(classifyBackgroundRemovalError(err));
        }
      }
    }, 30);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [buildActiveBackdropConfig, revokeComposedUrl, segmentedForeground]);

  const runSegmentation = useCallback(
    async (source: LoadedImageSource) => {
      const token = ++processingTokenRef.current;
      setErrorInfo(null);
      setIsProcessing(true);
      setProgress({
        phase: 'downloading',
        percent: 5,
        statusText: 'Checking cached AI segmentation model...',
        detailText: 'Reusing local browser model when available',
      });

      try {
        const result = await removeBackgroundInBrowser(source.file, {
          onProgress: (p) => {
            if (token === processingTokenRef.current) {
              setProgress(p);
            }
          },
        });

        if (token !== processingTokenRef.current) return;

        const rawImageData = await decodePngBlobToImageData(result.rawPngBlob);
        if (token !== processingTokenRef.current) return;

        // Mild edge color decontamination so subject looks clean on dark or bright backdrops
        const refined = refineCutoutRgbaPixels(
          rawImageData.data,
          rawImageData.width,
          rawImageData.height,
          { edgeFeather: 0, refineHair: true }
        );

        const cutoutImageData = new ImageData(
          new Uint8ClampedArray(refined.data),
          rawImageData.width,
          rawImageData.height
        );
        const cutoutCanvas = createCanvasFromImageData(cutoutImageData);

        setSegmentedForeground({
          file: source.file,
          cutoutCanvas,
          width: rawImageData.width,
          height: rawImageData.height,
          transparentPercent: refined.stats.transparentPercent,
          modelName: result.modelName,
          fromCache: result.fromCache,
          durationMs: result.durationMs,
        });
      } catch (err) {
        if (token === processingTokenRef.current) {
          setErrorInfo(classifyBackgroundRemovalError(err));
        }
      } finally {
        if (token === processingTokenRef.current) {
          setIsProcessing(false);
          setProgress(null);
        }
      }
    },
    []
  );

  const handleSelectedForeground = useCallback(
    async (file: File) => {
      if (isProcessing) return;
      setErrorInfo(null);
      setIsReadingFile(true);

      try {
        const loaded = await loadUploadedImageForRemoval(file);
        processingTokenRef.current += 1;
        setSegmentedForeground(null);
        revokeComposedUrl();
        setComposedPreviewUrl(null);
        revokeFgUrl();
        fgUrlRef.current = loaded.objectUrl;
        setForegroundSource(loaded);
        setComparisonMode('side-by-side');
        setSplitPosition(50);
      } catch (err) {
        setErrorInfo({
          userMessage:
            err instanceof Error
              ? err.message
              : 'Unable to load the selected foreground image.',
          diagnosticDetail: '',
          canRetry: false,
        });
      } finally {
        setIsReadingFile(false);
      }
    },
    [isProcessing, revokeComposedUrl, revokeFgUrl]
  );

  const handleSelectedBackground = async (file: File) => {
    setErrorInfo(null);
    try {
      const loaded = await loadUploadedImageForRemoval(file);
      const bitmap = await createImageBitmap(file);
      revokeBgUrl();
      bgUrlRef.current = loaded.objectUrl;
      bgBitmapRef.current = bitmap;
      setCustomBackdrop({
        file,
        objectUrl: loaded.objectUrl,
        bitmap,
        width: loaded.width,
        height: loaded.height,
      });
      setBackdropMode('image');
    } catch (err) {
      setErrorInfo({
        userMessage:
          err instanceof Error
            ? err.message
            : 'Unable to load the custom background image.',
        diagnosticDetail: '',
        canRetry: false,
      });
    }
  };

  const handleForegroundInputChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) {
      void handleSelectedForeground(file);
    }
  };

  const handleBackgroundInputChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) {
      void handleSelectedBackground(file);
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (isProcessing) return;
    dragDepthRef.current += 1;
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = isProcessing ? 'none' : 'copy';
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragging(false);
    if (isProcessing) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleSelectedForeground(file);
    }
  };

  const handleApplyBackgroundClick = () => {
    if (!foregroundSource || isProcessing) {
      if (!foregroundSource) {
        setErrorInfo({
          userMessage: 'Please upload a foreground subject image first.',
          diagnosticDetail: '',
          canRetry: false,
        });
      }
      return;
    }

    // Avoid repeatedly running AI segmentation on the exact same foreground file
    if (segmentedForeground && segmentedForeground.file === foregroundSource.file) {
      return;
    }

    void runSegmentation(foregroundSource);
  };

  const handleDownload = async (format: 'png' | 'jpg') => {
    if (!segmentedForeground || isProcessing || isExporting) return;

    if (format === 'jpg' && backdropMode === 'color' && isTransparentBg) {
      return;
    }

    setErrorInfo(null);
    setIsExporting(true);
    try {
      const config = buildActiveBackdropConfig();
      const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
      const blob = await composeForegroundWithBackdrop(
        segmentedForeground.cutoutCanvas,
        config,
        mime,
        0.92
      );
      const url = URL.createObjectURL(blob);
      const filename = buildBackgroundChangedFilename(
        segmentedForeground.file.name,
        backdropMode,
        isTransparentBg,
        format
      );

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setErrorInfo(classifyBackgroundRemovalError(err));
    } finally {
      setIsExporting(false);
    }
  };

  const handleRemoveForeground = () => {
    if (isProcessing) return;
    processingTokenRef.current += 1;
    setSegmentedForeground(null);
    revokeComposedUrl();
    setComposedPreviewUrl(null);
    revokeFgUrl();
    setForegroundSource(null);
    setErrorInfo(null);
  };

  const handleResetAll = () => {
    if (isProcessing) return;
    processingTokenRef.current += 1;
    setSegmentedForeground(null);
    revokeComposedUrl();
    setComposedPreviewUrl(null);
    revokeFgUrl();
    setForegroundSource(null);
    revokeBgUrl();
    setCustomBackdrop(null);
    setBackdropMode('color');
    setSolidColor('#EDE9DF');
    setIsTransparentBg(false);
    setSelectedGradientId(GRADIENT_PRESETS[0].id);
    setGradientStart(GRADIENT_PRESETS[0].startColor);
    setGradientEnd(GRADIENT_PRESETS[0].endColor);
    setGradientDirection(GRADIENT_PRESETS[0].direction);
    setCustomBgFit('cover');
    setComparisonMode('side-by-side');
    setSplitPosition(50);
    setErrorInfo(null);
  };

  const previewBackdropStyle =
    backdropMode === 'color'
      ? isTransparentBg
        ? undefined
        : { backgroundColor: solidColor }
      : backdropMode === 'gradient'
        ? {
            backgroundImage: buildGradientCss(
              gradientStart,
              gradientEnd,
              gradientDirection
            ),
          }
        : undefined;

  const isCurrentForegroundSegmented = Boolean(
    segmentedForeground &&
      foregroundSource &&
      segmentedForeground.file === foregroundSource.file
  );

  const isTransparentSelected = backdropMode === 'color' && isTransparentBg;

  return (
    <div className="rounded-[18px] border border-[#DCDDD3] bg-white p-5 shadow-[0_2px_10px_-3px_rgba(23,63,53,0.06)] sm:p-8 dark:border-[#35463E] dark:bg-[#24332C] dark:shadow-[0_2px_10px_-3px_rgba(0,0,0,0.24)]">
      <input
        ref={fgInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        onChange={handleForegroundInputChange}
        className="sr-only"
        aria-label="Upload foreground subject image"
      />
      <input
        ref={bgInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        onChange={handleBackgroundInputChange}
        className="sr-only"
        aria-label="Upload custom background image"
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left: Foreground Upload, Progress & Before/After Preview */}
        <div className="space-y-6 lg:col-span-7">
          {!foregroundSource ? (
            <div
              role="region"
              aria-label="Foreground image upload dropzone"
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`flex min-h-[210px] flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-9 text-center transition-colors ${
                isDragging
                  ? 'border-[#173F35] bg-[#E3EAE4]/60 dark:border-[#D9B978] dark:bg-[#30483C]/50'
                  : 'border-[#DCDDD3] bg-[#EDE9DF]/45 hover:border-[#C49A58] dark:border-[#35463E] dark:bg-[#17231F]/60 dark:hover:border-[#D9B978]'
              }`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#173F35] text-[#EDE9DF] dark:bg-[#315D4D] dark:text-[#F2F0E9]">
                <UploadCloud className="h-6 w-6" aria-hidden="true" />
              </div>
              <p className="mt-4 font-display text-lg font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                Upload a foreground subject image
              </p>
              <p className="mt-1.5 max-w-sm text-sm text-[#56615B] dark:text-[#B9C5BD]">
                Drag &amp; drop or browse JPG, JPEG, PNG, or WebP photos (up to{' '}
                {formatImageFileSize(MAX_IMAGE_FILE_SIZE_BYTES)} / 25 MP). Swap
                in a solid color, gradient, or custom backdrop locally.
              </p>
              <button
                type="button"
                onClick={() => fgInputRef.current?.click()}
                disabled={isReadingFile || isProcessing}
                className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#173F35] px-5 py-2.5 text-sm font-semibold text-[#F2F0E9] transition-colors hover:bg-[#173F35]/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C49A58] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#315D4D] dark:hover:bg-[#315D4D]/90"
              >
                {isReadingFile ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ImageIcon className="h-4 w-4" aria-hidden="true" />
                )}
                <span>
                  {isReadingFile ? 'Loading Image...' : 'Browse Foreground Image'}
                </span>
              </button>
            </div>
          ) : (
            <div
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 transition-colors ${
                isDragging
                  ? 'border-[#173F35] bg-[#E3EAE4]/60 dark:border-[#D9B978] dark:bg-[#30483C]/50'
                  : 'border-[#DCDDD3] bg-[#EDE9DF]/40 dark:border-[#35463E] dark:bg-[#17231F]/65'
              }`}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#E3EAE4] text-[#173F35] dark:bg-[#30483C] dark:text-[#D9B978]">
                  <ImageIcon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                    {foregroundSource.file.name}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-[#56615B] tabular-nums dark:text-[#B9C5BD]">
                    {foregroundSource.width} × {foregroundSource.height} px ·{' '}
                    {foregroundSource.formatLabel} ·{' '}
                    {formatImageFileSize(foregroundSource.sizeBytes)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => fgInputRef.current?.click()}
                  disabled={isProcessing}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#DCDDD3] bg-white px-3 text-xs font-semibold text-[#252B28] transition-colors hover:border-[#C49A58] disabled:cursor-not-allowed disabled:opacity-45 dark:border-[#35463E] dark:bg-[#24332C] dark:text-[#F2F0E9] dark:hover:border-[#D9B978]"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    {isCurrentForegroundSegmented
                      ? 'Upload Another'
                      : 'Replace Image'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleRemoveForeground}
                  disabled={isProcessing}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#DCDDD3] bg-white px-3 text-xs font-semibold text-[#56615B] transition-colors hover:border-red-600/40 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-45 dark:border-[#35463E] dark:bg-[#24332C] dark:text-[#B9C5BD] dark:hover:text-red-300"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Remove</span>
                </button>
              </div>
            </div>
          )}

          {/* Processing / Cached Model Progress */}
          {isProcessing && progress && (
            <div
              role="status"
              aria-live="polite"
              className="rounded-xl border border-[#173F35]/25 bg-[#E3EAE4]/55 p-4 dark:border-[#D9B978]/30 dark:bg-[#30483C]/45"
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-2 font-semibold text-[#173F35] dark:text-[#D9B978]">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>{progress.statusText}</span>
                </span>
                <span className="font-mono font-semibold text-[#252B28] tabular-nums dark:text-[#F2F0E9]">
                  {progress.percent}%
                </span>
              </div>
              <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[#DCDDD3] dark:bg-[#17231F]">
                <div
                  className="h-full rounded-full bg-[#173F35] transition-all duration-200 dark:bg-[#D9B978]"
                  style={{ width: `${Math.max(4, progress.percent)}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-[#56615B] dark:text-[#B9C5BD]">
                {progress.detailText}
              </p>
            </div>
          )}

          {/* Error Banner with Retry */}
          {errorInfo && (
            <div
              role="alert"
              className="rounded-xl border border-red-700/25 bg-red-50 px-4 py-3 text-xs text-red-900 dark:border-red-400/30 dark:bg-red-950/50 dark:text-red-200"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <AlertCircle
                    className="mt-0.5 h-4 w-4 shrink-0 text-red-700 dark:text-red-300"
                    aria-hidden="true"
                  />
                  <div className="space-y-1">
                    <p className="font-medium leading-relaxed">
                      {errorInfo.userMessage}
                    </p>
                    {errorInfo.diagnosticDetail && (
                      <p className="font-mono text-[11px] break-all text-red-800/85 dark:text-red-200/80">
                        Details: {errorInfo.diagnosticDetail}
                      </p>
                    )}
                  </div>
                </div>
                {errorInfo.canRetry && foregroundSource && (
                  <button
                    type="button"
                    onClick={() => void runSegmentation(foregroundSource)}
                    disabled={isProcessing}
                    className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-lg border border-red-700/30 bg-white px-2.5 text-xs font-semibold text-red-900 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-400/35 dark:bg-red-950 dark:text-red-100 dark:hover:bg-red-900/60"
                  >
                    <RefreshCw className="h-3 w-3" aria-hidden="true" />
                    <span>Retry</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Live Composition Ready Bar & View Mode Switcher */}
          {isCurrentForegroundSegmented && segmentedForeground && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#173F35]/25 bg-[#E3EAE4]/60 px-4 py-3 dark:border-[#D9B978]/30 dark:bg-[#30483C]/45">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#173F35] dark:text-[#D9B978]">
                  <CheckCircle2
                    className="h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>Live Composition Ready</span>
                </div>
                <p className="font-mono text-[11px] text-[#56615B] tabular-nums dark:text-[#B9C5BD]">
                  {segmentedForeground.width} × {segmentedForeground.height} px
                  · {(segmentedForeground.durationMs / 1000).toFixed(1)}s ·{' '}
                  {segmentedForeground.modelName}
                  {segmentedForeground.fromCache ? ' (cached)' : ''}
                </p>
              </div>

              <div
                role="group"
                aria-label="Comparison view mode"
                className="grid grid-cols-2 gap-1 rounded-lg bg-[#EDE9DF] p-1 dark:bg-[#17231F]"
              >
                <button
                  type="button"
                  aria-pressed={comparisonMode === 'side-by-side'}
                  onClick={() => setComparisonMode('side-by-side')}
                  className={`inline-flex min-h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-colors ${
                    comparisonMode === 'side-by-side'
                      ? 'bg-white text-[#173F35] shadow-xs dark:bg-[#24332C] dark:text-[#F2F0E9]'
                      : 'text-[#56615B] hover:text-[#252B28] dark:text-[#B9C5BD] dark:hover:text-[#F2F0E9]'
                  }`}
                >
                  <Columns2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Side by Side</span>
                </button>
                <button
                  type="button"
                  aria-pressed={comparisonMode === 'split'}
                  onClick={() => setComparisonMode('split')}
                  className={`inline-flex min-h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-colors ${
                    comparisonMode === 'split'
                      ? 'bg-white text-[#173F35] shadow-xs dark:bg-[#24332C] dark:text-[#F2F0E9]'
                      : 'text-[#56615B] hover:text-[#252B28] dark:text-[#B9C5BD] dark:hover:text-[#F2F0E9]'
                  }`}
                >
                  <SlidersHorizontal
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                  />
                  <span>Split Slider</span>
                </button>
              </div>
            </div>
          )}

          {/* Before / After Preview Layout */}
          {comparisonMode === 'split' &&
          foregroundSource &&
          composedPreviewUrl ? (
            <div className="flex flex-col rounded-xl border border-[#DCDDD3] bg-[#EDE9DF]/30 p-3.5 dark:border-[#35463E] dark:bg-[#17231F]/60">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                  Original vs Edited Backdrop Split
                </span>
                <span className="font-mono text-[#173F35] tabular-nums dark:text-[#D9B978]">
                  {splitPosition}% Original
                </span>
              </div>

              <div
                className={`relative mt-3 flex h-72 w-full items-center justify-center overflow-hidden rounded-lg border border-[#DCDDD3]/80 sm:h-80 dark:border-[#35463E] ${
                  isTransparentSelected ? CHECKERBOARD_BG : ''
                }`}
              >
                <img
                  src={composedPreviewUrl}
                  alt="Edited composition with new background"
                  className="pointer-events-none h-full w-full object-contain select-none"
                />
                <img
                  src={foregroundSource.objectUrl}
                  alt="Original uploaded photo"
                  className="pointer-events-none absolute inset-0 h-full w-full object-contain select-none"
                  style={{
                    clipPath: `inset(0 ${100 - splitPosition}% 0 0)`,
                  }}
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 w-0.5 bg-[#173F35] shadow-[0_0_0_1px_rgba(255,255,255,0.8)] dark:bg-[#D9B978]"
                  style={{ left: `${splitPosition}%` }}
                />
              </div>

              <div className="mt-3 flex items-center gap-3 text-xs text-[#56615B] dark:text-[#B9C5BD]">
                <span>Edited</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={splitPosition}
                  onChange={(e) => setSplitPosition(Number(e.target.value))}
                  aria-label="Original and edited split comparison slider"
                  className="w-full cursor-pointer accent-[#173F35] dark:accent-[#D9B978]"
                />
                <span>Original</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Before */}
              <div className="flex flex-col rounded-xl border border-[#DCDDD3] bg-[#EDE9DF]/30 p-3.5 dark:border-[#35463E] dark:bg-[#17231F]/60">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                    Before (Original)
                  </span>
                  <span className="font-mono text-[#56615B] dark:text-[#B9C5BD]">
                    {foregroundSource ? foregroundSource.formatLabel : 'Source'}
                  </span>
                </div>
                <div className="mt-3 flex h-56 flex-col items-center justify-center overflow-hidden rounded-lg border border-[#DCDDD3]/80 bg-[#E3EAE4]/60 p-2 text-center dark:border-[#35463E] dark:bg-[#24332C]">
                  {foregroundSource ? (
                    <img
                      src={foregroundSource.objectUrl}
                      alt="Original foreground upload preview"
                      className="max-h-full max-w-full rounded object-contain"
                    />
                  ) : (
                    <>
                      <ImageIcon
                        className="h-8 w-8 text-[#173F35]/60 dark:text-[#D9B978]/60"
                        aria-hidden="true"
                      />
                      <span className="mt-2 text-xs text-[#56615B] dark:text-[#B9C5BD]">
                        Original foreground photo
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* After */}
              <div className="flex flex-col rounded-xl border border-[#DCDDD3] bg-[#EDE9DF]/30 p-3.5 dark:border-[#35463E] dark:bg-[#17231F]/60">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                    After (New Backdrop)
                  </span>
                  <span className="font-mono capitalize text-[#173F35] dark:text-[#D9B978]">
                    {isTransparentSelected ? 'Transparent' : backdropMode}
                  </span>
                </div>
                <div
                  className={`relative mt-3 flex h-56 flex-col items-center justify-center overflow-hidden rounded-lg border border-[#DCDDD3]/80 p-2 text-center transition-all dark:border-[#35463E] ${
                    composedPreviewUrl
                      ? isTransparentSelected
                        ? CHECKERBOARD_BG
                        : 'bg-[#EDE9DF]/30 dark:bg-[#17231F]'
                      : isTransparentSelected
                        ? CHECKERBOARD_BG
                        : 'bg-[#EDE9DF]'
                  }`}
                  style={
                    composedPreviewUrl ? undefined : previewBackdropStyle
                  }
                >
                  {composedPreviewUrl ? (
                    <img
                      src={composedPreviewUrl}
                      alt="Subject composed on new background"
                      className="max-h-full max-w-full rounded object-contain"
                    />
                  ) : (
                    <>
                      {backdropMode === 'image' && customBackdrop && (
                        <img
                          src={customBackdrop.objectUrl}
                          alt="Selected custom background"
                          className={`pointer-events-none absolute inset-0 h-full w-full ${
                            customBgFit === 'cover'
                              ? 'object-cover'
                              : customBgFit === 'contain'
                                ? 'object-contain'
                                : 'object-fill'
                          }`}
                        />
                      )}
                      <div className="relative z-10 flex flex-col items-center rounded-lg bg-white/85 px-3.5 py-2.5 text-center shadow-xs dark:bg-[#17231F]/85">
                        <Palette
                          className="h-6 w-6 text-[#173F35] dark:text-[#D9B978]"
                          aria-hidden="true"
                        />
                        <span className="mt-1.5 text-xs font-medium text-[#252B28] dark:text-[#F2F0E9]">
                          {isProcessing
                            ? 'Segmenting foreground...'
                            : foregroundSource
                              ? 'Click Apply Background to compose'
                              : backdropMode === 'color'
                                ? isTransparentBg
                                  ? 'Transparent backdrop'
                                  : `Solid ${solidColor}`
                                : backdropMode === 'gradient'
                                  ? 'Custom / preset gradient'
                                  : customBackdrop
                                    ? customBackdrop.file.name
                                    : 'Custom backdrop image'}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Privacy & Reuse Notice */}
          <div className="rounded-xl border border-[#DCDDD3] bg-[#EDE9DF]/45 p-4 dark:border-[#35463E] dark:bg-[#17231F]/65">
            <div className="flex items-start gap-3">
              <ShieldCheck
                className="mt-0.5 h-4 w-4 shrink-0 text-[#173F35] dark:text-[#D9B978]"
                aria-hidden="true"
              />
              <div className="space-y-1 text-xs leading-relaxed text-[#56615B] dark:text-[#B9C5BD]">
                <p className="font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                  Private Local Compositing &amp; Cached Model Reuse
                </p>
                <p>
                  Foreground isolation and background compositing run locally
                  inside your browser using our cached ONNX AI segmentation
                  model (shared with Image Background Remover). Once your
                  subject is segmented, switching colors, gradients, or custom
                  backdrops updates instantaneously without re-running AI.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Background Selector (Solid Color / Gradient / Custom Image) & Download */}
        <div className="flex flex-col justify-between border-t border-[#DCDDD3] pt-6 lg:col-span-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8 dark:border-[#35463E]">
          <div className="space-y-6">
            <div>
              <span className="block text-sm font-medium text-[#252B28] dark:text-[#F2F0E9]">
                Background Style
              </span>
              <div
                role="tablist"
                aria-label="Background style mode"
                className="mt-2 grid grid-cols-3 gap-1.5 rounded-xl bg-[#EDE9DF] p-1 dark:bg-[#17231F]"
              >
                {(
                  [
                    { id: 'color', label: 'Solid Color' },
                    { id: 'gradient', label: 'Gradient' },
                    { id: 'image', label: 'Custom Image' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={backdropMode === tab.id}
                    onClick={() => setBackdropMode(tab.id)}
                    className={`min-h-9 rounded-lg px-2 text-xs font-semibold transition-colors ${
                      backdropMode === tab.id
                        ? 'bg-white text-[#173F35] shadow-xs dark:bg-[#24332C] dark:text-[#F2F0E9]'
                        : 'text-[#56615B] hover:text-[#252B28] dark:text-[#B9C5BD]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {backdropMode === 'color' && (
              <div className="space-y-3.5">
                <label
                  htmlFor="bg-changer-color"
                  className="block text-sm font-medium text-[#252B28] dark:text-[#F2F0E9]"
                >
                  Background Color Selector
                </label>

                <div className="flex items-center gap-3">
                  <input
                    id="bg-changer-color"
                    type="color"
                    value={solidColor}
                    onChange={(e) => {
                      setIsTransparentBg(false);
                      setSolidColor(e.target.value.toUpperCase());
                    }}
                    className="h-11 w-12 shrink-0 cursor-pointer rounded-lg border border-[#DCDDD3] bg-transparent p-1 dark:border-[#35463E]"
                  />
                  <span className="font-mono text-xs font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                    {isTransparentBg ? 'TRANSPARENT' : solidColor}
                  </span>
                </div>

                <div
                  role="group"
                  aria-label="Solid background color presets"
                  className="flex flex-wrap items-center gap-2.5 pt-1"
                >
                  {SOLID_COLOR_PRESETS.map((swatch) => {
                    const selected = swatch.isTransparent
                      ? isTransparentBg
                      : !isTransparentBg &&
                        solidColor.toUpperCase() === swatch.hex.toUpperCase();
                    return (
                      <button
                        key={swatch.id}
                        type="button"
                        title={swatch.label}
                        aria-label={`Select ${swatch.label} background`}
                        aria-pressed={selected}
                        onClick={() => {
                          if (swatch.isTransparent) {
                            setIsTransparentBg(true);
                          } else {
                            setIsTransparentBg(false);
                            setSolidColor(swatch.hex);
                          }
                        }}
                        className={`h-8 w-8 rounded-lg border transition-transform hover:scale-105 ${
                          swatch.isTransparent ? CHECKERBOARD_BG : ''
                        } ${
                          selected
                            ? 'ring-2 ring-[#C49A58] ring-offset-1 dark:ring-[#D9B978]'
                            : 'border-[#DCDDD3] dark:border-[#35463E]'
                        }`}
                        style={
                          swatch.isTransparent
                            ? undefined
                            : { backgroundColor: swatch.hex }
                        }
                      />
                    );
                  })}
                </div>
                <p className="text-[11px] text-[#56615B] dark:text-[#B9C5BD]">
                  Includes Transparent, White, Black, Light Grey, Beige, Blue,
                  Green, Pink, and custom hex colors.
                </p>
              </div>
            )}

            {backdropMode === 'gradient' && (
              <div className="space-y-4">
                <div>
                  <span className="block text-sm font-medium text-[#252B28] dark:text-[#F2F0E9]">
                    Select a Gradient Preset
                  </span>
                  <div
                    role="group"
                    aria-label="Gradient presets"
                    className="mt-2.5 grid grid-cols-2 gap-2.5"
                  >
                    {GRADIENT_PRESETS.map((preset) => {
                      const selected =
                        selectedGradientId === preset.id &&
                        gradientStart.toUpperCase() ===
                          preset.startColor.toUpperCase() &&
                        gradientEnd.toUpperCase() ===
                          preset.endColor.toUpperCase();
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => {
                            setSelectedGradientId(preset.id);
                            setGradientStart(preset.startColor);
                            setGradientEnd(preset.endColor);
                            setGradientDirection(preset.direction);
                          }}
                          className={`flex flex-col overflow-hidden rounded-xl border text-left transition-all ${
                            selected
                              ? 'border-[#173F35] ring-1 ring-[#173F35] dark:border-[#D9B978] dark:ring-[#D9B978]'
                              : 'border-[#DCDDD3] hover:border-[#C49A58] dark:border-[#35463E]'
                          }`}
                        >
                          <div
                            className="h-12 w-full"
                            style={{
                              backgroundImage: buildGradientCss(
                                preset.startColor,
                                preset.endColor,
                                preset.direction
                              ),
                            }}
                          />
                          <span className="bg-white px-3 py-1.5 text-xs font-semibold text-[#252B28] dark:bg-[#17231F] dark:text-[#F2F0E9]">
                            {preset.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Two-Color Gradient Controls */}
                <div className="rounded-xl border border-[#DCDDD3] bg-[#EDE9DF]/30 p-3.5 dark:border-[#35463E] dark:bg-[#17231F]/60">
                  <span className="block text-xs font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                    Custom Gradient Colors &amp; Style
                  </span>
                  <div className="mt-2.5 grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 text-xs text-[#56615B] dark:text-[#B9C5BD]">
                      <input
                        type="color"
                        value={gradientStart}
                        onChange={(e) => {
                          setSelectedGradientId('custom');
                          setGradientStart(e.target.value.toUpperCase());
                        }}
                        aria-label="Gradient start color"
                        className="h-8 w-9 cursor-pointer rounded border border-[#DCDDD3] bg-transparent p-0.5 dark:border-[#35463E]"
                      />
                      <span className="font-mono">{gradientStart}</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-[#56615B] dark:text-[#B9C5BD]">
                      <input
                        type="color"
                        value={gradientEnd}
                        onChange={(e) => {
                          setSelectedGradientId('custom');
                          setGradientEnd(e.target.value.toUpperCase());
                        }}
                        aria-label="Gradient end color"
                        className="h-8 w-9 cursor-pointer rounded border border-[#DCDDD3] bg-transparent p-0.5 dark:border-[#35463E]"
                      />
                      <span className="font-mono">{gradientEnd}</span>
                    </label>
                  </div>
                  <div
                    role="group"
                    aria-label="Gradient direction"
                    className="mt-2.5 grid grid-cols-4 gap-1.5"
                  >
                    {(
                      [
                        { id: 'diagonal', label: 'Diagonal' },
                        { id: 'vertical', label: 'Vertical' },
                        { id: 'horizontal', label: 'Horizontal' },
                        { id: 'radial', label: 'Radial' },
                      ] as const
                    ).map((dir) => (
                      <button
                        key={dir.id}
                        type="button"
                        aria-pressed={gradientDirection === dir.id}
                        onClick={() => setGradientDirection(dir.id)}
                        className={`min-h-8 rounded-md border text-[11px] font-semibold transition-colors ${
                          gradientDirection === dir.id
                            ? 'border-[#173F35] bg-[#173F35] text-[#F2F0E9] dark:border-[#D9B978] dark:bg-[#315D4D]'
                            : 'border-[#DCDDD3] bg-white text-[#56615B] hover:text-[#252B28] dark:border-[#35463E] dark:bg-[#24332C] dark:text-[#B9C5BD]'
                        }`}
                      >
                        {dir.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {backdropMode === 'image' && (
              <div className="space-y-4">
                <span className="block text-sm font-medium text-[#252B28] dark:text-[#F2F0E9]">
                  Upload Custom Background Image
                </span>
                <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#DCDDD3] bg-[#EDE9DF]/35 px-4 py-5 text-center dark:border-[#35463E] dark:bg-[#17231F]/60">
                  {customBackdrop ? (
                    <div className="flex w-full items-center justify-between gap-3 text-left">
                      <div className="flex min-w-0 items-center gap-3">
                        <img
                          src={customBackdrop.objectUrl}
                          alt="Uploaded custom backdrop thumbnail"
                          className="h-11 w-11 shrink-0 rounded-lg border border-[#DCDDD3] object-cover dark:border-[#35463E]"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                            {customBackdrop.file.name}
                          </p>
                          <p className="font-mono text-[11px] text-[#56615B] dark:text-[#B9C5BD]">
                            {customBackdrop.width} × {customBackdrop.height} px
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => bgInputRef.current?.click()}
                        className="inline-flex min-h-9 shrink-0 items-center rounded-lg border border-[#DCDDD3] bg-white px-3 text-xs font-semibold text-[#252B28] transition-colors hover:border-[#C49A58] dark:border-[#35463E] dark:bg-[#24332C] dark:text-[#F2F0E9]"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <>
                      <UploadCloud
                        className="h-6 w-6 text-[#173F35] dark:text-[#D9B978]"
                        aria-hidden="true"
                      />
                      <p className="mt-2 text-xs font-medium text-[#252B28] dark:text-[#F2F0E9]">
                        Choose a studio backdrop or scene (JPG, PNG, WebP)
                      </p>
                      <button
                        type="button"
                        onClick={() => bgInputRef.current?.click()}
                        className="mt-3 inline-flex min-h-9 items-center rounded-lg border border-[#DCDDD3] bg-white px-3.5 text-xs font-semibold text-[#252B28] transition-colors hover:border-[#C49A58] dark:border-[#35463E] dark:bg-[#24332C] dark:text-[#F2F0E9] dark:hover:border-[#D9B978]"
                      >
                        Upload Custom Background
                      </button>
                    </>
                  )}
                </div>

                {/* Image Fitting Options */}
                <div>
                  <span className="block text-xs font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                    Background Image Fit
                  </span>
                  <div
                    role="group"
                    aria-label="Background image fit"
                    className="mt-2 grid grid-cols-3 gap-2"
                  >
                    {(
                      [
                        { id: 'cover', label: 'Cover' },
                        { id: 'contain', label: 'Contain' },
                        { id: 'fill', label: 'Fill' },
                      ] as const
                    ).map((fit) => (
                      <button
                        key={fit.id}
                        type="button"
                        aria-pressed={customBgFit === fit.id}
                        onClick={() => setCustomBgFit(fit.id)}
                        className={`min-h-9 rounded-lg border text-xs font-semibold transition-colors ${
                          customBgFit === fit.id
                            ? 'border-[#173F35] bg-[#173F35] text-[#F2F0E9] dark:border-[#D9B978] dark:bg-[#315D4D]'
                            : 'border-[#DCDDD3] bg-white text-[#56615B] hover:text-[#252B28] dark:border-[#35463E] dark:bg-[#24332C] dark:text-[#B9C5BD]'
                        }`}
                      >
                        {fit.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Primary Actions & PNG/JPG Downloads */}
          <div className="mt-8 space-y-3 border-t border-[#DCDDD3] pt-5 dark:border-[#35463E]">
            {!isCurrentForegroundSegmented ? (
              <button
                type="button"
                onClick={handleApplyBackgroundClick}
                disabled={!foregroundSource || isProcessing}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#173F35] px-5 py-2.5 text-sm font-semibold text-[#F2F0E9] transition-colors hover:bg-[#173F35]/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C49A58] disabled:cursor-not-allowed disabled:opacity-45 dark:bg-[#315D4D] dark:hover:bg-[#315D4D]/90"
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Palette className="h-4 w-4" aria-hidden="true" />
                )}
                <span>
                  {isProcessing
                    ? 'Removing Original Background...'
                    : 'Remove Background & Apply'}
                </span>
              </button>
            ) : (
              <div className="flex items-center justify-between rounded-xl border border-[#173F35]/20 bg-[#E3EAE4]/45 px-3.5 py-2.5 text-xs dark:border-[#D9B978]/25 dark:bg-[#30483C]/35">
                <span className="font-medium text-[#173F35] dark:text-[#D9B978]">
                  Subject isolated — backdrop changes update live
                </span>
                <button
                  type="button"
                  onClick={() =>
                    foregroundSource && void runSegmentation(foregroundSource)
                  }
                  disabled={isProcessing}
                  className="font-semibold text-[#252B28] underline underline-offset-2 hover:text-[#173F35] dark:text-[#F2F0E9]"
                >
                  Re-segment
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {isTransparentSelected ? (
                <button
                  type="button"
                  onClick={() => void handleDownload('png')}
                  disabled={
                    !isCurrentForegroundSegmented || isProcessing || isExporting
                  }
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#C49A58] px-4 py-2.5 text-sm font-semibold text-[#17231F] transition-colors hover:bg-[#D9B978] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173F35] disabled:cursor-not-allowed disabled:opacity-45 sm:col-span-1 dark:bg-[#D9B978] dark:hover:bg-[#C49A58]"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  <span>Download PNG</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleDownload('jpg')}
                  disabled={
                    !isCurrentForegroundSegmented || isProcessing || isExporting
                  }
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#C49A58] px-4 py-2.5 text-sm font-semibold text-[#17231F] transition-colors hover:bg-[#D9B978] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173F35] disabled:cursor-not-allowed disabled:opacity-45 dark:bg-[#D9B978] dark:hover:bg-[#C49A58]"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  <span>Download JPG</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleResetAll}
                disabled={isProcessing}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#DCDDD3] bg-white px-4 py-2.5 text-sm font-medium text-[#56615B] transition-colors hover:border-[#C49A58] hover:text-[#252B28] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C49A58] disabled:cursor-not-allowed disabled:opacity-45 dark:border-[#35463E] dark:bg-[#24332C] dark:text-[#B9C5BD] dark:hover:border-[#D9B978] dark:hover:text-[#F2F0E9]"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                <span>Reset</span>
              </button>
            </div>

            {!isTransparentSelected && isCurrentForegroundSegmented && (
              <button
                type="button"
                onClick={() => void handleDownload('png')}
                disabled={isProcessing || isExporting}
                className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#DCDDD3] bg-[#EDE9DF]/45 px-4 text-xs font-semibold text-[#252B28] transition-colors hover:border-[#C49A58] disabled:cursor-not-allowed disabled:opacity-45 dark:border-[#35463E] dark:bg-[#17231F] dark:text-[#F2F0E9] dark:hover:border-[#D9B978]"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Also Download as PNG (with selected background)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
