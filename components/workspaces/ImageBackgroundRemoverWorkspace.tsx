import {
  AlertCircle,
  CheckCircle2,
  Columns2,
  Download,
  Eraser,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlphaMaskStats,
  BackgroundRemovalProgress,
  buildBackgroundRemovedFilename,
  ClassifiedBackgroundRemovalError,
  classifyBackgroundRemovalError,
  decodePngBlobToImageData,
  disposeBackgroundRemovalResources,
  encodeImageDataToPngBlob,
  formatImageFileSize,
  LoadedImageSource,
  loadUploadedImageForRemoval,
  MAX_IMAGE_FILE_SIZE_BYTES,
  refineCutoutRgbaPixels,
  removeBackgroundInBrowser,
} from '../../utils/backgroundRemoval';

type ComparisonViewMode = 'side-by-side' | 'split';

interface ProcessedCutoutResult {
  objectUrl: string;
  sizeBytes: number;
  width: number;
  height: number;
  filename: string;
  stats: AlphaMaskStats;
  durationMs: number;
  usedWorker: boolean;
  modelName: string;
  fromCache: boolean;
}

const CHECKERBOARD_BG =
  'bg-[linear-gradient(45deg,rgba(104,115,109,0.16)_25%,transparent_25%),linear-gradient(-45deg,rgba(104,115,109,0.16)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,rgba(104,115,109,0.16)_75%),linear-gradient(-45deg,transparent_75%,rgba(104,115,109,0.16)_75%)] bg-[length:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0]';

export function ImageBackgroundRemoverWorkspace() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);
  const processingTokenRef = useRef(0);
  const rawCutoutDataRef = useRef<ImageData | null>(null);
  const sourceUrlRef = useRef<string | null>(null);
  const resultUrlRef = useRef<string | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [sourceImage, setSourceImage] = useState<LoadedImageSource | null>(null);

  const [edgeFeather, setEdgeFeather] = useState(0);
  const [refineHair, setRefineHair] = useState(true);
  const [comparisonMode, setComparisonMode] =
    useState<ComparisonViewMode>('side-by-side');
  const [splitPosition, setSplitPosition] = useState(50);

  const [isReadingFile, setIsReadingFile] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [progress, setProgress] = useState<BackgroundRemovalProgress | null>(null);
  const [errorInfo, setErrorInfo] =
    useState<ClassifiedBackgroundRemovalError | null>(null);
  const [cutoutResult, setCutoutResult] = useState<ProcessedCutoutResult | null>(
    null
  );
  const isProcessingRef = useRef(false);

  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  const revokeSourceUrl = useCallback(() => {
    if (sourceUrlRef.current) {
      URL.revokeObjectURL(sourceUrlRef.current);
      sourceUrlRef.current = null;
    }
  }, []);

  const revokeResultUrl = useCallback(() => {
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      processingTokenRef.current += 1;
      if (isProcessingRef.current) {
        disposeBackgroundRemovalResources();
      }
      revokeSourceUrl();
      revokeResultUrl();
    };
  }, [revokeResultUrl, revokeSourceUrl]);

  const clearCutoutOnly = useCallback(() => {
    rawCutoutDataRef.current = null;
    revokeResultUrl();
    setCutoutResult(null);
    setProgress(null);
  }, [revokeResultUrl]);

  const applyNonDestructiveRefinement = useCallback(
    async (
      rawImageData: ImageData,
      sourceName: string,
      feather: number,
      hairRefine: boolean,
      durationMs: number,
      usedWorker: boolean,
      modelName: string,
      fromCache: boolean,
      token: number
    ) => {
      setIsRefining(true);
      try {
        const refined = refineCutoutRgbaPixels(
          rawImageData.data,
          rawImageData.width,
          rawImageData.height,
          {
            edgeFeather: feather,
            refineHair: hairRefine,
          }
        );

        const outImageData = new ImageData(
          new Uint8ClampedArray(refined.data),
          rawImageData.width,
          rawImageData.height
        );
        const pngBlob = await encodeImageDataToPngBlob(outImageData);
        if (token !== processingTokenRef.current) {
          return;
        }

        const nextUrl = URL.createObjectURL(pngBlob);
        revokeResultUrl();
        resultUrlRef.current = nextUrl;

        setCutoutResult({
          objectUrl: nextUrl,
          sizeBytes: pngBlob.size,
          width: rawImageData.width,
          height: rawImageData.height,
          filename: buildBackgroundRemovedFilename(sourceName),
          stats: refined.stats,
          durationMs,
          usedWorker,
          modelName,
          fromCache,
        });
      } catch (err) {
        if (token === processingTokenRef.current) {
          setErrorInfo(classifyBackgroundRemovalError(err));
        }
      } finally {
        if (token === processingTokenRef.current) {
          setIsRefining(false);
        }
      }
    },
    [revokeResultUrl]
  );

  // Re-apply non-destructive edge feathering or fine-detail tightening smoothly
  // whenever the user changes controls after segmentation has completed.
  useEffect(() => {
    const rawData = rawCutoutDataRef.current;
    if (!rawData || !sourceImage || !cutoutResult || isProcessing) return;

    const currentToken = processingTokenRef.current;
    const timer = window.setTimeout(() => {
      void applyNonDestructiveRefinement(
        rawData,
        sourceImage.file.name,
        edgeFeather,
        refineHair,
        cutoutResult.durationMs,
        cutoutResult.usedWorker,
        cutoutResult.modelName,
        cutoutResult.fromCache,
        currentToken
      );
    }, 60);

    return () => {
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edgeFeather, refineHair]);

  const handleSelectedFile = useCallback(
    async (file: File) => {
      if (isProcessing) return;
      setErrorInfo(null);
      setIsReadingFile(true);

      try {
        const loaded = await loadUploadedImageForRemoval(file);
        processingTokenRef.current += 1;
        clearCutoutOnly();
        revokeSourceUrl();
        sourceUrlRef.current = loaded.objectUrl;
        setSourceImage(loaded);
        setComparisonMode('side-by-side');
        setSplitPosition(50);
      } catch (err) {
        setErrorInfo({
          userMessage:
            err instanceof Error
              ? err.message
              : 'Unable to load the selected image file.',
          diagnosticDetail: '',
          canRetry: false,
        });
      } finally {
        setIsReadingFile(false);
      }
    },
    [clearCutoutOnly, isProcessing, revokeSourceUrl]
  );

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) {
      void handleSelectedFile(file);
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
      void handleSelectedFile(file);
    }
  };

  const handleRemoveBackground = async () => {
    if (!sourceImage || isProcessing) {
      if (!sourceImage) {
        setErrorInfo({
          userMessage: 'Please upload an image first.',
          diagnosticDetail: '',
          canRetry: false,
        });
      }
      return;
    }

    const token = ++processingTokenRef.current;
    setErrorInfo(null);
    clearCutoutOnly();
    setIsProcessing(true);
    setProgress({
      phase: 'downloading',
      percent: 5,
      statusText: 'Checking browser model cache...',
      detailText: 'Preparing local ONNX WebAssembly segmentation',
    });

    try {
      const result = await removeBackgroundInBrowser(sourceImage.file, {
        onProgress: (p) => {
          if (token === processingTokenRef.current) {
            setProgress(p);
          }
        },
      });

      if (token !== processingTokenRef.current) return;

      const rawImageData = await decodePngBlobToImageData(result.rawPngBlob);
      if (token !== processingTokenRef.current) return;

      rawCutoutDataRef.current = rawImageData;

      await applyNonDestructiveRefinement(
        rawImageData,
        sourceImage.file.name,
        edgeFeather,
        refineHair,
        result.durationMs,
        result.usedWorker,
        result.modelName,
        result.fromCache,
        token
      );
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
  };

  const handleDownload = () => {
    if (!cutoutResult || isProcessing || isRefining) return;
    const link = document.createElement('a');
    link.href = cutoutResult.objectUrl;
    link.download = cutoutResult.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRemoveImage = () => {
    if (isProcessing) return;
    processingTokenRef.current += 1;
    clearCutoutOnly();
    revokeSourceUrl();
    setSourceImage(null);
    setErrorInfo(null);
  };

  const handleResetAll = () => {
    if (isProcessing) return;
    processingTokenRef.current += 1;
    clearCutoutOnly();
    revokeSourceUrl();
    setSourceImage(null);
    setEdgeFeather(0);
    setRefineHair(true);
    setComparisonMode('side-by-side');
    setSplitPosition(50);
    setErrorInfo(null);
  };

  return (
    <div className="rounded-[18px] border border-[#DCDDD3] bg-white p-5 shadow-[0_2px_10px_-3px_rgba(23,63,53,0.06)] sm:p-8 dark:border-[#35463E] dark:bg-[#24332C] dark:shadow-[0_2px_10px_-3px_rgba(0,0,0,0.24)]">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        onChange={handleFileInputChange}
        className="sr-only"
        aria-label="Upload image for background removal"
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left: Image Upload, Progress & Before/After Transparent Preview */}
        <div className="space-y-6 lg:col-span-7">
          {!sourceImage ? (
            <div
              role="region"
              aria-label="Image upload dropzone"
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
                Upload an image to remove its background
              </p>
              <p className="mt-1.5 max-w-sm text-sm text-[#56615B] dark:text-[#B9C5BD]">
                Drag &amp; drop or browse a JPG, JPEG, PNG, or WebP photo (up to{' '}
                {formatImageFileSize(MAX_IMAGE_FILE_SIZE_BYTES)} / 25 MP) for
                local AI cutout isolation and transparent PNG export.
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isReadingFile || isProcessing}
                className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#173F35] px-5 py-2.5 text-sm font-semibold text-[#F2F0E9] transition-colors hover:bg-[#173F35]/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C49A58] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#315D4D] dark:hover:bg-[#315D4D]/90"
              >
                {isReadingFile ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ImageIcon className="h-4 w-4" aria-hidden="true" />
                )}
                <span>{isReadingFile ? 'Loading Image...' : 'Browse Image'}</span>
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
                    {sourceImage.file.name}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-[#56615B] tabular-nums dark:text-[#B9C5BD]">
                    {sourceImage.width} × {sourceImage.height} px ·{' '}
                    {sourceImage.formatLabel} ·{' '}
                    {formatImageFileSize(sourceImage.sizeBytes)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#DCDDD3] bg-white px-3 text-xs font-semibold text-[#252B28] transition-colors hover:border-[#C49A58] disabled:cursor-not-allowed disabled:opacity-45 dark:border-[#35463E] dark:bg-[#24332C] dark:text-[#F2F0E9] dark:hover:border-[#D9B978]"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{cutoutResult ? 'Upload Another' : 'Replace Image'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  disabled={isProcessing}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#DCDDD3] bg-white px-3 text-xs font-semibold text-[#56615B] transition-colors hover:border-red-600/40 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-45 dark:border-[#35463E] dark:bg-[#24332C] dark:text-[#B9C5BD] dark:hover:text-red-300"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Remove</span>
                </button>
              </div>
            </div>
          )}

          {/* Processing / Model Download Progress Indicator */}
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

          {/* Error Banner with Diagnostics & Retry */}
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
                {errorInfo.canRetry && sourceImage && (
                  <button
                    type="button"
                    onClick={handleRemoveBackground}
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

          {/* Success Summary & Comparison Mode Switcher */}
          {cutoutResult && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#173F35]/25 bg-[#E3EAE4]/60 px-4 py-3 dark:border-[#D9B978]/30 dark:bg-[#30483C]/45">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#173F35] dark:text-[#D9B978]">
                  <CheckCircle2
                    className="h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    {cutoutResult.stats.transparentPixels > 0
                      ? 'Background Removed'
                      : 'Segmentation Complete (Minimal Transparency)'}
                  </span>
                </div>
                <p className="font-mono text-[11px] text-[#56615B] tabular-nums dark:text-[#B9C5BD]">
                  {cutoutResult.width} × {cutoutResult.height} px ·{' '}
                  {cutoutResult.stats.transparentPercent}% transparent ·{' '}
                  {formatImageFileSize(cutoutResult.sizeBytes)} ·{' '}
                  {(cutoutResult.durationMs / 1000).toFixed(1)}s ·{' '}
                  {cutoutResult.modelName}
                  {cutoutResult.fromCache ? ' (cached)' : ''}
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

          {/* Before / After Comparison Layout */}
          {comparisonMode === 'split' && sourceImage && cutoutResult ? (
            <div className="flex flex-col rounded-xl border border-[#DCDDD3] bg-[#EDE9DF]/30 p-3.5 dark:border-[#35463E] dark:bg-[#17231F]/60">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                  Before / After Split Comparison
                </span>
                <span className="font-mono text-[#173F35] tabular-nums dark:text-[#D9B978]">
                  {splitPosition}% Cutout
                </span>
              </div>

              <div
                className={`relative mt-3 flex h-72 w-full items-center justify-center overflow-hidden rounded-lg border border-[#DCDDD3]/80 sm:h-80 dark:border-[#35463E] ${CHECKERBOARD_BG}`}
              >
                {/* Background Removed (Full Transparent Layer on Checkerboard) */}
                <img
                  src={cutoutResult.objectUrl}
                  alt="Background removed cutout preview"
                  className="pointer-events-none h-full w-full object-contain select-none"
                />
                {/* Original Photo Clipped Left-to-Right */}
                <img
                  src={sourceImage.objectUrl}
                  alt="Original uploaded photo"
                  className="pointer-events-none absolute inset-0 h-full w-full object-contain select-none"
                  style={{
                    clipPath: `inset(0 ${100 - splitPosition}% 0 0)`,
                  }}
                />
                {/* Vertical Split Divider */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 w-0.5 bg-[#173F35] shadow-[0_0_0_1px_rgba(255,255,255,0.8)] dark:bg-[#D9B978]"
                  style={{ left: `${splitPosition}%` }}
                />
              </div>

              <div className="mt-3 flex items-center gap-3 text-xs text-[#56615B] dark:text-[#B9C5BD]">
                <span>Original</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={splitPosition}
                  onChange={(e) => setSplitPosition(Number(e.target.value))}
                  aria-label="Before and after split comparison position"
                  className="w-full cursor-pointer accent-[#173F35] dark:accent-[#D9B978]"
                />
                <span>Transparent</span>
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
                    {sourceImage ? sourceImage.formatLabel : 'Source'}
                  </span>
                </div>
                <div className="mt-3 flex h-56 flex-col items-center justify-center overflow-hidden rounded-lg border border-[#DCDDD3]/80 bg-[#E3EAE4]/60 p-2 text-center dark:border-[#35463E] dark:bg-[#24332C]">
                  {sourceImage ? (
                    <img
                      src={sourceImage.objectUrl}
                      alt="Original uploaded preview"
                      className="max-h-full max-w-full rounded object-contain"
                    />
                  ) : (
                    <>
                      <ImageIcon
                        className="h-8 w-8 text-[#173F35]/60 dark:text-[#D9B978]/60"
                        aria-hidden="true"
                      />
                      <span className="mt-2 text-xs text-[#56615B] dark:text-[#B9C5BD]">
                        Original photo with background
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* After (Transparent Background Preview) */}
              <div className="flex flex-col rounded-xl border border-[#DCDDD3] bg-[#EDE9DF]/30 p-3.5 dark:border-[#35463E] dark:bg-[#17231F]/60">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                    After (Transparent)
                  </span>
                  <span className="font-mono text-[#173F35] dark:text-[#D9B978]">
                    {isRefining ? 'Refining...' : 'Alpha PNG'}
                  </span>
                </div>
                <div
                  className={`mt-3 flex h-56 flex-col items-center justify-center overflow-hidden rounded-lg border border-[#DCDDD3]/80 p-2 text-center dark:border-[#35463E] ${CHECKERBOARD_BG}`}
                >
                  {cutoutResult ? (
                    <img
                      src={cutoutResult.objectUrl}
                      alt="Background removed transparent PNG preview"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <>
                      <Eraser
                        className="h-8 w-8 text-[#173F35] dark:text-[#D9B978]"
                        aria-hidden="true"
                      />
                      <span className="mt-2 rounded-md bg-white/85 px-2.5 py-1 text-xs font-medium text-[#252B28] dark:bg-[#17231F]/85 dark:text-[#F2F0E9]">
                        {isProcessing
                          ? 'Running AI segmentation...'
                          : sourceImage
                            ? 'Click Remove Background to preview cutout'
                            : 'Transparent background preview'}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Privacy & Honest AI Limitations Notice */}
          <div className="rounded-xl border border-[#DCDDD3] bg-[#EDE9DF]/45 p-4 dark:border-[#35463E] dark:bg-[#17231F]/65">
            <div className="flex items-start gap-3">
              <ShieldCheck
                className="mt-0.5 h-4 w-4 shrink-0 text-[#173F35] dark:text-[#D9B978]"
                aria-hidden="true"
              />
              <div className="space-y-1 text-xs leading-relaxed text-[#56615B] dark:text-[#B9C5BD]">
                <p className="font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                  Local Browser AI &amp; Accuracy Notes
                </p>
                <p>
                  Images are segmented locally inside your browser using ONNX
                  WebAssembly AI models (BRIA RMBG-1.4 with IS-Net / MODNet
                  fallbacks) and are never uploaded to our servers. First-time
                  use downloads the open model (~44 MB) and caches it in your
                  browser.
                </p>
                <p>
                  Results may vary on complex or low-contrast backgrounds, fine
                  hair strands, transparent/reflective objects, and
                  low-resolution images.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Cutout Controls & Download PNG Interface */}
        <div className="flex flex-col justify-between border-t border-[#DCDDD3] pt-6 lg:col-span-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8 dark:border-[#35463E]">
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#252B28] dark:text-[#F2F0E9]">
              <Sparkles
                className="h-4 w-4 text-[#7D5C23] dark:text-[#D9B978]"
                aria-hidden="true"
              />
              <span>Cutout Refinement</span>
            </div>

            <div>
              <div className="flex items-center justify-between text-sm">
                <label
                  htmlFor="bg-remove-feather"
                  className="font-medium text-[#252B28] dark:text-[#F2F0E9]"
                >
                  Edge Feathering
                </label>
                <span className="font-mono text-xs font-semibold text-[#173F35] tabular-nums dark:text-[#D9B978]">
                  {edgeFeather} px
                </span>
              </div>
              <input
                id="bg-remove-feather"
                type="range"
                min={0}
                max={8}
                step={1}
                disabled={isProcessing}
                value={edgeFeather}
                onChange={(e) => setEdgeFeather(Number(e.target.value))}
                className="mt-2.5 w-full cursor-pointer accent-[#173F35] disabled:cursor-not-allowed disabled:opacity-50 dark:accent-[#D9B978]"
              />
              <div className="mt-1 flex justify-between text-xs text-[#56615B] dark:text-[#B9C5BD]">
                <span>Crisp edge</span>
                <span>Soft blend</span>
              </div>
            </div>

            <label
              className={`flex items-start gap-3 rounded-xl border border-[#DCDDD3] bg-[#EDE9DF]/30 p-3.5 text-xs dark:border-[#35463E] dark:bg-[#17231F]/60 ${
                isProcessing ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
              }`}
            >
              <input
                type="checkbox"
                checked={refineHair}
                disabled={isProcessing}
                onChange={(e) => setRefineHair(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[#DCDDD3] accent-[#173F35] dark:accent-[#D9B978]"
              />
              <span>
                <span className="block font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                  Fine detail edge preservation
                </span>
                <span className="mt-0.5 block text-[#56615B] dark:text-[#B9C5BD]">
                  Preserve subtle edges and reduce background halo around hair,
                  fabric, and product contours
                </span>
              </span>
            </label>

            <div className="rounded-xl border border-[#DCDDD3] bg-[#EDE9DF]/40 p-4 text-xs text-[#56615B] dark:border-[#35463E] dark:bg-[#17231F]/65 dark:text-[#B9C5BD]">
              Output format is set to{' '}
              <strong className="font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                Transparent PNG
              </strong>{' '}
              to retain clear alpha channels and original image dimensions.
            </div>
          </div>

          <div className="mt-8 space-y-3 border-t border-[#DCDDD3] pt-5 dark:border-[#35463E]">
            <button
              type="button"
              onClick={handleRemoveBackground}
              disabled={!sourceImage || isProcessing}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#173F35] px-5 py-2.5 text-sm font-semibold text-[#F2F0E9] transition-colors hover:bg-[#173F35]/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C49A58] disabled:cursor-not-allowed disabled:opacity-45 dark:bg-[#315D4D] dark:hover:bg-[#315D4D]/90"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Eraser className="h-4 w-4" aria-hidden="true" />
              )}
              <span>
                {isProcessing
                  ? 'Removing Background...'
                  : cutoutResult
                    ? 'Re-run Background Removal'
                    : 'Remove Background'}
              </span>
            </button>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleDownload}
                disabled={!cutoutResult || isProcessing || isRefining}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#C49A58] px-4 py-2.5 text-sm font-semibold text-[#17231F] transition-colors hover:bg-[#D9B978] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173F35] disabled:cursor-not-allowed disabled:opacity-45 dark:bg-[#D9B978] dark:hover:bg-[#C49A58]"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>Download PNG</span>
              </button>

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
          </div>
        </div>
      </div>
    </div>
  );
}
