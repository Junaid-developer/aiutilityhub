import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Download,
  Image as ImageIcon,
  Info,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildCompressedFilename,
  calculateCompressionStats,
  compressImageOnCanvas,
  COMPRESSION_LEVELS,
  CompressorOutputChoice,
  DEFAULT_COMPRESSION_QUALITY,
  detectImageTransparency,
  getCompressionPresetForQuality,
  resolveEffectiveFormat,
} from '../../utils/imageCompressor';
import {
  DEFAULT_JPEG_BACKGROUND,
  formatFileSize,
  loadImageDimensions,
  MAX_IMAGE_FILE_SIZE_BYTES,
  OUTPUT_FORMAT_META,
  OutputImageFormat,
  validateImageFile,
} from '../../utils/imageResizer';

interface SourceImageState {
  name: string;
  size: number;
  width: number;
  height: number;
  format: OutputImageFormat;
  hasTransparency: boolean;
  objectUrl: string;
}

interface CompressedOutputState {
  objectUrl: string;
  size: number;
  width: number;
  height: number;
  format: OutputImageFormat;
  qualityUsed: number;
  filename: string;
}

const OUTPUT_CHOICES: { id: CompressorOutputChoice; label: string }[] = [
  { id: 'original', label: 'Keep Original' },
  { id: 'jpeg', label: 'JPEG' },
  { id: 'webp', label: 'WebP' },
  { id: 'png', label: 'PNG' },
];

const JPEG_BG_SWATCHES = [
  { label: 'White', hex: '#FFFFFF' },
  { label: 'Warm Ivory', hex: '#EDE9DF' },
  { label: 'Forest Green', hex: '#173F35' },
  { label: 'Black', hex: '#000000' },
];

export function ImageCompressorWorkspace() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sourceUrlRef = useRef<string | null>(null);
  const compressedUrlRef = useRef<string | null>(null);
  const dragDepthRef = useRef(0);

  const [isDragging, setIsDragging] = useState(false);
  const [sourceImage, setSourceImage] = useState<SourceImageState | null>(null);
  const [compressedOutput, setCompressedOutput] =
    useState<CompressedOutputState | null>(null);

  const [quality, setQuality] = useState<number>(DEFAULT_COMPRESSION_QUALITY);
  const [outputChoice, setOutputChoice] =
    useState<CompressorOutputChoice>('original');
  const [jpegBackground, setJpegBackground] = useState<string>(
    DEFAULT_JPEG_BACKGROUND
  );

  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [needsRefreshNotice, setNeedsRefreshNotice] = useState(false);

  const activePreset = useMemo(
    () => getCompressionPresetForQuality(quality),
    [quality]
  );

  const effectiveFormat: OutputImageFormat | null = useMemo(() => {
    if (outputChoice !== 'original') return outputChoice;
    return sourceImage ? sourceImage.format : null;
  }, [outputChoice, sourceImage]);

  const effectiveFormatMeta = effectiveFormat
    ? OUTPUT_FORMAT_META[effectiveFormat]
    : null;

  const compressionStats = useMemo(() => {
    if (!sourceImage || !compressedOutput) return null;
    return calculateCompressionStats(sourceImage.size, compressedOutput.size);
  }, [sourceImage, compressedOutput]);

  const revokeSourceUrl = useCallback(() => {
    if (sourceUrlRef.current) {
      URL.revokeObjectURL(sourceUrlRef.current);
      sourceUrlRef.current = null;
    }
  }, []);

  const revokeCompressedUrl = useCallback(() => {
    if (compressedUrlRef.current) {
      URL.revokeObjectURL(compressedUrlRef.current);
      compressedUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      revokeSourceUrl();
      revokeCompressedUrl();
    };
  }, [revokeCompressedUrl, revokeSourceUrl]);

  const markSettingsChanged = useCallback(() => {
    if (compressedUrlRef.current) {
      setNeedsRefreshNotice(true);
    }
  }, []);

  const handleSelectedFile = useCallback(
    async (file: File) => {
      setErrorMessage('');
      const validation = validateImageFile(file);
      if (!validation.ok) {
        setErrorMessage(validation.error);
        return;
      }

      try {
        const meta = await loadImageDimensions(file);
        const hasTransparency =
          validation.detectedFormat === 'png' ||
          validation.detectedFormat === 'webp'
            ? await detectImageTransparency(
                meta.objectUrl,
                meta.width,
                meta.height
              )
            : false;

        revokeSourceUrl();
        revokeCompressedUrl();

        sourceUrlRef.current = meta.objectUrl;
        setSourceImage({
          name: file.name,
          size: file.size,
          width: meta.width,
          height: meta.height,
          format: validation.detectedFormat,
          hasTransparency,
          objectUrl: meta.objectUrl,
        });
        setCompressedOutput(null);
        setNeedsRefreshNotice(false);
      } catch (err) {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Unable to load the selected image file.'
        );
      }
    },
    [revokeCompressedUrl, revokeSourceUrl]
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
    dragDepthRef.current += 1;
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
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

    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleSelectedFile(file);
    }
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleCompress = async () => {
    if (!sourceImage) {
      setErrorMessage('Please upload a JPG, PNG, or WebP image first.');
      return;
    }

    const targetFormat = resolveEffectiveFormat(outputChoice, sourceImage.format);
    setErrorMessage('');
    setIsProcessing(true);

    try {
      const result = await compressImageOnCanvas({
        sourceUrl: sourceImage.objectUrl,
        width: sourceImage.width,
        height: sourceImage.height,
        format: targetFormat,
        qualityPercent: quality,
        backgroundColor: jpegBackground,
      });

      revokeCompressedUrl();
      compressedUrlRef.current = result.objectUrl;

      setCompressedOutput({
        objectUrl: result.objectUrl,
        size: result.size,
        width: result.width,
        height: result.height,
        format: result.format,
        qualityUsed: quality,
        filename: buildCompressedFilename(
          sourceImage.name,
          result.format,
          quality
        ),
      });
      setNeedsRefreshNotice(false);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Failed to compress the image. Please try another output format.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!compressedOutput) return;
    const link = document.createElement('a');
    link.href = compressedOutput.objectUrl;
    link.download = compressedOutput.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleReset = () => {
    setErrorMessage('');
    revokeCompressedUrl();
    setCompressedOutput(null);
    setNeedsRefreshNotice(false);
    setQuality(DEFAULT_COMPRESSION_QUALITY);
    setOutputChoice('original');
    setJpegBackground(DEFAULT_JPEG_BACKGROUND);
  };

  const handleRemoveImage = () => {
    revokeSourceUrl();
    revokeCompressedUrl();
    setSourceImage(null);
    setCompressedOutput(null);
    setErrorMessage('');
    setNeedsRefreshNotice(false);
    setQuality(DEFAULT_COMPRESSION_QUALITY);
    setOutputChoice('original');
    setJpegBackground(DEFAULT_JPEG_BACKGROUND);
  };

  const showJpegBgPicker =
    effectiveFormat === 'jpeg' &&
    sourceImage !== null &&
    (sourceImage.format === 'png' || sourceImage.format === 'webp');

  return (
    <div className="rounded-[18px] border border-[#DCDDD3] bg-white p-5 shadow-[0_2px_10px_-3px_rgba(23,63,53,0.06)] sm:p-8 dark:border-[#35463E] dark:bg-[#24332C] dark:shadow-[0_2px_10px_-3px_rgba(0,0,0,0.24)]">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        onChange={handleFileInputChange}
        className="sr-only"
        aria-label="Upload image to compress"
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left: Upload Zone, Previews & Statistics */}
        <div className="space-y-6 lg:col-span-7">
          {!sourceImage ? (
            <div
              role="region"
              aria-label="Image upload dropzone"
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`flex min-h-[300px] flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
                isDragging
                  ? 'border-[#173F35] bg-[#E3EAE4]/60 dark:border-[#D9B978] dark:bg-[#30483C]/50'
                  : 'border-[#DCDDD3] bg-[#EDE9DF]/45 hover:border-[#C49A58] dark:border-[#35463E] dark:bg-[#17231F]/60 dark:hover:border-[#D9B978]'
              }`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#173F35] text-[#EDE9DF] dark:bg-[#315D4D] dark:text-[#F2F0E9]">
                <UploadCloud className="h-6 w-6" aria-hidden="true" />
              </div>
              <p className="mt-4 font-display text-lg font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                Drag and drop an image to compress
              </p>
              <p className="mt-1.5 max-w-sm text-sm text-[#56615B] dark:text-[#B9C5BD]">
                Supports JPG / JPEG, PNG, and WebP up to{' '}
                {formatFileSize(MAX_IMAGE_FILE_SIZE_BYTES)}. All processing runs
                locally in your browser.
              </p>
              <button
                type="button"
                onClick={openFilePicker}
                className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#173F35] px-5 py-2.5 text-sm font-semibold text-[#F2F0E9] transition-colors hover:bg-[#173F35]/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C49A58] dark:bg-[#315D4D] dark:hover:bg-[#315D4D]/90"
              >
                <ImageIcon className="h-4 w-4" aria-hidden="true" />
                <span>Browse Image</span>
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Source Image Bar with Replace / Remove */}
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
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                    {sourceImage.name}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-[#56615B] tabular-nums dark:text-[#B9C5BD]">
                    {sourceImage.width} × {sourceImage.height} px ·{' '}
                    {formatFileSize(sourceImage.size)} ·{' '}
                    {OUTPUT_FORMAT_META[sourceImage.format].label}
                    {sourceImage.hasTransparency ? ' · Transparent' : ''}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={openFilePicker}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#DCDDD3] bg-white px-3 py-1.5 text-xs font-semibold text-[#252B28] transition-colors hover:border-[#C49A58] dark:border-[#35463E] dark:bg-[#24332C] dark:text-[#F2F0E9] dark:hover:border-[#D9B978]"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Replace Image</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#DCDDD3] bg-white px-3 py-1.5 text-xs font-semibold text-[#56615B] transition-colors hover:border-red-600/40 hover:text-red-700 dark:border-[#35463E] dark:bg-[#24332C] dark:text-[#B9C5BD] dark:hover:border-red-400/50 dark:hover:text-red-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Remove Image</span>
                  </button>
                </div>
              </div>

              {/* Side-by-Side Previews on Desktop, Stacked on Mobile */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Original Image Preview */}
                <div className="flex flex-col rounded-xl border border-[#DCDDD3] bg-[#EDE9DF]/30 p-3.5 dark:border-[#35463E] dark:bg-[#17231F]/60">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                      Original Image
                    </span>
                    <span className="font-mono text-[#56615B] tabular-nums dark:text-[#B9C5BD]">
                      {OUTPUT_FORMAT_META[sourceImage.format].label}
                    </span>
                  </div>

                  <div className="mt-3 flex h-52 items-center justify-center overflow-hidden rounded-lg border border-[#DCDDD3]/80 bg-[linear-gradient(45deg,rgba(104,115,109,0.1)_25%,transparent_25%),linear-gradient(-45deg,rgba(104,115,109,0.1)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,rgba(104,115,109,0.1)_75%),linear-gradient(-45deg,transparent_75%,rgba(104,115,109,0.1)_75%)] bg-[length:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0] p-2 dark:border-[#35463E]">
                    <img
                      src={sourceImage.objectUrl}
                      alt={`Original preview of ${sourceImage.name}`}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-[#56615B] dark:text-[#B9C5BD]">
                    <span>Original size</span>
                    <span className="font-mono font-semibold text-[#252B28] tabular-nums dark:text-[#F2F0E9]">
                      {formatFileSize(sourceImage.size)}
                    </span>
                  </div>
                </div>

                {/* Compressed Image Preview */}
                <div className="flex flex-col rounded-xl border border-[#DCDDD3] bg-[#EDE9DF]/30 p-3.5 dark:border-[#35463E] dark:bg-[#17231F]/60">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                      Compressed Image
                    </span>
                    <span className="font-mono text-[#56615B] tabular-nums dark:text-[#B9C5BD]">
                      {compressedOutput
                        ? OUTPUT_FORMAT_META[compressedOutput.format].label
                        : effectiveFormatMeta?.label ?? '—'}
                    </span>
                  </div>

                  <div className="mt-3 flex h-52 items-center justify-center overflow-hidden rounded-lg border border-[#DCDDD3]/80 bg-[linear-gradient(45deg,rgba(104,115,109,0.1)_25%,transparent_25%),linear-gradient(-45deg,rgba(104,115,109,0.1)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,rgba(104,115,109,0.1)_75%),linear-gradient(-45deg,transparent_75%,rgba(104,115,109,0.1)_75%)] bg-[length:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0] p-2 dark:border-[#35463E]">
                    {compressedOutput ? (
                      <img
                        src={compressedOutput.objectUrl}
                        alt={`Compressed preview in ${OUTPUT_FORMAT_META[compressedOutput.format].label}`}
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 px-4 text-center text-xs text-[#56615B] dark:text-[#B9C5BD]">
                        <ArrowRight className="h-5 w-5 opacity-60" aria-hidden="true" />
                        <span>
                          Choose quality and format, then click{' '}
                          <strong className="font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                            Compress Image
                          </strong>
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-[#56615B] dark:text-[#B9C5BD]">
                    <span>Compressed size</span>
                    <span className="font-mono font-semibold text-[#252B28] tabular-nums dark:text-[#F2F0E9]">
                      {compressedOutput
                        ? formatFileSize(compressedOutput.size)
                        : 'Pending'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Compression Statistics Panel */}
              {compressedOutput && compressionStats && (
                <div className="rounded-xl border border-[#DCDDD3] bg-[#EDE9DF]/40 p-4 dark:border-[#35463E] dark:bg-[#17231F]/65">
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div>
                      <p className="text-[11px] font-medium text-[#56615B] dark:text-[#B9C5BD]">
                        Original Size
                      </p>
                      <p className="mt-0.5 font-mono text-sm font-semibold text-[#252B28] tabular-nums dark:text-[#F2F0E9]">
                        {formatFileSize(sourceImage.size)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-[#56615B] dark:text-[#B9C5BD]">
                        Compressed Size
                      </p>
                      <p className="mt-0.5 font-mono text-sm font-semibold text-[#252B28] tabular-nums dark:text-[#F2F0E9]">
                        {formatFileSize(compressedOutput.size)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-[#56615B] dark:text-[#B9C5BD]">
                        Size Difference
                      </p>
                      <p
                        className={`mt-0.5 font-mono text-sm font-semibold tabular-nums ${
                          compressionStats.outcome === 'reduced'
                            ? 'text-[#173F35] dark:text-[#D9B978]'
                            : compressionStats.outcome === 'increased'
                              ? 'text-amber-800 dark:text-amber-300'
                              : 'text-[#56615B] dark:text-[#B9C5BD]'
                        }`}
                      >
                        {compressionStats.summaryLabel}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-[#56615B] dark:text-[#B9C5BD]">
                        Output Format &amp; Size
                      </p>
                      <p className="mt-0.5 font-mono text-sm font-semibold text-[#252B28] tabular-nums dark:text-[#F2F0E9]">
                        {OUTPUT_FORMAT_META[compressedOutput.format].label} ·{' '}
                        {compressedOutput.width}×{compressedOutput.height}
                      </p>
                    </div>
                  </div>

                  {compressionStats.outcome === 'increased' && (
                    <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-700/20 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-400/25 dark:bg-amber-950/40 dark:text-amber-200">
                      <AlertTriangle
                        className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300"
                        aria-hidden="true"
                      />
                      <span>
                        This compressed output is larger than the original file (
                        {formatFileSize(compressedOutput.size)} vs.{' '}
                        {formatFileSize(sourceImage.size)}). Try lowering the
                        quality slider or switching to WebP or JPEG for a
                        smaller file.
                      </span>
                    </p>
                  )}
                </div>
              )}

              {needsRefreshNotice && compressedOutput && (
                <p className="flex items-start gap-2 rounded-xl bg-[#EDE9DF] px-3.5 py-2.5 text-xs text-[#252B28] dark:bg-[#17231F] dark:text-[#B9C5BD]">
                  <Info
                    className="mt-0.5 h-4 w-4 shrink-0 text-[#7D5C23] dark:text-[#D9B978]"
                    aria-hidden="true"
                  />
                  <span>
                    Compression settings changed. Click{' '}
                    <strong>Compress Again</strong> to update the preview and
                    export file.
                  </span>
                </p>
              )}
            </div>
          )}

          {errorMessage && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-red-700/25 bg-red-50 px-4 py-3 text-xs font-medium text-red-900 dark:border-red-400/30 dark:bg-red-950/50 dark:text-red-200"
            >
              <AlertCircle
                className="mt-0.5 h-4 w-4 shrink-0 text-red-700 dark:text-red-300"
                aria-hidden="true"
              />
              <span>{errorMessage}</span>
            </p>
          )}
        </div>

        {/* Right: Compression Controls */}
        <div className="flex flex-col justify-between border-t border-[#DCDDD3] pt-6 lg:col-span-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8 dark:border-[#35463E]">
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#252B28] dark:text-[#F2F0E9]">
              <SlidersHorizontal
                className="h-4 w-4 text-[#7D5C23] dark:text-[#D9B978]"
                aria-hidden="true"
              />
              <span>Compression Settings</span>
            </div>

            {/* Compression Level Presets */}
            <div>
              <span className="block text-sm font-medium text-[#252B28] dark:text-[#F2F0E9]">
                Compression Level
              </span>
              <div
                role="group"
                aria-label="Compression level presets"
                className="mt-2 space-y-2"
              >
                {COMPRESSION_LEVELS.map((level) => {
                  const selected = activePreset === level.id;
                  return (
                    <button
                      key={level.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setQuality(level.quality);
                        markSettingsChanged();
                      }}
                      className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                        selected
                          ? 'border-[#173F35] bg-[#173F35] text-[#F2F0E9] dark:border-[#D9B978] dark:bg-[#315D4D]'
                          : 'border-[#DCDDD3] bg-white text-[#252B28] hover:border-[#C49A58] dark:border-[#35463E] dark:bg-[#24332C] dark:text-[#F2F0E9] dark:hover:border-[#D9B978]'
                      }`}
                    >
                      <div>
                        <p className="text-xs font-semibold">{level.label}</p>
                        <p
                          className={`mt-0.5 text-[11px] ${
                            selected
                              ? 'text-[#EDE9DF]/90'
                              : 'text-[#56615B] dark:text-[#B9C5BD]'
                          }`}
                        >
                          {level.description}
                        </p>
                      </div>
                      <span
                        className={`font-mono text-xs font-semibold tabular-nums ${
                          selected
                            ? 'text-[#D9B978]'
                            : 'text-[#173F35] dark:text-[#D9B978]'
                        }`}
                      >
                        {level.quality}%
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Quality Slider */}
            <div>
              <div className="flex items-center justify-between text-sm">
                <label
                  htmlFor="compressor-quality"
                  className="font-medium text-[#252B28] dark:text-[#F2F0E9]"
                >
                  Custom Quality
                </label>
                <span className="font-mono text-sm font-semibold text-[#173F35] tabular-nums dark:text-[#D9B978]">
                  {quality}%
                </span>
              </div>
              <input
                id="compressor-quality"
                type="range"
                min={10}
                max={100}
                step={1}
                value={quality}
                disabled={effectiveFormat === 'png'}
                onChange={(e) => {
                  setQuality(Number(e.target.value));
                  markSettingsChanged();
                }}
                className="mt-2.5 w-full cursor-pointer accent-[#173F35] disabled:cursor-not-allowed disabled:opacity-45 dark:accent-[#D9B978]"
              />
              <div className="mt-1 flex justify-between text-xs text-[#56615B] dark:text-[#B9C5BD]">
                <span>10% (Smallest)</span>
                <span>80% (Default)</span>
                <span>100% (Max)</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-[#56615B] dark:text-[#B9C5BD]">
                Compression results vary depending on image format, resolution,
                and visual complexity.
              </p>
            </div>

            {/* Output Format Selector */}
            <div className="space-y-3 border-t border-[#DCDDD3] pt-5 dark:border-[#35463E]">
              <span className="block text-sm font-medium text-[#252B28] dark:text-[#F2F0E9]">
                Output Format
              </span>
              <div
                role="radiogroup"
                aria-label="Output format"
                className="grid grid-cols-2 gap-1.5 rounded-lg bg-[#EDE9DF] p-1 sm:grid-cols-4 dark:bg-[#17231F]"
              >
                {OUTPUT_CHOICES.map((item) => {
                  const selected = outputChoice === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => {
                        setOutputChoice(item.id);
                        setErrorMessage('');
                        markSettingsChanged();
                      }}
                      className={`min-h-9 rounded-md px-2 text-xs font-semibold transition-colors ${
                        selected
                          ? 'bg-white text-[#173F35] shadow-xs dark:bg-[#24332C] dark:text-[#F2F0E9]'
                          : 'text-[#56615B] hover:text-[#252B28] dark:text-[#B9C5BD] dark:hover:text-[#F2F0E9]'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              {effectiveFormat === 'png' && (
                <p className="rounded-lg border border-[#DCDDD3] bg-[#EDE9DF]/40 px-3 py-2.5 text-xs leading-relaxed text-[#56615B] dark:border-[#35463E] dark:bg-[#17231F]/65 dark:text-[#B9C5BD]">
                  PNG uses lossless compression, so quality percentage does not
                  reduce PNG file size and re-encoding may not always shrink an
                  already optimized PNG. Consider WebP or JPEG for smaller files.
                </p>
              )}

              {showJpegBgPicker && (
                <div>
                  <label
                    htmlFor="compressor-jpeg-bg"
                    className="block text-xs font-medium text-[#56615B] dark:text-[#B9C5BD]"
                  >
                    JPEG Background Color{' '}
                    {sourceImage?.hasTransparency
                      ? '(fills transparent pixels)'
                      : '(if source has transparency)'}
                  </label>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      id="compressor-jpeg-bg"
                      type="color"
                      value={jpegBackground}
                      onChange={(e) => {
                        setJpegBackground(e.target.value.toUpperCase());
                        markSettingsChanged();
                      }}
                      className="h-9 w-10 shrink-0 cursor-pointer rounded-lg border border-[#DCDDD3] bg-transparent p-1 dark:border-[#35463E]"
                    />
                    <span className="font-mono text-xs text-[#252B28] dark:text-[#F2F0E9]">
                      {jpegBackground}
                    </span>
                    <div
                      role="group"
                      aria-label="JPEG background color presets"
                      className="ml-auto flex items-center gap-1.5"
                    >
                      {JPEG_BG_SWATCHES.map((swatch) => {
                        const selected =
                          jpegBackground.toUpperCase() === swatch.hex;
                        return (
                          <button
                            key={swatch.hex}
                            type="button"
                            title={swatch.label}
                            aria-label={`Set JPEG background color to ${swatch.label}`}
                            aria-pressed={selected}
                            onClick={() => {
                              setJpegBackground(swatch.hex);
                              markSettingsChanged();
                            }}
                            className={`h-6 w-6 rounded-md border transition-transform hover:scale-105 ${
                              selected
                                ? 'ring-2 ring-[#C49A58] ring-offset-1 dark:ring-[#D9B978]'
                                : 'border-[#DCDDD3] dark:border-[#35463E]'
                            }`}
                            style={{ backgroundColor: swatch.hex }}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <p className="flex items-start gap-2 rounded-lg bg-[#EDE9DF]/70 px-3 py-2.5 text-xs leading-relaxed text-[#56615B] dark:bg-[#17231F] dark:text-[#B9C5BD]">
                <Info
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#7D5C23] dark:text-[#D9B978]"
                  aria-hidden="true"
                />
                <span>
                  JPEG does not support transparency; transparent PNG or WebP
                  images converted to JPEG use the selected background color.
                </span>
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 space-y-3 border-t border-[#DCDDD3] pt-5 dark:border-[#35463E]">
            <button
              type="button"
              onClick={handleCompress}
              disabled={!sourceImage || isProcessing}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#173F35] px-5 py-2.5 text-sm font-semibold text-[#F2F0E9] transition-colors duration-150 hover:bg-[#173F35]/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C49A58] disabled:cursor-not-allowed disabled:opacity-45 dark:bg-[#315D4D] dark:hover:bg-[#315D4D]/90"
            >
              <RefreshCw
                className={`h-4 w-4 ${isProcessing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>
                {isProcessing
                  ? 'Compressing...'
                  : compressedOutput
                    ? 'Compress Again'
                    : 'Compress Image'}
              </span>
            </button>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleDownload}
                disabled={!compressedOutput}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#C49A58] px-4 py-2.5 text-sm font-semibold text-[#17231F] transition-colors hover:bg-[#D9B978] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173F35] disabled:cursor-not-allowed disabled:opacity-45 dark:bg-[#D9B978] dark:hover:bg-[#C49A58]"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>Download Image</span>
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#DCDDD3] bg-white px-4 py-2.5 text-sm font-medium text-[#56615B] transition-colors hover:border-[#C49A58] hover:text-[#252B28] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C49A58] dark:border-[#35463E] dark:bg-[#24332C] dark:text-[#B9C5BD] dark:hover:border-[#D9B978] dark:hover:text-[#F2F0E9]"
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
