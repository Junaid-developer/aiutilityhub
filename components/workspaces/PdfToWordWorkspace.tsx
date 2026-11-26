import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  FileOutput,
  FileText,
  Info,
  Loader2,
  RefreshCw,
  RotateCcw,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { loadPdfWithBrowserPdfJs } from '../../utils/pdfJsLoader';
import {
  formatPdfFileSize,
  MAX_PDF_FILE_SIZE_BYTES,
} from '../../utils/pdfTools';
import {
  buildDocxFilenameFromPdf,
  convertPdfToDocx,
  createDocxObjectUrl,
  PdfDocumentLike,
  PdfToWordLayoutMode,
  PdfToWordResult,
  ScannedPdfError,
  validateAndInspectPdfForWord,
} from '../../utils/pdfToWord';

interface UploadedPdfFile {
  name: string;
  size: number;
  pageCount: number;
  bytes: Uint8Array;
}

interface ConvertedDocxOutput {
  filename: string;
  objectUrl: string;
  size: number;
  pageCount: number;
  textPageCount: number;
  scannedPageNumbers: number[];
  warnings: string[];
  previewText: string;
  stats: PdfToWordResult['stats'];
}

export function PdfToWordWorkspace() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const outputUrlRef = useRef<string | null>(null);
  const dragDepthRef = useRef(0);

  const [isDragging, setIsDragging] = useState(false);
  const [uploadedPdf, setUploadedPdf] = useState<UploadedPdfFile | null>(null);

  const [layoutMode, setLayoutMode] = useState<PdfToWordLayoutMode>('preserve');
  const [detectHeadings, setDetectHeadings] = useState(true);
  const [reconstructTables, setReconstructTables] = useState(true);
  const [includePageBreaks, setIncludePageBreaks] = useState(true);

  const [isReadingFile, setIsReadingFile] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [scannedNotice, setScannedNotice] = useState<string>('');
  const [convertedOutput, setConvertedOutput] =
    useState<ConvertedDocxOutput | null>(null);
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
    setSettingsChanged(false);
    setScannedNotice('');
  }, [revokeOutputUrl]);

  const handleSelectedFile = useCallback(
    async (file: File) => {
      setErrorMessage('');
      setScannedNotice('');
      setIsReadingFile(true);

      try {
        const result = await validateAndInspectPdfForWord(file);
        if (!result.ok) {
          setErrorMessage(result.error);
          return;
        }
        clearOutput();
        setUploadedPdf({
          name: file.name,
          size: file.size,
          pageCount: result.pageCount,
          bytes: result.bytes,
        });
      } catch {
        setErrorMessage(
          'Unable to read the selected PDF file. Please verify the file and try again.'
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
    if (!uploadedPdf) {
      setErrorMessage('Please upload a PDF document first.');
      return;
    }

    setErrorMessage('');
    setScannedNotice('');
    setIsConverting(true);
    clearOutput();

    try {
      const result = await convertPdfToDocx(
        uploadedPdf.bytes,
        uploadedPdf.name,
        {
          layoutMode,
          detectHeadings,
          reconstructTables,
          includePageBreaks,
        },
        async (bytes) => {
          const loaded = await loadPdfWithBrowserPdfJs(bytes);
          return {
            doc: loaded.doc as unknown as PdfDocumentLike,
            cleanup: loaded.cleanup,
          };
        }
      );

      const { objectUrl, size } = createDocxObjectUrl(result.docxBytes);
      outputUrlRef.current = objectUrl;

      setConvertedOutput({
        filename: result.filename,
        objectUrl,
        size,
        pageCount: result.pageCount,
        textPageCount: result.textPageCount,
        scannedPageNumbers: result.scannedPageNumbers,
        warnings: result.warnings,
        previewText: result.previewText,
        stats: result.stats,
      });
      setSettingsChanged(false);
    } catch (err) {
      if (err instanceof ScannedPdfError) {
        setScannedNotice(err.message);
      } else {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Unable to convert this PDF document into Word (.docx).'
        );
      }
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
    setScannedNotice('');
    setLayoutMode('preserve');
    setDetectHeadings(true);
    setReconstructTables(true);
    setIncludePageBreaks(true);
  };

  const handleRemoveFile = () => {
    clearOutput();
    setUploadedPdf(null);
    setErrorMessage('');
    setScannedNotice('');
  };

  return (
    <div className="rounded-[18px] border border-[#DCDDD3] bg-white p-5 shadow-[0_2px_10px_-3px_rgba(23,63,53,0.06)] sm:p-8 dark:border-[#35463E] dark:bg-[#24332C] dark:shadow-[0_2px_10px_-3px_rgba(0,0,0,0.24)]">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        onChange={handleFileInputChange}
        className="sr-only"
        aria-label="Upload PDF file to convert to Word"
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left: PDF Upload, Status, Extracted Preview & Limitations */}
        <div className="space-y-6 lg:col-span-7">
          {!uploadedPdf ? (
            <div
              role="region"
              aria-label="PDF upload dropzone"
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`flex min-h-[250px] flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
                isDragging
                  ? 'border-[#173F35] bg-[#E3EAE4]/60 dark:border-[#D9B978] dark:bg-[#30483C]/50'
                  : 'border-[#DCDDD3] bg-[#EDE9DF]/45 hover:border-[#C49A58] dark:border-[#35463E] dark:bg-[#17231F]/60 dark:hover:border-[#D9B978]'
              }`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#173F35] text-[#EDE9DF] dark:bg-[#315D4D] dark:text-[#F2F0E9]">
                <UploadCloud className="h-6 w-6" aria-hidden="true" />
              </div>
              <p className="mt-4 font-display text-lg font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                Drag and drop a PDF to convert to Word
              </p>
              <p className="mt-1.5 max-w-sm text-sm text-[#56615B] dark:text-[#B9C5BD]">
                Supports selectable-text PDF (.pdf) files up to{' '}
                {formatPdfFileSize(MAX_PDF_FILE_SIZE_BYTES)}. Processed locally
                inside your browser.
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
                  <FileText className="h-4 w-4" aria-hidden="true" />
                )}
                <span>{isReadingFile ? 'Reading PDF...' : 'Select PDF File'}</span>
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
                  <FileText className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                    {uploadedPdf.name}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-[#56615B] tabular-nums dark:text-[#B9C5BD]">
                    {uploadedPdf.pageCount} page
                    {uploadedPdf.pageCount === 1 ? '' : 's'} ·{' '}
                    {formatPdfFileSize(uploadedPdf.size)}
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

          {/* Scanned PDF Alert */}
          {scannedNotice && (
            <div
              role="alert"
              className="rounded-xl border border-amber-700/30 bg-amber-50 p-4 dark:border-amber-400/35 dark:bg-amber-950/45"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle
                  className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300"
                  aria-hidden="true"
                />
                <div className="space-y-1.5 text-xs leading-relaxed text-amber-950 dark:text-amber-100">
                  <p className="font-display text-sm font-semibold">
                    Scanned PDF Detected — OCR Required
                  </p>
                  <p>{scannedNotice}</p>
                  <p className="text-amber-900/90 dark:text-amber-200/90">
                    No empty Word document was generated. To convert scanned
                    pages into editable Word text, run an Optical Character
                    Recognition (OCR) pass on the PDF first.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* General Error Alert */}
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

          {/* Success Banner & Extracted Text Preview */}
          {convertedOutput && (
            <div className="space-y-4">
              <div className="rounded-xl border border-[#173F35]/25 bg-[#E3EAE4]/60 p-4 dark:border-[#D9B978]/30 dark:bg-[#30483C]/45">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#173F35] dark:text-[#D9B978]">
                    <CheckCircle2
                      className="h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span>Word Document Ready</span>
                  </div>
                  <span className="font-mono text-xs font-semibold text-[#252B28] tabular-nums dark:text-[#F2F0E9]">
                    {convertedOutput.textPageCount} of{' '}
                    {convertedOutput.pageCount} page
                    {convertedOutput.pageCount === 1 ? '' : 's'} extracted ·{' '}
                    {formatPdfFileSize(convertedOutput.size)}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-[#173F35]/15 pt-3 text-xs sm:grid-cols-4 dark:border-[#D9B978]/20">
                  <div>
                    <span className="block text-[11px] text-[#56615B] dark:text-[#B9C5BD]">
                      Words
                    </span>
                    <span className="font-mono font-semibold text-[#252B28] tabular-nums dark:text-[#F2F0E9]">
                      {convertedOutput.stats.words.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[11px] text-[#56615B] dark:text-[#B9C5BD]">
                      Headings
                    </span>
                    <span className="font-mono font-semibold text-[#252B28] tabular-nums dark:text-[#F2F0E9]">
                      {convertedOutput.stats.headings}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[11px] text-[#56615B] dark:text-[#B9C5BD]">
                      Paragraphs
                    </span>
                    <span className="font-mono font-semibold text-[#252B28] tabular-nums dark:text-[#F2F0E9]">
                      {convertedOutput.stats.paragraphs}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[11px] text-[#56615B] dark:text-[#B9C5BD]">
                      Tables / Lists
                    </span>
                    <span className="font-mono font-semibold text-[#252B28] tabular-nums dark:text-[#F2F0E9]">
                      {convertedOutput.stats.tables} /{' '}
                      {convertedOutput.stats.lists}
                    </span>
                  </div>
                </div>

                {convertedOutput.warnings.length > 0 && (
                  <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                    <AlertTriangle
                      className="mt-0.5 h-3.5 w-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span>{convertedOutput.warnings.join(' ')}</span>
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-[#DCDDD3] bg-[#EDE9DF]/35 p-4 dark:border-[#35463E] dark:bg-[#17231F]/60">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#56615B] dark:text-[#B9C5BD]">
                  <span className="font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                    Extracted Editable Content Preview
                  </span>
                  <span className="max-w-full truncate font-mono">
                    {convertedOutput.filename}
                  </span>
                </div>
                <pre className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-[#DCDDD3] bg-white p-3.5 font-sans text-xs leading-relaxed whitespace-pre-wrap text-[#252B28] dark:border-[#35463E] dark:bg-[#24332C] dark:text-[#F2F0E9]">
                  {convertedOutput.previewText || 'No text preview available.'}
                </pre>
              </div>
            </div>
          )}

          {settingsChanged && convertedOutput && (
            <p className="flex items-start gap-2 rounded-xl bg-[#EDE9DF] px-3.5 py-2.5 text-xs text-[#252B28] dark:bg-[#17231F] dark:text-[#B9C5BD]">
              <Info
                className="mt-0.5 h-4 w-4 shrink-0 text-[#7D5C23] dark:text-[#D9B978]"
                aria-hidden="true"
              />
              <span>
                Conversion options changed. Click{' '}
                <strong>Convert to Word (.docx)</strong> to regenerate the Word
                file.
              </span>
            </p>
          )}

          {/* Formatting Limitations Explanation */}
          <div className="rounded-xl border border-[#DCDDD3] bg-[#EDE9DF]/45 p-4 dark:border-[#35463E] dark:bg-[#17231F]/65">
            <div className="flex items-start gap-3">
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0 text-[#7D5C23] dark:text-[#D9B978]"
                aria-hidden="true"
              />
              <div>
                <h2 className="font-display text-sm font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                  Formatting &amp; OCR Limitations
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-[#56615B] dark:text-[#B9C5BD]">
                  Selectable text, headings, lists, and aligned tables convert
                  directly into an editable .docx document. Complex
                  multi-column brochures, decorative graphics, and custom
                  embedded fonts may require manual touch-ups in Word, and
                  image-only scanned PDFs require OCR before conversion.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Conversion Options & DOCX Download Area */}
        <div className="flex flex-col justify-between border-t border-[#DCDDD3] pt-6 lg:col-span-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8 dark:border-[#35463E]">
          <div className="space-y-6">
            <div>
              <span className="block text-sm font-medium text-[#252B28] dark:text-[#F2F0E9]">
                Conversion Layout Mode
              </span>
              <div
                role="group"
                aria-label="Conversion layout mode"
                className="mt-2 grid grid-cols-2 gap-2 rounded-xl bg-[#EDE9DF] p-1 dark:bg-[#17231F]"
              >
                <button
                  type="button"
                  aria-pressed={layoutMode === 'preserve'}
                  onClick={() => {
                    setLayoutMode('preserve');
                    if (convertedOutput) setSettingsChanged(true);
                  }}
                  className={`min-h-10 rounded-lg px-3 text-xs font-semibold transition-colors ${
                    layoutMode === 'preserve'
                      ? 'bg-white text-[#173F35] shadow-xs dark:bg-[#24332C] dark:text-[#F2F0E9]'
                      : 'text-[#56615B] hover:text-[#252B28] dark:text-[#B9C5BD] dark:hover:text-[#F2F0E9]'
                  }`}
                >
                  Preserve Layout
                </button>
                <button
                  type="button"
                  aria-pressed={layoutMode === 'flowing'}
                  onClick={() => {
                    setLayoutMode('flowing');
                    if (convertedOutput) setSettingsChanged(true);
                  }}
                  className={`min-h-10 rounded-lg px-3 text-xs font-semibold transition-colors ${
                    layoutMode === 'flowing'
                      ? 'bg-white text-[#173F35] shadow-xs dark:bg-[#24332C] dark:text-[#F2F0E9]'
                      : 'text-[#56615B] hover:text-[#252B28] dark:text-[#B9C5BD] dark:hover:text-[#F2F0E9]'
                  }`}
                >
                  Flowing Text
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <span className="block text-sm font-medium text-[#252B28] dark:text-[#F2F0E9]">
                Document Options
              </span>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#DCDDD3] bg-[#EDE9DF]/30 p-3.5 text-xs dark:border-[#35463E] dark:bg-[#17231F]/60">
                <input
                  type="checkbox"
                  checked={detectHeadings}
                  onChange={(e) => {
                    setDetectHeadings(e.target.checked);
                    if (convertedOutput) setSettingsChanged(true);
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-[#DCDDD3] accent-[#173F35] dark:accent-[#D9B978]"
                />
                <span>
                  <span className="block font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                    Detect headings and text styles
                  </span>
                  <span className="mt-0.5 block text-[#56615B] dark:text-[#B9C5BD]">
                    Map larger and bold font runs into Word heading styles and
                    bold/italic spans
                  </span>
                </span>
              </label>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#DCDDD3] bg-[#EDE9DF]/30 p-3.5 text-xs dark:border-[#35463E] dark:bg-[#17231F]/60">
                <input
                  type="checkbox"
                  checked={reconstructTables}
                  onChange={(e) => {
                    setReconstructTables(e.target.checked);
                    if (convertedOutput) setSettingsChanged(true);
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-[#DCDDD3] accent-[#173F35] dark:accent-[#D9B978]"
                />
                <span>
                  <span className="block font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                    Reconstruct basic tables
                  </span>
                  <span className="mt-0.5 block text-[#56615B] dark:text-[#B9C5BD]">
                    Group aligned multi-column rows into editable Word tables
                  </span>
                </span>
              </label>

              <label
                className={`flex items-start gap-3 rounded-xl border border-[#DCDDD3] bg-[#EDE9DF]/30 p-3.5 text-xs dark:border-[#35463E] dark:bg-[#17231F]/60 ${
                  layoutMode === 'flowing'
                    ? 'cursor-not-allowed opacity-55'
                    : 'cursor-pointer'
                }`}
              >
                <input
                  type="checkbox"
                  checked={includePageBreaks}
                  disabled={layoutMode === 'flowing'}
                  onChange={(e) => {
                    setIncludePageBreaks(e.target.checked);
                    if (convertedOutput) setSettingsChanged(true);
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-[#DCDDD3] accent-[#173F35] dark:accent-[#D9B978]"
                />
                <span>
                  <span className="block font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                    Preserve page breaks between PDF pages
                  </span>
                  <span className="mt-0.5 block text-[#56615B] dark:text-[#B9C5BD]">
                    Keep original page boundaries when using Preserve Layout mode
                  </span>
                </span>
              </label>
            </div>

            {/* DOCX Output Summary Card */}
            <div className="rounded-xl border border-[#DCDDD3] bg-[#EDE9DF]/40 p-4 dark:border-[#35463E] dark:bg-[#17231F]/65">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#E3EAE4] text-[#173F35] dark:bg-[#30483C] dark:text-[#D9B978]">
                  <FileOutput className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                    {convertedOutput
                      ? convertedOutput.filename
                      : uploadedPdf
                        ? buildDocxFilenameFromPdf(uploadedPdf.name)
                        : 'converted-document.docx'}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#56615B] dark:text-[#B9C5BD]">
                    {convertedOutput
                      ? `${formatPdfFileSize(convertedOutput.size)} · Editable Microsoft Word (.docx)`
                      : 'Local browser-generated OpenXML (.docx)'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-3 border-t border-[#DCDDD3] pt-5 dark:border-[#35463E]">
            <button
              type="button"
              onClick={handleConvert}
              disabled={!uploadedPdf || isConverting}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#173F35] px-5 py-2.5 text-sm font-semibold text-[#F2F0E9] transition-colors hover:bg-[#173F35]/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C49A58] disabled:cursor-not-allowed disabled:opacity-45 dark:bg-[#315D4D] dark:hover:bg-[#315D4D]/90"
            >
              {isConverting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <FileOutput className="h-4 w-4" aria-hidden="true" />
              )}
              <span>
                {isConverting ? 'Converting to Word...' : 'Convert to Word (.docx)'}
              </span>
            </button>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleDownload}
                disabled={!convertedOutput}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#C49A58] px-4 py-2.5 text-sm font-semibold text-[#17231F] transition-colors hover:bg-[#D9B978] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173F35] disabled:cursor-not-allowed disabled:opacity-45 dark:bg-[#D9B978] dark:hover:bg-[#C49A58]"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>Download Word</span>
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
