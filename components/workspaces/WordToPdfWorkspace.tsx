import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FilePlus2,
  FileText,
  Info,
  Loader2,
  RefreshCw,
  RotateCcw,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPdfObjectUrl } from '../../utils/pdfTools';
import { renderPdfPreviewPages } from '../../utils/pdfThumbnails';
import {
  convertDocxToPdf,
  formatDocxFileSize,
  MAX_DOCX_FILE_SIZE_BYTES,
  Orientation,
  PaperSize,
  validateDocxFileMeta,
  WordToPdfResult,
} from '../../utils/wordToPdf';

interface UploadedDocxFile {
  name: string;
  size: number;
  arrayBuffer: ArrayBuffer;
}

interface ConvertedPdfOutput {
  filename: string;
  objectUrl: string;
  size: number;
  pageCount: number;
  previewPages: string[];
  previewTruncated: boolean;
  warnings: string[];
  stats: WordToPdfResult['extractedStats'];
}

export function WordToPdfWorkspace() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const outputUrlRef = useRef<string | null>(null);
  const dragDepthRef = useRef(0);

  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<UploadedDocxFile | null>(
    null
  );
  const [paperSize, setPaperSize] = useState<PaperSize>('a4');
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [standardizeTypography, setStandardizeTypography] = useState(true);

  const [isReadingFile, setIsReadingFile] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [isRenderingPreview, setIsRenderingPreview] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [convertedOutput, setConvertedOutput] =
    useState<ConvertedPdfOutput | null>(null);
  const [activePreviewPage, setActivePreviewPage] = useState(1);
  const [settingsChanged, setSettingsChanged] = useState(false);

  const revokeOutputUrl = useCallback(() => {
    if (outputUrlRef.current) {
      URL.revokeObjectURL(outputUrlRef.current);
      outputUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      revokeOutputUrl();
    };
  }, [revokeOutputUrl]);

  const clearOutput = useCallback(() => {
    revokeOutputUrl();
    setConvertedOutput(null);
    setActivePreviewPage(1);
    setSettingsChanged(false);
  }, [revokeOutputUrl]);

  const handleSelectedFile = useCallback(
    async (file: File) => {
      setErrorMessage('');
      const metaCheck = validateDocxFileMeta(file);
      if (!metaCheck.ok) {
        setErrorMessage(metaCheck.error);
        return;
      }

      setIsReadingFile(true);
      try {
        const buffer = await file.arrayBuffer();
        clearOutput();
        setUploadedFile({
          name: file.name,
          size: file.size,
          arrayBuffer: buffer,
        });
      } catch {
        setErrorMessage(
          'Unable to read the selected Word document. Please try choosing the file again.'
        );
      } finally {
        setIsReadingFile(false);
      }
    },
    [clearOutput]
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

  const handleConvert = async () => {
    if (!uploadedFile) {
      setErrorMessage('Please upload a Microsoft Word (.docx) document first.');
      return;
    }

    setErrorMessage('');
    setIsConverting(true);
    clearOutput();

    try {
      const result = await convertDocxToPdf(
        uploadedFile.arrayBuffer,
        uploadedFile.name,
        {
          paperSize,
          orientation,
          standardizeTypography,
        }
      );

      const { objectUrl, size } = createPdfObjectUrl(result.pdfBytes);
      outputUrlRef.current = objectUrl;

      let previewPages: string[] = [];
      let previewTruncated = false;

      setIsRenderingPreview(true);
      try {
        const preview = await renderPdfPreviewPages(result.pdfBytes, 20);
        previewPages = preview.pages;
        previewTruncated = preview.truncated;
      } catch {
        // Fallback smoothly to metadata summary if canvas preview rendering fails
        previewPages = [];
      } finally {
        setIsRenderingPreview(false);
      }

      setConvertedOutput({
        filename: result.filename,
        objectUrl,
        size,
        pageCount: result.pageCount,
        previewPages,
        previewTruncated,
        warnings: result.warnings,
        stats: result.extractedStats,
      });
      setActivePreviewPage(1);
      setSettingsChanged(false);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Unable to convert this Word document into PDF.'
      );
    } finally {
      setIsConverting(false);
    }
  };

  const handleDownload = () => {
    if (!convertedOutput) return;
    const link = document.createElement('a');
    link.href = convertedOutput.objectUrl;
    link.download = convertedOutput.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleReset = () => {
    clearOutput();
    setErrorMessage('');
    setPaperSize('a4');
    setOrientation('portrait');
    setStandardizeTypography(true);
  };

  const handleRemoveFile = () => {
    clearOutput();
    setUploadedFile(null);
    setErrorMessage('');
  };

  const currentPreviewImg =
    convertedOutput?.previewPages[activePreviewPage - 1] ?? '';

  return (
    <div className="rounded-[18px] border border-[#DCDDD3] bg-white p-5 shadow-[0_2px_10px_-3px_rgba(23,63,53,0.06)] sm:p-8 dark:border-[#35463E] dark:bg-[#24332C] dark:shadow-[0_2px_10px_-3px_rgba(0,0,0,0.24)]">
      <input
        ref={fileInputRef}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={handleFileInputChange}
        className="sr-only"
        aria-label="Upload Microsoft Word DOCX file"
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left: DOCX Upload Area & PDF Output Preview */}
        <div className="space-y-6 lg:col-span-7">
          {!uploadedFile ? (
            <div
              role="region"
              aria-label="DOCX upload dropzone"
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`flex min-h-[230px] flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
                isDragging
                  ? 'border-[#173F35] bg-[#E3EAE4]/60 dark:border-[#D9B978] dark:bg-[#30483C]/50'
                  : 'border-[#DCDDD3] bg-[#EDE9DF]/45 hover:border-[#C49A58] dark:border-[#35463E] dark:bg-[#17231F]/60 dark:hover:border-[#D9B978]'
              }`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#173F35] text-[#EDE9DF] dark:bg-[#315D4D] dark:text-[#F2F0E9]">
                <UploadCloud className="h-6 w-6" aria-hidden="true" />
              </div>
              <p className="mt-4 font-display text-lg font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                Drag and drop a Word (.docx) document
              </p>
              <p className="mt-1.5 max-w-sm text-sm text-[#56615B] dark:text-[#B9C5BD]">
                Supports Microsoft Word (.docx) up to{' '}
                {formatDocxFileSize(MAX_DOCX_FILE_SIZE_BYTES)}. Processed locally
                in your browser with zero server uploads.
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isReadingFile}
                className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#173F35] px-5 py-2.5 text-sm font-semibold text-[#F2F0E9] transition-colors hover:bg-[#173F35]/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C49A58] disabled:opacity-50 dark:bg-[#315D4D] dark:hover:bg-[#315D4D]/90"
              >
                {isReadingFile ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <FilePlus2 className="h-4 w-4" aria-hidden="true" />
                )}
                <span>{isReadingFile ? 'Reading File...' : 'Select DOCX File'}</span>
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
                  <FilePlus2 className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                    {uploadedFile.name}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-[#56615B] tabular-nums dark:text-[#B9C5BD]">
                    {formatDocxFileSize(uploadedFile.size)} · Word Document
                    (.docx)
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#DCDDD3] bg-white px-3 text-xs font-semibold text-[#252B28] transition-colors hover:border-[#C49A58] dark:border-[#35463E] dark:bg-[#24332C] dark:text-[#F2F0E9] dark:hover:border-[#D9B978]"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    {convertedOutput ? 'Convert Another File' : 'Replace File'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#DCDDD3] bg-white px-3 text-xs font-semibold text-[#56615B] transition-colors hover:border-red-600/40 hover:text-red-700 dark:border-[#35463E] dark:bg-[#24332C] dark:text-[#B9C5BD] dark:hover:text-red-300"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Remove</span>
                </button>
              </div>
            </div>
          )}

          {/* Conversion Success Status */}
          {convertedOutput && (
            <div className="rounded-xl border border-[#173F35]/25 bg-[#E3EAE4]/60 p-4 dark:border-[#D9B978]/30 dark:bg-[#30483C]/45">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#173F35] dark:text-[#D9B978]">
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>PDF Generated Successfully</span>
                </div>
                <span className="font-mono text-xs font-semibold text-[#252B28] tabular-nums dark:text-[#F2F0E9]">
                  {convertedOutput.pageCount} page
                  {convertedOutput.pageCount === 1 ? '' : 's'} ·{' '}
                  {formatDocxFileSize(convertedOutput.size)}
                </span>
              </div>

              <p className="mt-2 text-xs text-[#252B28] dark:text-[#F2F0E9]">
                Converted{' '}
                {[
                  convertedOutput.stats.headings > 0 &&
                    `${convertedOutput.stats.headings} heading${
                      convertedOutput.stats.headings === 1 ? '' : 's'
                    }`,
                  convertedOutput.stats.paragraphs > 0 &&
                    `${convertedOutput.stats.paragraphs} paragraph${
                      convertedOutput.stats.paragraphs === 1 ? '' : 's'
                    }`,
                  convertedOutput.stats.lists > 0 &&
                    `${convertedOutput.stats.lists} list${
                      convertedOutput.stats.lists === 1 ? '' : 's'
                    }`,
                  convertedOutput.stats.tables > 0 &&
                    `${convertedOutput.stats.tables} table${
                      convertedOutput.stats.tables === 1 ? '' : 's'
                    }`,
                  convertedOutput.stats.images > 0 &&
                    `${convertedOutput.stats.images} image${
                      convertedOutput.stats.images === 1 ? '' : 's'
                    }`,
                ]
                  .filter(Boolean)
                  .join(', ') || 'document content'}
                .
              </p>

              {convertedOutput.warnings.length > 0 && (
                <p className="mt-2 text-xs text-[#56615B] dark:text-[#B9C5BD]">
                  Note: {convertedOutput.warnings[0]}
                </p>
              )}
            </div>
          )}

          {settingsChanged && convertedOutput && (
            <p className="flex items-start gap-2 rounded-xl bg-[#EDE9DF] px-3.5 py-2.5 text-xs text-[#252B28] dark:bg-[#17231F] dark:text-[#B9C5BD]">
              <Info
                className="mt-0.5 h-4 w-4 shrink-0 text-[#7D5C23] dark:text-[#D9B978]"
                aria-hidden="true"
              />
              <span>
                Page settings changed. Click <strong>Convert to PDF</strong> to
                regenerate the preview and downloadable PDF.
              </span>
            </p>
          )}

          {/* PDF Output Preview Area */}
          <div className="rounded-xl border border-[#DCDDD3] bg-[#EDE9DF]/35 p-5 dark:border-[#35463E] dark:bg-[#17231F]/60">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#56615B] dark:text-[#B9C5BD]">
              <span className="font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                PDF Output Preview
              </span>
              <span className="font-mono uppercase tabular-nums">
                {convertedOutput
                  ? `Page ${activePreviewPage} of ${convertedOutput.pageCount} · ${paperSize} ${orientation}`
                  : `${paperSize} · ${orientation}`}
              </span>
            </div>

            {convertedOutput ? (
              <div className="mt-4 space-y-4">
                <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-[#DCDDD3]/80 bg-[#EDE9DF]/60 p-4 dark:border-[#35463E] dark:bg-[#17231F]">
                  {isRenderingPreview ? (
                    <div className="flex flex-col items-center gap-2 text-xs text-[#56615B] dark:text-[#B9C5BD]">
                      <Loader2
                        className="h-5 w-5 animate-spin text-[#173F35] dark:text-[#D9B978]"
                        aria-hidden="true"
                      />
                      <span>Rendering PDF page preview...</span>
                    </div>
                  ) : currentPreviewImg ? (
                    <img
                      src={currentPreviewImg}
                      alt={`Converted PDF page ${activePreviewPage} preview`}
                      className="max-h-[420px] w-auto rounded-md border border-[#DCDDD3] bg-white shadow-sm dark:border-[#35463E]"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 px-4 text-center text-xs text-[#56615B] dark:text-[#B9C5BD]">
                      <FileText
                        className="h-8 w-8 text-[#173F35] dark:text-[#D9B978]"
                        aria-hidden="true"
                      />
                      <span className="font-medium text-[#252B28] dark:text-[#F2F0E9]">
                        {convertedOutput.filename} ({convertedOutput.pageCount}{' '}
                        page{convertedOutput.pageCount === 1 ? '' : 's'})
                      </span>
                      <span>
                        Visual preview unavailable in this browser session, but
                        your PDF file is ready to download below.
                      </span>
                    </div>
                  )}
                </div>

                {convertedOutput.previewPages.length > 1 && (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setActivePreviewPage((p) => Math.max(1, p - 1))
                      }
                      disabled={activePreviewPage <= 1}
                      className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#DCDDD3] bg-white px-3 text-xs font-semibold text-[#252B28] transition-colors hover:border-[#C49A58] disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#35463E] dark:bg-[#24332C] dark:text-[#F2F0E9]"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Previous</span>
                    </button>

                    <div
                      role="group"
                      aria-label="Preview page selector"
                      className="flex flex-wrap items-center justify-center gap-1.5"
                    >
                      {convertedOutput.previewPages.map((_, idx) => {
                        const pageNum = idx + 1;
                        const active = activePreviewPage === pageNum;
                        return (
                          <button
                            key={pageNum}
                            type="button"
                            onClick={() => setActivePreviewPage(pageNum)}
                            aria-label={`Inspect page ${pageNum}`}
                            aria-pressed={active}
                            className={`h-7 min-w-7 rounded-md px-2 font-mono text-xs font-semibold tabular-nums transition-colors ${
                              active
                                ? 'bg-[#173F35] text-[#F2F0E9] dark:bg-[#315D4D]'
                                : 'border border-[#DCDDD3] bg-white text-[#56615B] hover:border-[#C49A58] dark:border-[#35463E] dark:bg-[#24332C] dark:text-[#B9C5BD]'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      {convertedOutput.previewTruncated && (
                        <span className="px-1 text-xs text-[#56615B] dark:text-[#B9C5BD]">
                          +{convertedOutput.pageCount - convertedOutput.previewPages.length}{' '}
                          more
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setActivePreviewPage((p) =>
                          Math.min(convertedOutput.previewPages.length, p + 1)
                        )
                      }
                      disabled={
                        activePreviewPage >= convertedOutput.previewPages.length
                      }
                      className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#DCDDD3] bg-white px-3 text-xs font-semibold text-[#252B28] transition-colors hover:border-[#C49A58] disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#35463E] dark:bg-[#24332C] dark:text-[#F2F0E9]"
                    >
                      <span>Next</span>
                      <ChevronRight
                        className="h-3.5 w-3.5"
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4 flex min-h-[240px] items-center justify-center rounded-xl border border-[#DCDDD3]/80 bg-[#EDE9DF]/60 p-6 dark:border-[#35463E] dark:bg-[#17231F]">
                <div
                  className={`flex flex-col justify-between rounded-lg border border-[#DCDDD3] bg-white p-5 shadow-sm transition-all dark:border-[#35463E] dark:bg-[#24332C] ${
                    orientation === 'portrait'
                      ? 'aspect-[1/1.35] w-44 max-w-full'
                      : 'aspect-[1.35/1] w-64 max-w-full'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="h-2.5 w-2/3 rounded-sm bg-[#173F35]/80 dark:bg-[#D9B978]/80" />
                    <div className="h-1.5 w-full rounded-sm bg-[#DCDDD3] dark:bg-[#35463E]" />
                    <div className="h-1.5 w-5/6 rounded-sm bg-[#DCDDD3] dark:bg-[#35463E]" />
                    <div className="h-1.5 w-4/5 rounded-sm bg-[#DCDDD3] dark:bg-[#35463E]" />
                    <div className="space-y-1.5 pt-2">
                      <div className="h-1.5 w-full rounded-sm bg-[#DCDDD3]/80 dark:bg-[#35463E]/80" />
                      <div className="h-1.5 w-11/12 rounded-sm bg-[#DCDDD3]/80 dark:bg-[#35463E]/80" />
                      <div className="h-1.5 w-3/4 rounded-sm bg-[#DCDDD3]/80 dark:bg-[#35463E]/80" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-[#DCDDD3]/70 pt-2 font-mono text-[10px] text-[#56615B] dark:border-[#35463E] dark:text-[#B9C5BD]">
                    <span>
                      {uploadedFile ? 'Ready to convert' : 'PDF Preview'}
                    </span>
                    <span>01</span>
                  </div>
                </div>
              </div>
            )}
          </div>

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

        {/* Right: Export Controls & Download */}
        <div className="flex flex-col justify-between border-t border-[#DCDDD3] pt-6 lg:col-span-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8 dark:border-[#35463E]">
          <div className="space-y-6">
            <div>
              <span className="block text-sm font-medium text-[#252B28] dark:text-[#F2F0E9]">
                Paper Size
              </span>
              <div
                role="group"
                aria-label="Paper size"
                className="mt-2 grid grid-cols-3 gap-1.5 rounded-xl bg-[#EDE9DF] p-1 dark:bg-[#17231F]"
              >
                {(
                  [
                    { id: 'a4', label: 'A4' },
                    { id: 'letter', label: 'Letter' },
                    { id: 'legal', label: 'Legal' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={paperSize === item.id}
                    onClick={() => {
                      setPaperSize(item.id);
                      if (convertedOutput) setSettingsChanged(true);
                    }}
                    className={`min-h-9 rounded-lg text-xs font-semibold transition-colors ${
                      paperSize === item.id
                        ? 'bg-white text-[#173F35] shadow-xs dark:bg-[#24332C] dark:text-[#F2F0E9]'
                        : 'text-[#56615B] hover:text-[#252B28] dark:text-[#B9C5BD]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="block text-sm font-medium text-[#252B28] dark:text-[#F2F0E9]">
                Page Orientation
              </span>
              <div
                role="group"
                aria-label="Page orientation"
                className="mt-2 grid grid-cols-2 gap-1.5 rounded-xl bg-[#EDE9DF] p-1 dark:bg-[#17231F]"
              >
                {(
                  [
                    { id: 'portrait', label: 'Portrait' },
                    { id: 'landscape', label: 'Landscape' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={orientation === item.id}
                    onClick={() => {
                      setOrientation(item.id);
                      if (convertedOutput) setSettingsChanged(true);
                    }}
                    className={`min-h-9 rounded-lg text-xs font-semibold transition-colors ${
                      orientation === item.id
                        ? 'bg-white text-[#173F35] shadow-xs dark:bg-[#24332C] dark:text-[#F2F0E9]'
                        : 'text-[#56615B] hover:text-[#252B28] dark:text-[#B9C5BD]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#DCDDD3] bg-[#EDE9DF]/30 p-3.5 text-xs dark:border-[#35463E] dark:bg-[#17231F]/60">
              <input
                type="checkbox"
                checked={standardizeTypography}
                onChange={(e) => {
                  setStandardizeTypography(e.target.checked);
                  if (convertedOutput) setSettingsChanged(true);
                }}
                className="mt-0.5 h-4 w-4 rounded border-[#DCDDD3] accent-[#173F35] dark:accent-[#D9B978]"
              />
              <span>
                <span className="block font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                  Standard margins &amp; balanced typography
                </span>
                <span className="mt-0.5 block text-[#56615B] dark:text-[#B9C5BD]">
                  Use comfortable 0.75 in page margins and clean heading
                  hierarchy
                </span>
              </span>
            </label>

            <div className="rounded-xl border border-[#DCDDD3] bg-[#EDE9DF]/40 p-4 dark:border-[#35463E] dark:bg-[#17231F]/65">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#E3EAE4] text-[#173F35] dark:bg-[#30483C] dark:text-[#D9B978]">
                  <FileText className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                    {convertedOutput
                      ? convertedOutput.filename
                      : uploadedFile
                        ? uploadedFile.name.replace(/\.docx$/i, '.pdf')
                        : 'document-export.pdf'}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#56615B] dark:text-[#B9C5BD]">
                    {convertedOutput
                      ? `${convertedOutput.pageCount} page${
                          convertedOutput.pageCount === 1 ? '' : 's'
                        } · ${formatDocxFileSize(convertedOutput.size)}`
                      : 'Local browser-generated PDF (.pdf)'}
                  </p>
                </div>
              </div>
            </div>

            <p className="flex items-start gap-2 rounded-lg bg-[#EDE9DF]/70 px-3 py-2.5 text-xs leading-relaxed text-[#56615B] dark:bg-[#17231F] dark:text-[#B9C5BD]">
              <Info
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#7D5C23] dark:text-[#D9B978]"
                aria-hidden="true"
              />
              <span>
                Preserves headings, paragraphs, bold/italic/underline formatting,
                lists, tables, page breaks, and embedded PNG/JPEG images. Complex
                floating frames, custom fonts, and headers/footers may simplify
                during browser rendering.
              </span>
            </p>
          </div>

          <div className="mt-8 space-y-3 border-t border-[#DCDDD3] pt-5 dark:border-[#35463E]">
            <button
              type="button"
              onClick={handleConvert}
              disabled={!uploadedFile || isConverting}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#173F35] px-5 py-2.5 text-sm font-semibold text-[#F2F0E9] transition-colors hover:bg-[#173F35]/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C49A58] disabled:cursor-not-allowed disabled:opacity-45 dark:bg-[#315D4D] dark:hover:bg-[#315D4D]/90"
            >
              {isConverting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <FilePlus2 className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{isConverting ? 'Converting to PDF...' : 'Convert to PDF'}</span>
            </button>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleDownload}
                disabled={!convertedOutput}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#C49A58] px-4 py-2.5 text-sm font-semibold text-[#17231F] transition-colors hover:bg-[#D9B978] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173F35] disabled:cursor-not-allowed disabled:opacity-45 dark:bg-[#D9B978] dark:hover:bg-[#C49A58]"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>Download PDF</span>
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
