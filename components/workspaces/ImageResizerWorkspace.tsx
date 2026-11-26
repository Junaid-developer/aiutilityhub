import {
  AlertCircle,
  ArrowRight,
  Check,
  Download,
  Image as ImageIcon,
  Info,
  Lock,
  RefreshCw,
  RotateCcw,
  Trash2,
  Unlock,
  UploadCloud,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildOutputFilename,
  calculateLockedHeight,
  calculateLockedWidth,
  DEFAULT_JPEG_BACKGROUND,
  DEFAULT_RESIZE_QUALITY,
  formatFileSize,
  formatSizeDelta,
  loadImageDimensions,
  MAX_IMAGE_FILE_SIZE_BYTES,
  MAX_RESIZE_DIMENSION,
  OUTPUT_FORMAT_META,
  OutputImageFormat,
  RESIZE_PRESETS,
  resizeImageOnCanvas,
  validateDimensions,
  validateImageFile,
} from '../../utils/imageResizer';

interface SourceImageState {
  name: string;
  size: number;
  width: number;
  height: number;
  format: OutputImageFormat;
  objectUrl: string;
}

interface ResizedOutputState {
  objectUrl: string;
  size: number;
  width: number;
  height: number;
  format: OutputImageFormat;
  filename: string;
}

const OUTPUT_FORMATS: OutputImageFormat[] = ['jpeg', 'png', 'webp'];

const JPEG_BG_SWATCHES = [
  { label: 'White', hex: '#FFFFFF' },
  { label: 'Warm Ivory', hex: '#EDE9DF' },
  { label: 'Forest Green', hex: '#173F35' },
  { label: 'Black', hex: '#000000' },
];

export function ImageResizerWorkspace() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sourceUrlRef = useRef<string | null>(null);
  const resizedUrlRef = useRef<string | null>(null);
  const dragDepthRef = useRef(0);

  const [isDragging, setIsDragging] = useState(false);
  const [sourceImage, setSourceImage] = useState<SourceImageState | null>(null);
  const [resizedOutput, setResizedOutput] =
    useState<ResizedOutputState | null>(null);

  const [widthInput, setWidthInput] = useState('800');
  const [heightInput, setHeightInput] = useState('600');
  const [aspectLocked, setAspectLocked] = useState(true);
  const [maintainOriginal, setMaintainOriginal] = useState(true);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

  const [outputFormat, setOutputFormat] = useState<OutputImageFormat>('jpeg');
  const [quality, setQuality] = useState<number>(DEFAULT_RESIZE_QUALITY);
  const [jpegBackground, setJpegBackground] = useState<string>(
    DEFAULT_JPEG_BACKGROUND
  );

  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [needsRefreshNotice, setNeedsRefreshNotice] = useState(false);

  const revokeSourceUrl = useCallback(() => {
    if (sourceUrlRef.current) {
      URL.revokeObjectURL(sourceUrlRef.current);
      sourceUrlRef.current = null;
    }
  }, []);

  const revokeResizedUrl = useCallback(() => {
    if (resizedUrlRef.current) {
      URL.revokeObjectURL(resizedUrlRef.current);
      resizedUrlRef.current = null;
    }
  }, []);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      revokeSourceUrl();
      revokeResizedUrl();
    };
  }, [revokeSourceUrl, revokeResizedUrl]);

  const markSettingsChanged = useCallback(() => {
    if (resizedUrlRef.current) {
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

        revokeSourceUrl();
        revokeResizedUrl();

        sourceUrlRef.current = meta.objectUrl;
        setSourceImage({
          name: file.name,
          size: file.size,
          width: meta.width,
          height: meta.height,
          format: validation.detectedFormat,
          objectUrl: meta.objectUrl,
        });
        setResizedOutput(null);
        setNeedsRefreshNotice(false);

        setWidthInput(String(meta.width));
        setHeightInput(String(meta.height));
        setMaintainOriginal(true);
        setAspectLocked(true);
        setSelectedPresetId(null);
        setOutputFormat(validation.detectedFormat);
        setQuality(DEFAULT_RESIZE_QUALITY);
        setJpegBackground(DEFAULT_JPEG_BACKGROUND);
      } catch (err) {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Unable to load the selected image file.'
        );
      }
    },
    [revokeResizedUrl, revokeSourceUrl]
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

  const handleWidthChange = (raw: string) => {
    if (raw !== '' && !/^\d+$/.test(raw)) return;
    setErrorMessage('');
    setSelectedPresetId(null);
    setMaintainOriginal(false);
    setWidthInput(raw);
    markSettingsChanged();

    const parsed = Number(raw);
    if (raw !== '' && parsed > 0 && aspectLocked && sourceImage) {
      const nextHeight = calculateLockedHeight(
        parsed,
        sourceImage.width,
        sourceImage.height
      );
      setHeightInput(String(nextHeight));
    }
  };

  const handleHeightChange = (raw: string) => {
    if (raw !== '' && !/^\d+$/.test(raw)) return;
    setErrorMessage('');
    setSelectedPresetId(null);
    setMaintainOriginal(false);
    setHeightInput(raw);
    markSettingsChanged();

    const parsed = Number(raw);
    if (raw !== '' && parsed > 0 && aspectLocked && sourceImage) {
      const nextWidth = calculateLockedWidth(
        parsed,
        sourceImage.width,
        sourceImage.height
      );
      setWidthInput(String(nextWidth));
    }
  };

  const handleToggleAspectLock = (checked: boolean) => {
    setAspectLocked(checked);
    setErrorMessage('');
    markSettingsChanged();

    if (checked && sourceImage) {
      const parsedW = Number(widthInput);
      if (Number.isFinite(parsedW) && parsedW > 0) {
        const syncedH = calculateLockedHeight(
          parsedW,
          sourceImage.width,
          sourceImage.height
        );
        setHeightInput(String(syncedH));
      }
    }
  };

  const handleToggleMaintainOriginal = (checked: boolean) => {
    setMaintainOriginal(checked);
    setErrorMessage('');
    markSettingsChanged();

    if (checked && sourceImage) {
      setSelectedPresetId(null);
      setWidthInput(String(sourceImage.width));
      setHeightInput(String(sourceImage.height));
      setAspectLocked(true);
    }
  };

  const handlePresetSelect = (preset: (typeof RESIZE_PRESETS)[number]) => {
    setErrorMessage('');
    setSelectedPresetId(preset.id);
    setMaintainOriginal(false);
    setWidthInput(String(preset.width));
    setHeightInput(String(preset.height));
    markSettingsChanged();

    if (sourceImage) {
      const originalRatio = sourceImage.width / sourceImage.height;
      const presetRatio = preset.width / preset.height;
      if (Math.abs(originalRatio - presetRatio) > 0.01) {
        setAspectLocked(false);
      }
    }
  };

  const handleResizeClick = async () => {
    if (!sourceImage) {
      setErrorMessage('Please upload a JPG, PNG, or WebP image first.');
      return;
    }

    const dimCheck = validateDimensions(widthInput, heightInput);
    if (!dimCheck.ok) {
      setErrorMessage(dimCheck.error);
      return;
    }

    setErrorMessage('');
    setIsProcessing(true);

    try {
      const result = await resizeImageOnCanvas({
        sourceUrl: sourceImage.objectUrl,
        width: dimCheck.width,
        height: dimCheck.height,
        format: outputFormat,
        qualityPercent: quality,
        backgroundColor: jpegBackground,
      });

      revokeResizedUrl();
      resizedUrlRef.current = result.objectUrl;

      setResizedOutput({
        objectUrl: result.objectUrl,
        size: result.size,
        width: result.width,
        height: result.height,
        format: result.format,
        filename: buildOutputFilename(
          sourceImage.name,
          result.width,
          result.height,
          result.format
        ),
      });
      setNeedsRefreshNotice(false);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Failed to resize image. Please check the dimensions and try again.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!resizedOutput) return;
    const link = document.createElement('a');
    link.href = resizedOutput.objectUrl;
    link.download = resizedOutput.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleReset = () => {
    setErrorMessage('');
    revokeResizedUrl();
    setResizedOutput(null);
    setNeedsRefreshNotice(false);
    setSelectedPresetId(null);
    setQuality(DEFAULT_RESIZE_QUALITY);
    setJpegBackground(DEFAULT_JPEG_BACKGROUND);

    if (sourceImage) {
      setWidthInput(String(sourceImage.width));
      setHeightInput(String(sourceImage.height));
      setMaintainOriginal(true);
      setAspectLocked(true);
      setOutputFormat(sourceImage.format);
    } else {
      setWidthInput('800');
      setHeightInput('600');
      setMaintainOriginal(true);
      setAspectLocked(true);
      setOutputFormat('jpeg');
    }
  };

  const handleRemoveImage = () => {
    revokeSourceUrl();
    revokeResizedUrl();
    setSourceImage(null);
    setResizedOutput(null);
    setErrorMessage('');
    setNeedsRefreshNotice(false);
    setSelectedPresetId(null);
    setWidthInput('800');
    setHeightInput('600');
    setMaintainOriginal(true);
    setAspectLocked(true);
    setOutputFormat('jpeg');
    setQuality(DEFAULT_RESIZE_QUALITY);
    setJpegBackground(DEFAULT_JPEG_BACKGROUND);
  };

  const activeFormatMeta = OUTPUT_FORMAT_META[outputFormat];

  return (
    <div className="rounded-[18px] border border-[#DCDDD3] bg-white p-5 shadow-[0_2px_10px_-3px_rgba(23,63,53,0.06)] sm:p-8 dark:border-[#35463E] dark:bg-[#24332C] dark:shadow-[0_2px_10px_-3px_rgba(0,0,0,0.24)]">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        onChange={handleFileInputChange}
        className="sr-only"
        aria-label="Upload image file"
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left: Upload Zone & Previews */}
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
                Drag and drop your image here
              </p>
              <p className="mt-1.5 max-w-sm text-sm text-[#56615B] dark:text-[#B9C5BD]">
                Supports JPG / JPEG, PNG, and WebP up to{' '}
                {formatFileSize(MAX_IMAGE_FILE_SIZE_BYTES)}. Processed locally in
                your browser.
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
              {/* Uploaded File Header & Replace/Remove Actions */}
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

              {/* Dual Preview Panels */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Original Preview */}
                <div className="flex flex-col rounded-xl border border-[#DCDDD3] bg-[#EDE9DF]/30 p-3.5 dark:border-[#35463E] dark:bg-[#17231F]/60">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                      Original Image
                    </span>
                    <span className="font-mono text-[#56615B] tabular-nums dark:text-[#B9C5BD]">
                      {sourceImage.width} × {sourceImage.height}
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
                    <span>File size</span>
                    <span className="font-mono font-semibold text-[#252B28] tabular-nums dark:text-[#F2F0E9]">
                      {formatFileSize(sourceImage.size)}
                    </span>
                  </div>
                </div>

                {/* Resized Preview */}
                <div className="flex flex-col rounded-xl border border-[#DCDDD3] bg-[#EDE9DF]/30 p-3.5 dark:border-[#35463E] dark:bg-[#17231F]/60">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                      Resized Output
                    </span>
                    <span className="font-mono text-[#56615B] tabular-nums dark:text-[#B9C5BD]">
                      {resizedOutput
                        ? `${resizedOutput.width} × ${resizedOutput.height}`
                        : `${widthInput || '—'} × ${heightInput || '—'}`}
                    </span>
                  </div>

                  <div className="mt-3 flex h-52 items-center justify-center overflow-hidden rounded-lg border border-[#DCDDD3]/80 bg-[linear-gradient(45deg,rgba(104,115,109,0.1)_25%,transparent_25%),linear-gradient(-45deg,rgba(104,115,109,0.1)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,rgba(104,115,109,0.1)_75%),linear-gradient(-45deg,transparent_75%,rgba(104,115,109,0.1)_75%)] bg-[length:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0] p-2 dark:border-[#35463E]">
                    {resizedOutput ? (
                      <img
                        src={resizedOutput.objectUrl}
                        alt={`Resized preview (${resizedOutput.width} by ${resizedOutput.height})`}
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 px-4 text-center text-xs text-[#56615B] dark:text-[#B9C5BD]">
                        <ArrowRight className="h-5 w-5 opacity-60" aria-hidden="true" />
                        <span>
                          Adjust dimensions or format, then click{' '}
                          <strong className="font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                            Resize Image
                          </strong>
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-[#56615B] dark:text-[#B9C5BD]">
                    <span>
                      {resizedOutput
                        ? `Output (${OUTPUT_FORMAT_META[resizedOutput.format].label})`
                        : 'Output size'}
                    </span>
                    <span className="font-mono font-semibold text-[#252B28] tabular-nums dark:text-[#F2F0E9]">
                      {resizedOutput
                        ? `${formatFileSize(resizedOutput.size)} (${formatSizeDelta(
                            sourceImage.size,
                            resizedOutput.size
                          )})`
                        : 'Pending'}
                    </span>
                  </div>
                </div>
              </div>

              {needsRefreshNotice && resizedOutput && (
                <p className="flex items-start gap-2 rounded-xl bg-[#EDE9DF] px-3.5 py-2.5 text-xs text-[#252B28] dark:bg-[#17231F] dark:text-[#B9C5BD]">
                  <Info
                    className="mt-0.5 h-4 w-4 shrink-0 text-[#7D5C23] dark:text-[#D9B978]"
                    aria-hidden="true"
                  />
                  <span>
                    Settings have changed since the last resize. Click{' '}
                    <strong>Resize Image</strong> to update the preview and download file.
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

        {/* Right: Resize Controls & Output Settings */}
        <div className="flex flex-col justify-between border-t border-[#DCDDD3] pt-6 lg:col-span-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8 dark:border-[#35463E]">
          <div className="space-y-6">
            {/* Presets */}
            <div>
              <span className="block text-sm font-medium text-[#252B28] dark:text-[#F2F0E9]">
                Preset Dimensions
              </span>
              <div
                role="group"
                aria-label="Preset Dimensions"
                className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2"
              >
                {RESIZE_PRESETS.map((preset) => {
                  const active = selectedPresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => handlePresetSelect(preset)}
                      className={`min-h-10 rounded-lg border px-3 py-2 font-mono text-xs font-semibold tabular-nums transition-colors ${
                        active
                          ? 'border-[#173F35] bg-[#173F35] text-[#F2F0E9] dark:border-[#D9B978] dark:bg-[#315D4D]'
                          : 'border-[#DCDDD3] text-[#56615B] hover:border-[#C49A58] hover:text-[#252B28] dark:border-[#35463E] dark:text-[#B9C5BD] dark:hover:text-[#F2F0E9]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Width & Height Inputs */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="resizer-width"
                    className="block text-xs font-medium text-[#56615B] dark:text-[#B9C5BD]"
                  >
                    Width (px)
                  </label>
                  <input
                    id="resizer-width"
                    type="number"
                    min={1}
                    max={MAX_RESIZE_DIMENSION}
                    step={1}
                    value={widthInput}
                    onChange={(e) => handleWidthChange(e.target.value)}
                    placeholder="Width"
                    className="mt-1.5 h-10 w-full rounded-lg border border-[#DCDDD3] bg-[#EDE9DF]/35 px-3 font-mono text-sm text-[#252B28] tabular-nums focus:border-[#173F35] focus:outline-none dark:border-[#35463E] dark:bg-[#17231F] dark:text-[#F2F0E9] dark:focus:border-[#D9B978]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="resizer-height"
                    className="block text-xs font-medium text-[#56615B] dark:text-[#B9C5BD]"
                  >
                    Height (px)
                  </label>
                  <input
                    id="resizer-height"
                    type="number"
                    min={1}
                    max={MAX_RESIZE_DIMENSION}
                    step={1}
                    value={heightInput}
                    onChange={(e) => handleHeightChange(e.target.value)}
                    placeholder="Height"
                    className="mt-1.5 h-10 w-full rounded-lg border border-[#DCDDD3] bg-[#EDE9DF]/35 px-3 font-mono text-sm text-[#252B28] tabular-nums focus:border-[#173F35] focus:outline-none dark:border-[#35463E] dark:bg-[#17231F] dark:text-[#F2F0E9] dark:focus:border-[#D9B978]"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2.5 pt-1">
                <label className="inline-flex cursor-pointer items-center gap-2.5 text-xs font-medium text-[#252B28] dark:text-[#F2F0E9]">
                  <input
                    type="checkbox"
                    checked={aspectLocked}
                    onChange={(e) => handleToggleAspectLock(e.target.checked)}
                    className="h-4 w-4 rounded border-[#DCDDD3] accent-[#173F35] dark:accent-[#D9B978]"
                  />
                  {aspectLocked ? (
                    <Lock
                      className="h-3.5 w-3.5 text-[#173F35] dark:text-[#D9B978]"
                      aria-hidden="true"
                    />
                  ) : (
                    <Unlock
                      className="h-3.5 w-3.5 text-[#56615B] dark:text-[#B9C5BD]"
                      aria-hidden="true"
                    />
                  )}
                  <span>Lock Aspect Ratio</span>
                </label>

                <label className="inline-flex cursor-pointer items-center gap-2.5 text-xs font-medium text-[#252B28] dark:text-[#F2F0E9]">
                  <input
                    type="checkbox"
                    checked={maintainOriginal}
                    onChange={(e) =>
                      handleToggleMaintainOriginal(e.target.checked)
                    }
                    className="h-4 w-4 rounded border-[#DCDDD3] accent-[#173F35] dark:accent-[#D9B978]"
                  />
                  <span>
                    Maintain Original Dimensions
                    {sourceImage
                      ? ` (${sourceImage.width} × ${sourceImage.height})`
                      : ''}
                  </span>
                </label>
              </div>
            </div>

            {/* Output Settings */}
            <div className="space-y-4 border-t border-[#DCDDD3] pt-5 dark:border-[#35463E]">
              <div>
                <span className="block text-sm font-medium text-[#252B28] dark:text-[#F2F0E9]">
                  Output Format
                </span>
                <div
                  role="radiogroup"
                  aria-label="Output image format"
                  className="mt-2 grid grid-cols-3 gap-1.5 rounded-lg bg-[#EDE9DF] p-1 dark:bg-[#17231F]"
                >
                  {OUTPUT_FORMATS.map((fmt) => {
                    const selected = outputFormat === fmt;
                    return (
                      <button
                        key={fmt}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => {
                          setOutputFormat(fmt);
                          setErrorMessage('');
                          markSettingsChanged();
                        }}
                        className={`min-h-9 rounded-md text-xs font-semibold transition-colors ${
                          selected
                            ? 'bg-white text-[#173F35] shadow-xs dark:bg-[#24332C] dark:text-[#F2F0E9]'
                            : 'text-[#56615B] hover:text-[#252B28] dark:text-[#B9C5BD] dark:hover:text-[#F2F0E9]'
                        }`}
                      >
                        {OUTPUT_FORMAT_META[fmt].label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {activeFormatMeta.supportsQuality ? (
                <div>
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="resizer-quality"
                      className="text-sm font-medium text-[#252B28] dark:text-[#F2F0E9]"
                    >
                      Quality
                    </label>
                    <span className="font-mono text-xs font-semibold text-[#173F35] tabular-nums dark:text-[#D9B978]">
                      {quality}%
                    </span>
                  </div>
                  <input
                    id="resizer-quality"
                    type="range"
                    min={10}
                    max={100}
                    step={1}
                    value={quality}
                    onChange={(e) => {
                      setQuality(Number(e.target.value));
                      markSettingsChanged();
                    }}
                    className="mt-2 w-full cursor-pointer accent-[#173F35] dark:accent-[#D9B978]"
                  />
                </div>
              ) : (
                <div className="rounded-lg border border-[#DCDDD3] bg-[#EDE9DF]/35 px-3 py-2.5 text-xs text-[#56615B] dark:border-[#35463E] dark:bg-[#17231F]/60 dark:text-[#B9C5BD]">
                  PNG uses lossless compression, so a quality slider is not needed.
                </div>
              )}

              {outputFormat === 'jpeg' && (
                <div>
                  <label
                    htmlFor="resizer-jpeg-bg"
                    className="block text-xs font-medium text-[#56615B] dark:text-[#B9C5BD]"
                  >
                    JPEG Background Color (for transparent areas)
                  </label>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      id="resizer-jpeg-bg"
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
                        const active =
                          jpegBackground.toUpperCase() === swatch.hex;
                        return (
                          <button
                            key={swatch.hex}
                            type="button"
                            title={swatch.label}
                            aria-label={`Set JPEG background color to ${swatch.label}`}
                            aria-pressed={active}
                            onClick={() => {
                              setJpegBackground(swatch.hex);
                              markSettingsChanged();
                            }}
                            className={`h-6 w-6 rounded-md border transition-transform hover:scale-105 ${
                              active
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
                  PNG preserves transparency (and WebP supports transparency),
                  while converting transparent images to JPEG fills transparent
                  areas with the selected background color.
                </span>
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 space-y-3 border-t border-[#DCDDD3] pt-5 dark:border-[#35463E]">
            <button
              type="button"
              onClick={handleResizeClick}
              disabled={!sourceImage || isProcessing}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#173F35] px-5 py-2.5 text-sm font-semibold text-[#F2F0E9] transition-colors duration-150 hover:bg-[#173F35]/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C49A58] disabled:cursor-not-allowed disabled:opacity-45 dark:bg-[#315D4D] dark:hover:bg-[#315D4D]/90"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              <span>{isProcessing ? 'Resizing...' : 'Resize Image'}</span>
            </button>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleDownload}
                disabled={!resizedOutput}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#C49A58] px-4 py-2.5 text-sm font-semibold text-[#17231F] transition-colors hover:bg-[#D9B978] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173F35] disabled:cursor-not-allowed disabled:opacity-45 dark:bg-[#D9B978] dark:hover:bg-[#C49A58]"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>Download Image</span>
              </button>

              <button
                type="button"
                onClick={handleReset}
                disabled={!sourceImage}
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
