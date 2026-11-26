import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  CheckCircle2,
  Download,
  FileMinus2,
  FileOutput,
  FileText,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Scissors,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { renderPdfThumbnails } from '../../utils/pdfThumbnails';
import {
  createPdfObjectUrl,
  deletePdfPages,
  extractPdfPages,
  formatPagesSummary,
  formatPdfFileSize,
  inspectPdfBytes,
  MAX_PDF_FILE_SIZE_BYTES,
  MAX_PDF_MERGE_FILES,
  MAX_PDF_MERGE_TOTAL_BYTES,
  mergePdfDocuments,
  parsePageRangesInput,
  parsePageSelectionInput,
  PdfOperationId,
  rotatePdfPages,
  RotationAngle,
  splitPdfByRanges,
  validatePdfFileMeta,
} from '../../utils/pdfTools';

interface PdfDocEntry {
  id: string;
  name: string;
  size: number;
  pageCount: number;
  bytes: Uint8Array;
}

interface DownloadablePdfOutput {
  id: string;
  filename: string;
  objectUrl: string;
  pageCount: number;
  size: number;
  detail?: string;
}

interface OperationCardMeta {
  id: PdfOperationId;
  title: string;
  shortLabel: string;
  description: string;
  icon: typeof Layers;
}

const OPERATION_CARDS: OperationCardMeta[] = [
  {
    id: 'merge',
    title: 'Merge PDF',
    shortLabel: 'Merge',
    description:
      'Combine multiple PDF documents into a single file and arrange their exact order.',
    icon: Layers,
  },
  {
    id: 'split',
    title: 'Split PDF',
    shortLabel: 'Split',
    description:
      'Split a multi-page PDF into separate files using custom page ranges like 1-3, 5-7.',
    icon: Scissors,
  },
  {
    id: 'rotate',
    title: 'Rotate PDF',
    shortLabel: 'Rotate',
    description:
      'Rotate every page or specific pages clockwise by 90°, 180°, or 270°.',
    icon: RotateCw,
  },
  {
    id: 'extract',
    title: 'Extract PDF Pages',
    shortLabel: 'Extract',
    description:
      'Select specific pages or ranges to export cleanly into a standalone PDF.',
    icon: FileOutput,
  },
  {
    id: 'delete',
    title: 'Delete PDF Pages',
    shortLabel: 'Delete',
    description:
      'Remove unwanted pages from a document while keeping remaining pages intact.',
    icon: FileMinus2,
  },
];

const ROTATION_ANGLES: RotationAngle[] = [90, 180, 270];

export function PdfToolsWorkspace() {
  const multiInputRef = useRef<HTMLInputElement | null>(null);
  const singleInputRef = useRef<HTMLInputElement | null>(null);
  const outputUrlsRef = useRef<string[]>([]);
  const dragDepthRef = useRef(0);
  const thumbRequestRef = useRef(0);

  const [activeOp, setActiveOp] = useState<PdfOperationId | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Merge state
  const [mergeDocs, setMergeDocs] = useState<PdfDocEntry[]>([]);

  // Single-PDF operation state (split / rotate / extract / delete)
  const [activeDoc, setActiveDoc] = useState<PdfDocEntry | null>(null);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [thumbnailsTruncated, setThumbnailsTruncated] = useState(false);
  const [isLoadingThumbnails, setIsLoadingThumbnails] = useState(false);

  // Split controls
  const [splitRangesInput, setSplitRangesInput] = useState('');

  // Rotate controls
  const [rotateTargetMode, setRotateTargetMode] = useState<'all' | 'specific'>(
    'all'
  );
  const [rotateAngle, setRotateAngle] = useState<RotationAngle>(90);

  // Shared page selection state (for Rotate specific, Extract, Delete)
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [pageSelectionInput, setPageSelectionInput] = useState('');

  // Status & outputs
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [outputs, setOutputs] = useState<DownloadablePdfOutput[]>([]);

  const revokeOutputs = useCallback(() => {
    for (const url of outputUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    outputUrlsRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      revokeOutputs();
    };
  }, [revokeOutputs]);

  const clearOutputs = useCallback(() => {
    revokeOutputs();
    setOutputs([]);
  }, [revokeOutputs]);

  const switchOperation = (nextOp: PdfOperationId | null) => {
    clearOutputs();
    setErrorMessage('');
    setActiveOp(nextOp);
  };

  const loadThumbnailsForDoc = useCallback(async (doc: PdfDocEntry) => {
    const reqId = ++thumbRequestRef.current;
    setIsLoadingThumbnails(true);
    setThumbnails([]);
    setThumbnailsTruncated(false);
    try {
      const result = await renderPdfThumbnails(doc.bytes);
      if (thumbRequestRef.current !== reqId) return;
      setThumbnails(result.thumbnails);
      setThumbnailsTruncated(result.truncated);
    } catch {
      if (thumbRequestRef.current !== reqId) return;
      // Fallback gracefully to reliable numeric page tiles if worker/canvas fails
      setThumbnails([]);
    } finally {
      if (thumbRequestRef.current === reqId) {
        setIsLoadingThumbnails(false);
      }
    }
  }, []);

  const readFileAsPdfEntry = useCallback(
    async (file: File): Promise<PdfDocEntry> => {
      const metaCheck = validatePdfFileMeta(file);
      if (!metaCheck.ok) {
        throw new Error(metaCheck.error);
      }
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const inspection = await inspectPdfBytes(bytes);
      if (!inspection.ok) {
        throw new Error(`${file.name}: ${inspection.error}`);
      }
      return {
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 7)}`,
        name: file.name,
        size: file.size,
        pageCount: inspection.pageCount,
        bytes,
      };
    },
    []
  );

  const handleMergeFilesAdded = useCallback(
    async (files: FileList | File[]) => {
      const fileArr = Array.from(files);
      if (fileArr.length === 0) return;

      setErrorMessage('');
      setIsLoadingFile(true);
      clearOutputs();

      let runningBytes = mergeDocs.reduce((sum, doc) => sum + doc.size, 0);
      let runningCount = mergeDocs.length;
      const added: PdfDocEntry[] = [];
      const errors: string[] = [];

      for (const file of fileArr) {
        if (runningCount >= MAX_PDF_MERGE_FILES) {
          errors.push(
            `Skipped "${file.name}": maximum ${MAX_PDF_MERGE_FILES} files per merge queue.`
          );
          continue;
        }
        if (runningBytes + file.size > MAX_PDF_MERGE_TOTAL_BYTES) {
          errors.push(
            `Skipped "${file.name}": adding it would exceed the ${formatPdfFileSize(
              MAX_PDF_MERGE_TOTAL_BYTES
            )} combined merge limit.`
          );
          continue;
        }
        try {
          const entry = await readFileAsPdfEntry(file);
          runningBytes += entry.size;
          runningCount += 1;
          added.push(entry);
        } catch (err) {
          errors.push(
            err instanceof Error ? err.message : `Failed to read ${file.name}.`
          );
        }
      }

      if (added.length > 0) {
        setMergeDocs((prev) => [...prev, ...added]);
      }
      if (errors.length > 0) {
        setErrorMessage(errors.join(' '));
      }
      setIsLoadingFile(false);
    },
    [clearOutputs, mergeDocs, readFileAsPdfEntry]
  );

  const handleSingleFileSelected = useCallback(
    async (file: File) => {
      setErrorMessage('');
      setIsLoadingFile(true);
      clearOutputs();

      try {
        const entry = await readFileAsPdfEntry(file);
        setActiveDoc(entry);
        setSelectedPages([]);
        setPageSelectionInput('');
        setSplitRangesInput(
          entry.pageCount >= 2 ? `1-${Math.ceil(entry.pageCount / 2)}` : '1'
        );
        void loadThumbnailsForDoc(entry);
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Unable to load the selected PDF.'
        );
      } finally {
        setIsLoadingFile(false);
      }
    },
    [clearOutputs, loadThumbnailsForDoc, readFileAsPdfEntry]
  );

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

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    if (activeOp === 'merge') {
      void handleMergeFilesAdded(files);
    } else {
      void handleSingleFileSelected(files[0]);
    }
  };

  const moveMergeDoc = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= mergeDocs.length) return;
    clearOutputs();
    setMergeDocs((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  };

  const removeMergeDoc = (id: string) => {
    clearOutputs();
    setMergeDocs((prev) => prev.filter((doc) => doc.id !== id));
  };

  const handleRemoveSingleDoc = () => {
    thumbRequestRef.current += 1;
    setIsLoadingThumbnails(false);
    clearOutputs();
    setActiveDoc(null);
    setThumbnails([]);
    setThumbnailsTruncated(false);
    setSelectedPages([]);
    setPageSelectionInput('');
    setSplitRangesInput('');
    setErrorMessage('');
  };

  const togglePageSelection = (pageNum: number) => {
    setErrorMessage('');
    clearOutputs();
    setSelectedPages((prev) => {
      const exists = prev.includes(pageNum);
      const next = exists
        ? prev.filter((p) => p !== pageNum)
        : [...prev, pageNum].sort((a, b) => a - b);
      setPageSelectionInput(next.length > 0 ? formatPagesSummary(next) : '');
      return next;
    });
  };

  const handlePageSelectionTextChange = (raw: string) => {
    setPageSelectionInput(raw);
    setErrorMessage('');
    clearOutputs();
    if (!activeDoc) return;
    if (!raw.trim()) {
      setSelectedPages([]);
      return;
    }
    const parsed = parsePageSelectionInput(raw, activeDoc.pageCount);
    if (parsed.ok) {
      setSelectedPages(parsed.pages);
    }
  };

  const resolvePageSelectionForSubmit = (): number[] | null => {
    if (!activeDoc) return null;
    if (pageSelectionInput.trim()) {
      const parsed = parsePageSelectionInput(
        pageSelectionInput,
        activeDoc.pageCount
      );
      if (!parsed.ok) {
        setErrorMessage(parsed.error);
        return null;
      }
      return parsed.pages;
    }
    if (selectedPages.length === 0) {
      setErrorMessage('Please select at least one page.');
      return null;
    }
    return selectedPages;
  };

  const publishOutputs = (
    items: Array<{
      bytes: Uint8Array;
      filename: string;
      pageCount: number;
      detail?: string;
    }>
  ) => {
    revokeOutputs();
    const nextOutputs: DownloadablePdfOutput[] = items.map((item, idx) => {
      const { objectUrl, size } = createPdfObjectUrl(item.bytes);
      outputUrlsRef.current.push(objectUrl);
      return {
        id: `${item.filename}-${idx}-${Date.now()}`,
        filename: item.filename,
        objectUrl,
        pageCount: item.pageCount,
        size,
        detail: item.detail,
      };
    });
    setOutputs(nextOutputs);
  };

  const handleRunOperation = async () => {
    if (!activeOp) return;
    setErrorMessage('');
    clearOutputs();
    setIsProcessing(true);

    try {
      if (activeOp === 'merge') {
        const result = await mergePdfDocuments(mergeDocs);
        publishOutputs([
          {
            bytes: result.bytes,
            filename: result.filename,
            pageCount: result.pageCount,
            detail: `Merged ${mergeDocs.length} documents`,
          },
        ]);
      } else if (activeOp === 'split') {
        if (!activeDoc) {
          throw new Error('Please upload a PDF document to split.');
        }
        const parsed = parsePageRangesInput(
          splitRangesInput,
          activeDoc.pageCount
        );
        if (!parsed.ok) {
          throw new Error(parsed.error);
        }
        const parts = await splitPdfByRanges(activeDoc.bytes, splitRangesInput);
        publishOutputs(
          parts.map((part) => ({
            bytes: part.bytes,
            filename: part.filename,
            pageCount: part.pageCount,
            detail: `Pages ${part.rangeLabel}`,
          }))
        );
      } else if (activeOp === 'rotate') {
        if (!activeDoc) {
          throw new Error('Please upload a PDF document to rotate.');
        }
        const target =
          rotateTargetMode === 'all' ? 'all' : resolvePageSelectionForSubmit();
        if (target === null) {
          setIsProcessing(false);
          return;
        }
        const result = await rotatePdfPages(
          activeDoc.bytes,
          target,
          rotateAngle
        );
        publishOutputs([
          {
            bytes: result.bytes,
            filename: result.filename,
            pageCount: result.pageCount,
            detail: `Rotated ${result.rotatedCount} page${
              result.rotatedCount === 1 ? '' : 's'
            } by ${rotateAngle}°`,
          },
        ]);
      } else if (activeOp === 'extract') {
        if (!activeDoc) {
          throw new Error('Please upload a PDF document to extract pages from.');
        }
        const pages = resolvePageSelectionForSubmit();
        if (!pages) {
          setIsProcessing(false);
          return;
        }
        const result = await extractPdfPages(activeDoc.bytes, pages);
        publishOutputs([
          {
            bytes: result.bytes,
            filename: result.filename,
            pageCount: result.pageCount,
            detail: `Extracted pages ${formatPagesSummary(pages)}`,
          },
        ]);
      } else if (activeOp === 'delete') {
        if (!activeDoc) {
          throw new Error('Please upload a PDF document to delete pages from.');
        }
        const pages = resolvePageSelectionForSubmit();
        if (!pages) {
          setIsProcessing(false);
          return;
        }
        const result = await deletePdfPages(activeDoc.bytes, pages);
        publishOutputs([
          {
            bytes: result.bytes,
            filename: result.filename,
            pageCount: result.pageCount,
            detail: `Deleted ${result.deletedCount} page${
              result.deletedCount === 1 ? '' : 's'
            }`,
          },
        ]);
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'An error occurred while processing the PDF.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const triggerDownload = (out: DownloadablePdfOutput) => {
    const link = document.createElement('a');
    link.href = out.objectUrl;
    link.download = out.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeOpMeta = useMemo(
    () => OPERATION_CARDS.find((card) => card.id === activeOp) ?? null,
    [activeOp]
  );

  const totalMergePages = useMemo(
    () => mergeDocs.reduce((sum, doc) => sum + doc.pageCount, 0),
    [mergeDocs]
  );

  const totalMergeBytes = useMemo(
    () => mergeDocs.reduce((sum, doc) => sum + doc.size, 0),
    [mergeDocs]
  );

  // Dashboard View (5 separate operation cards)
  if (!activeOp) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <h2 className="font-display text-xl font-bold text-[#252B28] dark:text-[#F2F0E9]">
              Select a PDF Operation
            </h2>
            <p className="mt-1 text-sm text-[#56615B] dark:text-[#B9C5BD]">
              Every PDF action runs privately inside your browser with up to 50 MB
              per file.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {OPERATION_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => switchOperation(card.id)}
                className="group flex h-full flex-col justify-between rounded-[18px] border border-[#DCDDD3] bg-white p-7 text-left shadow-[0_2px_10px_-3px_rgba(23,63,53,0.06),0_1px_3px_rgba(23,63,53,0.04)] transition-all duration-200 ease-out hover:-translate-y-1 hover:border-[#C49A58] hover:shadow-[0_14px_28px_-8px_rgba(23,63,53,0.14),0_4px_10px_-2px_rgba(23,63,53,0.06)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C49A58] dark:border-[#35463E] dark:bg-[#24332C] dark:shadow-[0_2px_10px_-3px_rgba(0,0,0,0.28)] dark:hover:border-[#D9B978] dark:hover:shadow-[0_14px_28px_-8px_rgba(0,0,0,0.45)]"
              >
                <div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#E3EAE4] text-[#173F35] transition-colors duration-200 dark:bg-[#30483C] dark:text-[#D9B978]">
                    <Icon className="h-5 w-5" strokeWidth={1.85} aria-hidden="true" />
                  </div>

                  <h3 className="mt-5 font-display text-lg font-semibold tracking-tight text-[#252B28] dark:text-[#F2F0E9]">
                    {card.title}
                  </h3>

                  <p className="mt-2 text-sm leading-relaxed text-[#56615B] dark:text-[#B9C5BD]">
                    {card.description}
                  </p>
                </div>

                <div className="mt-6 flex items-center gap-1.5 text-xs font-semibold text-[#173F35] transition-colors duration-200 group-hover:text-[#7D5C23] dark:text-[#D9B978] dark:group-hover:text-[#F2F0E9]">
                  <span>Open Operation</span>
                  <ArrowRight
                    className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const showSinglePageGrid =
    activeOp !== 'merge' && activeDoc !== null;

  const isSelectionInteractive =
    activeOp === 'extract' ||
    activeOp === 'delete' ||
    (activeOp === 'rotate' && rotateTargetMode === 'specific');

  return (
    <div className="rounded-[18px] border border-[#DCDDD3] bg-white p-5 shadow-[0_2px_10px_-3px_rgba(23,63,53,0.06)] sm:p-8 dark:border-[#35463E] dark:bg-[#24332C] dark:shadow-[0_2px_10px_-3px_rgba(0,0,0,0.24)]">
      {/* Hidden File Inputs */}
      <input
        ref={multiInputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        onChange={(e) => {
          if (e.target.files) void handleMergeFilesAdded(e.target.files);
          e.target.value = '';
        }}
        className="sr-only"
        aria-label="Upload multiple PDF files"
      />
      <input
        ref={singleInputRef}
        type="file"
        accept="application/pdf,.pdf"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void handleSingleFileSelected(file);
        }}
        className="sr-only"
        aria-label="Upload a PDF file"
      />

      {/* Top Navigation & Operation Switcher */}
      <div className="flex flex-col gap-4 border-b border-[#DCDDD3] pb-5 lg:flex-row lg:items-center lg:justify-between dark:border-[#35463E]">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => switchOperation(null)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#DCDDD3] bg-white px-3 text-xs font-semibold text-[#252B28] transition-colors hover:border-[#C49A58] dark:border-[#35463E] dark:bg-[#17231F] dark:text-[#F2F0E9] dark:hover:border-[#D9B978]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>PDF Dashboard</span>
          </button>

          {activeOpMeta && (
            <h2 className="font-display text-lg font-bold text-[#252B28] dark:text-[#F2F0E9]">
              {activeOpMeta.title}
            </h2>
          )}
        </div>

        <div
          role="tablist"
          aria-label="PDF operations"
          className="flex flex-wrap gap-1 rounded-xl bg-[#EDE9DF] p-1 dark:bg-[#17231F]"
        >
          {OPERATION_CARDS.map((tab) => {
            const active = activeOp === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => switchOperation(tab.id)}
                className={`min-h-8 rounded-lg px-3 text-xs font-semibold whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-white text-[#173F35] shadow-xs dark:bg-[#24332C] dark:text-[#F2F0E9]'
                    : 'text-[#56615B] hover:text-[#252B28] dark:text-[#B9C5BD] dark:hover:text-[#F2F0E9]'
                }`}
              >
                {tab.shortLabel}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left: Upload, File List / Thumbnails */}
        <div className="space-y-5 lg:col-span-7">
          {activeOp === 'merge' ? (
            <>
              <div
                role="region"
                aria-label="Merge PDF upload dropzone"
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-9 text-center transition-colors ${
                  isDragging
                    ? 'border-[#173F35] bg-[#E3EAE4]/60 dark:border-[#D9B978] dark:bg-[#30483C]/50'
                    : 'border-[#DCDDD3] bg-[#EDE9DF]/45 hover:border-[#C49A58] dark:border-[#35463E] dark:bg-[#17231F]/60 dark:hover:border-[#D9B978]'
                }`}
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#173F35] text-[#EDE9DF] dark:bg-[#315D4D] dark:text-[#F2F0E9]">
                  <UploadCloud className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="mt-3 font-display text-base font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                  Drop PDF documents to merge
                </p>
                <p className="mt-1 text-xs text-[#56615B] dark:text-[#B9C5BD]">
                  PDF (.pdf) only · Max {formatPdfFileSize(MAX_PDF_FILE_SIZE_BYTES)}{' '}
                  per file ({formatPdfFileSize(MAX_PDF_MERGE_TOTAL_BYTES)} /{' '}
                  {MAX_PDF_MERGE_FILES} files total) · Processed locally
                </p>
                <button
                  type="button"
                  onClick={() => multiInputRef.current?.click()}
                  disabled={isLoadingFile}
                  className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#173F35] px-4 py-2 text-sm font-semibold text-[#F2F0E9] transition-colors hover:bg-[#173F35]/90 disabled:opacity-50 dark:bg-[#315D4D] dark:hover:bg-[#315D4D]/90"
                >
                  {isLoadingFile ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span>{isLoadingFile ? 'Reading PDF...' : 'Add PDF Files'}</span>
                </button>
              </div>

              {/* Merge Queue */}
              {mergeDocs.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs text-[#56615B] dark:text-[#B9C5BD]">
                    <span className="tabular-nums">
                      {mergeDocs.length} file{mergeDocs.length === 1 ? '' : 's'}{' '}
                      ({totalMergePages} total page
                      {totalMergePages === 1 ? '' : 's'} ·{' '}
                      {formatPdfFileSize(totalMergeBytes)} /{' '}
                      {formatPdfFileSize(MAX_PDF_MERGE_TOTAL_BYTES)})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        clearOutputs();
                        setMergeDocs([]);
                        setErrorMessage('');
                      }}
                      className="font-semibold text-[#56615B] hover:text-red-700 dark:text-[#B9C5BD] dark:hover:text-red-300"
                    >
                      Clear All
                    </button>
                  </div>

                  <div className="divide-y divide-[#DCDDD3] rounded-xl border border-[#DCDDD3] bg-[#EDE9DF]/30 dark:divide-[#35463E] dark:border-[#35463E] dark:bg-[#17231F]/60">
                    {mergeDocs.map((doc, index) => (
                      <div
                        key={doc.id}
                        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <span className="font-mono text-xs font-semibold text-[#7D5C23] tabular-nums dark:text-[#D9B978]">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <FileText
                            className="h-4 w-4 shrink-0 text-[#173F35] dark:text-[#D9B978]"
                            aria-hidden="true"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-[#252B28] dark:text-[#F2F0E9]">
                              {doc.name}
                            </p>
                            <p className="font-mono text-xs text-[#56615B] tabular-nums dark:text-[#B9C5BD]">
                              {doc.pageCount} page{doc.pageCount === 1 ? '' : 's'}{' '}
                              · {formatPdfFileSize(doc.size)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => moveMergeDoc(index, -1)}
                            disabled={index === 0}
                            aria-label={`Move ${doc.name} up`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#DCDDD3] bg-white text-[#252B28] transition-colors hover:border-[#C49A58] disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#35463E] dark:bg-[#24332C] dark:text-[#F2F0E9]"
                          >
                            <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveMergeDoc(index, 1)}
                            disabled={index === mergeDocs.length - 1}
                            aria-label={`Move ${doc.name} down`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#DCDDD3] bg-white text-[#252B28] transition-colors hover:border-[#C49A58] disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#35463E] dark:bg-[#24332C] dark:text-[#F2F0E9]"
                          >
                            <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeMergeDoc(doc.id)}
                            aria-label={`Remove ${doc.name}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#DCDDD3] bg-white text-[#56615B] transition-colors hover:border-red-600/40 hover:text-red-700 dark:border-[#35463E] dark:bg-[#24332C] dark:text-[#B9C5BD] dark:hover:text-red-300"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : !activeDoc ? (
            <div
              role="region"
              aria-label="Single PDF upload dropzone"
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`flex min-h-[280px] flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
                isDragging
                  ? 'border-[#173F35] bg-[#E3EAE4]/60 dark:border-[#D9B978] dark:bg-[#30483C]/50'
                  : 'border-[#DCDDD3] bg-[#EDE9DF]/45 hover:border-[#C49A58] dark:border-[#35463E] dark:bg-[#17231F]/60 dark:hover:border-[#D9B978]'
              }`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#173F35] text-[#EDE9DF] dark:bg-[#315D4D] dark:text-[#F2F0E9]">
                <UploadCloud className="h-6 w-6" aria-hidden="true" />
              </div>
              <p className="mt-4 font-display text-lg font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                Drop a PDF file here
              </p>
              <p className="mt-1.5 max-w-sm text-xs text-[#56615B] dark:text-[#B9C5BD]">
                Accepts PDF (.pdf) files up to{' '}
                {formatPdfFileSize(MAX_PDF_FILE_SIZE_BYTES)}. Processed locally
                inside your browser.
              </p>
              <button
                type="button"
                onClick={() => singleInputRef.current?.click()}
                disabled={isLoadingFile}
                className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#173F35] px-5 py-2.5 text-sm font-semibold text-[#F2F0E9] transition-colors hover:bg-[#173F35]/90 disabled:opacity-50 dark:bg-[#315D4D] dark:hover:bg-[#315D4D]/90"
              >
                {isLoadingFile ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <FileText className="h-4 w-4" aria-hidden="true" />
                )}
                <span>{isLoadingFile ? 'Loading PDF...' : 'Select PDF File'}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Uploaded Single PDF Summary */}
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
                      {activeDoc.name}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-[#56615B] tabular-nums dark:text-[#B9C5BD]">
                      {activeDoc.pageCount} page
                      {activeDoc.pageCount === 1 ? '' : 's'} ·{' '}
                      {formatPdfFileSize(activeDoc.size)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => singleInputRef.current?.click()}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#DCDDD3] bg-white px-3 text-xs font-semibold text-[#252B28] transition-colors hover:border-[#C49A58] dark:border-[#35463E] dark:bg-[#24332C] dark:text-[#F2F0E9] dark:hover:border-[#D9B978]"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Replace PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveSingleDoc}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#DCDDD3] bg-white px-3 text-xs font-semibold text-[#56615B] transition-colors hover:border-red-600/40 hover:text-red-700 dark:border-[#35463E] dark:bg-[#24332C] dark:text-[#B9C5BD] dark:hover:text-red-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Remove</span>
                  </button>
                </div>
              </div>

              {/* Page Thumbnails / Page Grid */}
              {showSinglePageGrid && (
                <div>
                  <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-[#56615B] dark:text-[#B9C5BD]">
                    <span>
                      {isLoadingThumbnails
                        ? 'Rendering page previews...'
                        : isSelectionInteractive
                          ? 'Click pages below or type page numbers on the right'
                          : 'Document pages overview'}
                    </span>
                    {thumbnailsTruncated && (
                      <span>
                        Showing previews for first {thumbnails.length} of{' '}
                        {activeDoc.pageCount} pages
                      </span>
                    )}
                  </div>

                  <div className="grid max-h-[420px] grid-cols-3 gap-3 overflow-y-auto rounded-xl border border-[#DCDDD3] bg-[#EDE9DF]/30 p-3 sm:grid-cols-4 dark:border-[#35463E] dark:bg-[#17231F]/55">
                    {Array.from(
                      { length: activeDoc.pageCount },
                      (_, i) => i + 1
                    ).map((pageNum) => {
                      const thumbUrl = thumbnails[pageNum - 1];
                      const isSelected = selectedPages.includes(pageNum);
                      const isDeleteSelected =
                        activeOp === 'delete' && isSelected;

                      return (
                        <button
                          key={pageNum}
                          type="button"
                          disabled={!isSelectionInteractive}
                          aria-pressed={isSelectionInteractive ? isSelected : undefined}
                          onClick={() => togglePageSelection(pageNum)}
                          className={`group relative flex flex-col items-center rounded-xl border p-2 text-center transition-all ${
                            isDeleteSelected
                              ? 'border-red-600 bg-red-50/70 dark:border-red-400 dark:bg-red-950/35'
                              : isSelected
                                ? 'border-[#173F35] bg-[#E3EAE4]/70 ring-1 ring-[#173F35] dark:border-[#D9B978] dark:bg-[#30483C]/65 dark:ring-[#D9B978]'
                                : 'border-[#DCDDD3] bg-white dark:border-[#35463E] dark:bg-[#24332C]'
                          } ${
                            isSelectionInteractive
                              ? 'cursor-pointer hover:border-[#C49A58] dark:hover:border-[#D9B978]'
                              : 'cursor-default'
                          }`}
                        >
                          <div className="flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-md border border-[#DCDDD3]/70 bg-white dark:border-[#35463E]">
                            {thumbUrl ? (
                              <img
                                src={thumbUrl}
                                alt={`Page ${pageNum}`}
                                className={`h-full w-full object-contain ${
                                  isDeleteSelected ? 'opacity-45' : ''
                                }`}
                              />
                            ) : (
                              <span className="font-mono text-xs text-[#56615B] dark:text-[#B9C5BD]">
                                P.{pageNum}
                              </span>
                            )}
                          </div>
                          <span
                            className={`mt-1.5 font-mono text-xs font-semibold tabular-nums ${
                              isDeleteSelected
                                ? 'text-red-800 line-through dark:text-red-300'
                                : isSelected
                                  ? 'text-[#173F35] dark:text-[#D9B978]'
                                  : 'text-[#56615B] dark:text-[#B9C5BD]'
                            }`}
                          >
                            Page {pageNum}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
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

        {/* Right: Operation Controls & Generated Output Downloads */}
        <div className="flex flex-col justify-between border-t border-[#DCDDD3] pt-6 lg:col-span-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8 dark:border-[#35463E]">
          <div className="space-y-6">
            {/* Merge Info */}
            {activeOp === 'merge' && (
              <div className="space-y-4">
                <h3 className="font-display text-sm font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                  Merge Sequence
                </h3>
                <p className="text-xs leading-relaxed text-[#56615B] dark:text-[#B9C5BD]">
                  Add two or more PDF files on the left, then use the up and down
                  arrows to set their exact order before merging into one PDF.
                </p>
                <div className="rounded-xl border border-[#DCDDD3] bg-[#EDE9DF]/40 p-4 text-xs dark:border-[#35463E] dark:bg-[#17231F]/65">
                  <div className="flex justify-between">
                    <span className="text-[#56615B] dark:text-[#B9C5BD]">
                      Documents queued
                    </span>
                    <span className="font-mono font-semibold text-[#252B28] tabular-nums dark:text-[#F2F0E9]">
                      {mergeDocs.length}
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between">
                    <span className="text-[#56615B] dark:text-[#B9C5BD]">
                      Combined pages
                    </span>
                    <span className="font-mono font-semibold text-[#252B28] tabular-nums dark:text-[#F2F0E9]">
                      {totalMergePages}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Split Controls */}
            {activeOp === 'split' && (
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="pdf-split-ranges"
                    className="block text-sm font-medium text-[#252B28] dark:text-[#F2F0E9]"
                  >
                    Page Ranges to Split
                  </label>
                  <input
                    id="pdf-split-ranges"
                    type="text"
                    value={splitRangesInput}
                    onChange={(e) => {
                      setSplitRangesInput(e.target.value);
                      setErrorMessage('');
                      clearOutputs();
                    }}
                    placeholder="e.g. 1-3, 5-7, 9"
                    className="mt-2 h-11 w-full rounded-xl border border-[#DCDDD3] bg-[#EDE9DF]/35 px-3.5 font-mono text-sm text-[#252B28] placeholder-[#56615B] focus:border-[#173F35] focus:outline-none dark:border-[#35463E] dark:bg-[#17231F] dark:text-[#F2F0E9] dark:placeholder-[#B9C5BD] dark:focus:border-[#D9B978]"
                  />
                  <p className="mt-1.5 text-xs text-[#56615B] dark:text-[#B9C5BD]">
                    Separate ranges with commas. Each range produces a separate
                    downloadable PDF file.
                  </p>
                </div>

                {activeDoc && activeDoc.pageCount >= 2 && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const mid = Math.ceil(activeDoc.pageCount / 2);
                        setSplitRangesInput(`1-${mid}, ${mid + 1}-${activeDoc.pageCount}`);
                        clearOutputs();
                      }}
                      className="rounded-lg border border-[#DCDDD3] bg-white px-3 py-1.5 text-xs font-medium text-[#252B28] hover:border-[#C49A58] dark:border-[#35463E] dark:bg-[#24332C] dark:text-[#F2F0E9]"
                    >
                      Split in Half
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const allSingles = Array.from(
                          { length: activeDoc.pageCount },
                          (_, i) => String(i + 1)
                        ).join(', ');
                        setSplitRangesInput(allSingles);
                        clearOutputs();
                      }}
                      className="rounded-lg border border-[#DCDDD3] bg-white px-3 py-1.5 text-xs font-medium text-[#252B28] hover:border-[#C49A58] dark:border-[#35463E] dark:bg-[#24332C] dark:text-[#F2F0E9]"
                    >
                      Every Page Separately
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Rotate Controls */}
            {activeOp === 'rotate' && (
              <div className="space-y-5">
                <div>
                  <span className="block text-sm font-medium text-[#252B28] dark:text-[#F2F0E9]">
                    Rotation Angle (Clockwise)
                  </span>
                  <div
                    role="group"
                    aria-label="Rotation angle"
                    className="mt-2 grid grid-cols-3 gap-2 rounded-lg bg-[#EDE9DF] p-1 dark:bg-[#17231F]"
                  >
                    {ROTATION_ANGLES.map((angle) => (
                      <button
                        key={angle}
                        type="button"
                        aria-pressed={rotateAngle === angle}
                        onClick={() => {
                          setRotateAngle(angle);
                          clearOutputs();
                        }}
                        className={`min-h-9 rounded-md font-mono text-xs font-semibold tabular-nums transition-colors ${
                          rotateAngle === angle
                            ? 'bg-white text-[#173F35] shadow-xs dark:bg-[#24332C] dark:text-[#F2F0E9]'
                            : 'text-[#56615B] hover:text-[#252B28] dark:text-[#B9C5BD] dark:hover:text-[#F2F0E9]'
                        }`}
                      >
                        {angle}°
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="block text-sm font-medium text-[#252B28] dark:text-[#F2F0E9]">
                    Pages to Rotate
                  </span>
                  <div
                    role="group"
                    aria-label="Pages to rotate target"
                    className="mt-2 grid grid-cols-2 gap-1.5 rounded-lg bg-[#EDE9DF] p-1 dark:bg-[#17231F]"
                  >
                    <button
                      type="button"
                      aria-pressed={rotateTargetMode === 'all'}
                      onClick={() => {
                        setRotateTargetMode('all');
                        setErrorMessage('');
                        clearOutputs();
                      }}
                      className={`min-h-9 rounded-md text-xs font-semibold transition-colors ${
                        rotateTargetMode === 'all'
                          ? 'bg-white text-[#173F35] shadow-xs dark:bg-[#24332C] dark:text-[#F2F0E9]'
                          : 'text-[#56615B] hover:text-[#252B28] dark:text-[#B9C5BD]'
                      }`}
                    >
                      All Pages
                    </button>
                    <button
                      type="button"
                      aria-pressed={rotateTargetMode === 'specific'}
                      onClick={() => {
                        setRotateTargetMode('specific');
                        setErrorMessage('');
                        clearOutputs();
                      }}
                      className={`min-h-9 rounded-md text-xs font-semibold transition-colors ${
                        rotateTargetMode === 'specific'
                          ? 'bg-white text-[#173F35] shadow-xs dark:bg-[#24332C] dark:text-[#F2F0E9]'
                          : 'text-[#56615B] hover:text-[#252B28] dark:text-[#B9C5BD]'
                      }`}
                    >
                      Specific Pages
                    </button>
                  </div>
                </div>

                {rotateTargetMode === 'specific' && (
                  <div>
                    <label
                      htmlFor="pdf-rotate-pages"
                      className="block text-xs font-medium text-[#56615B] dark:text-[#B9C5BD]"
                    >
                      Page Numbers or Ranges
                    </label>
                    <input
                      id="pdf-rotate-pages"
                      type="text"
                      value={pageSelectionInput}
                      onChange={(e) =>
                        handlePageSelectionTextChange(e.target.value)
                      }
                      placeholder="e.g. 1, 3-4"
                      className="mt-1.5 h-10 w-full rounded-lg border border-[#DCDDD3] bg-[#EDE9DF]/35 px-3 font-mono text-sm text-[#252B28] placeholder-[#56615B] focus:border-[#173F35] focus:outline-none dark:border-[#35463E] dark:bg-[#17231F] dark:text-[#F2F0E9] dark:placeholder-[#B9C5BD]"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Extract / Delete Controls */}
            {(activeOp === 'extract' || activeOp === 'delete') && (
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="pdf-select-pages"
                    className="block text-sm font-medium text-[#252B28] dark:text-[#F2F0E9]"
                  >
                    {activeOp === 'extract'
                      ? 'Pages to Extract'
                      : 'Pages to Delete'}
                  </label>
                  <input
                    id="pdf-select-pages"
                    type="text"
                    value={pageSelectionInput}
                    onChange={(e) =>
                      handlePageSelectionTextChange(e.target.value)
                    }
                    placeholder="e.g. 1-3, 5"
                    className="mt-2 h-11 w-full rounded-xl border border-[#DCDDD3] bg-[#EDE9DF]/35 px-3.5 font-mono text-sm text-[#252B28] placeholder-[#56615B] focus:border-[#173F35] focus:outline-none dark:border-[#35463E] dark:bg-[#17231F] dark:text-[#F2F0E9] dark:placeholder-[#B9C5BD] dark:focus:border-[#D9B978]"
                  />
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-[#56615B] dark:text-[#B9C5BD]">
                      {selectedPages.length > 0
                        ? `Selected (${selectedPages.length}): ${formatPagesSummary(
                            selectedPages
                          )}`
                        : 'No pages selected yet'}
                    </span>
                    {activeDoc && (
                      <div className="flex items-center gap-2">
                        {activeOp === 'extract' && (
                          <button
                            type="button"
                            onClick={() => {
                              const all = Array.from(
                                { length: activeDoc.pageCount },
                                (_, i) => i + 1
                              );
                              setSelectedPages(all);
                              setPageSelectionInput(formatPagesSummary(all));
                              clearOutputs();
                            }}
                            className="font-semibold text-[#173F35] hover:underline dark:text-[#D9B978]"
                          >
                            Select All
                          </button>
                        )}
                        {selectedPages.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPages([]);
                              setPageSelectionInput('');
                              clearOutputs();
                            }}
                            className="font-semibold text-[#56615B] hover:underline dark:text-[#B9C5BD]"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {activeOp === 'delete' && activeDoc && (
                  <p className="rounded-lg bg-[#EDE9DF]/70 px-3 py-2.5 text-xs leading-relaxed text-[#56615B] dark:bg-[#17231F] dark:text-[#B9C5BD]">
                    At least one page must remain in the edited document.
                    {selectedPages.length > 0 &&
                      selectedPages.length < activeDoc.pageCount && (
                        <span className="mt-1 block font-medium text-[#252B28] dark:text-[#F2F0E9]">
                          {activeDoc.pageCount - selectedPages.length} page
                          {activeDoc.pageCount - selectedPages.length === 1
                            ? ''
                            : 's'}{' '}
                          will remain after deletion.
                        </span>
                      )}
                  </p>
                )}
              </div>
            )}

            {/* Generated Output Files & Downloads */}
            {outputs.length > 0 && (
              <div className="space-y-3 border-t border-[#DCDDD3] pt-5 dark:border-[#35463E]">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#173F35] dark:text-[#D9B978]">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  <span>
                    Ready for Download ({outputs.length} file
                    {outputs.length === 1 ? '' : 's'})
                  </span>
                </div>

                <div className="space-y-2.5">
                  {outputs.map((out) => (
                    <div
                      key={out.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[#DCDDD3] bg-[#EDE9DF]/40 p-3 dark:border-[#35463E] dark:bg-[#17231F]/65"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                          {out.filename}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-[#56615B] tabular-nums dark:text-[#B9C5BD]">
                          {out.pageCount} page{out.pageCount === 1 ? '' : 's'} ·{' '}
                          {formatPdfFileSize(out.size)}
                          {out.detail ? ` · ${out.detail}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => triggerDownload(out)}
                        className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[#C49A58] px-3 text-xs font-semibold text-[#17231F] transition-colors hover:bg-[#D9B978] dark:bg-[#D9B978] dark:hover:bg-[#C49A58]"
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Download</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Primary Action & Reset */}
          <div className="mt-8 space-y-2.5 border-t border-[#DCDDD3] pt-5 dark:border-[#35463E]">
            <button
              type="button"
              onClick={handleRunOperation}
              disabled={
                isProcessing ||
                (activeOp === 'merge' ? mergeDocs.length < 2 : !activeDoc)
              }
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#173F35] px-5 py-2.5 text-sm font-semibold text-[#F2F0E9] transition-colors duration-150 hover:bg-[#173F35]/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C49A58] disabled:cursor-not-allowed disabled:opacity-45 dark:bg-[#315D4D] dark:hover:bg-[#315D4D]/90"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="h-4 w-4" aria-hidden="true" />
              )}
              <span>
                {isProcessing
                  ? 'Processing PDF...'
                  : activeOp === 'merge'
                    ? 'Merge PDFs'
                    : activeOp === 'split'
                      ? 'Split PDF'
                      : activeOp === 'rotate'
                        ? 'Rotate PDF'
                        : activeOp === 'extract'
                          ? 'Extract Pages'
                          : 'Delete Selected Pages'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                clearOutputs();
                setErrorMessage('');
                if (activeOp === 'merge') {
                  setMergeDocs([]);
                } else {
                  setSelectedPages([]);
                  setPageSelectionInput('');
                  if (activeDoc) {
                    setSplitRangesInput(
                      activeDoc.pageCount >= 2
                        ? `1-${Math.ceil(activeDoc.pageCount / 2)}`
                        : '1'
                    );
                  }
                }
              }}
              className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#DCDDD3] bg-white px-4 py-2 text-xs font-medium text-[#56615B] transition-colors hover:border-[#C49A58] hover:text-[#252B28] dark:border-[#35463E] dark:bg-[#24332C] dark:text-[#B9C5BD] dark:hover:border-[#D9B978] dark:hover:text-[#F2F0E9]"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Reset Workspace</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
