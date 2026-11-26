import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { MAX_THUMBNAIL_PREVIEW_PAGES } from './pdfTools';

let workerConfigured = false;

function ensureWorkerConfigured() {
  if (!workerConfigured) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    workerConfigured = true;
  }
}

export interface PdfThumbnailsResult {
  thumbnails: string[];
  truncated: boolean;
}

export async function renderPdfThumbnails(
  bytes: Uint8Array,
  maxPages = MAX_THUMBNAIL_PREVIEW_PAGES
): Promise<PdfThumbnailsResult> {
  ensureWorkerConfigured();

  const dataCopy = bytes.slice();
  const loadingTask = pdfjsLib.getDocument({ data: dataCopy, verbosity: 0 });
  const pdf = await loadingTask.promise;

  try {
    const countToRender = Math.min(pdf.numPages, maxPages);
    const thumbnails: string[] = [];

    for (let pageNum = 1; pageNum <= countToRender; pageNum += 1) {
      const page = await pdf.getPage(pageNum);
      const baseViewport = page.getViewport({ scale: 1 });
      const targetWidth = 180;
      const scale = Math.min(0.6, targetWidth / Math.max(baseViewport.width, 1));
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(viewport.width));
      canvas.height = Math.max(1, Math.round(viewport.height));

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        thumbnails.push('');
        continue;
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvas,
        canvasContext: ctx,
        viewport,
      }).promise;

      thumbnails.push(canvas.toDataURL('image/jpeg', 0.72));
      page.cleanup();
    }

    return {
      thumbnails,
      truncated: pdf.numPages > countToRender,
    };
  } finally {
    await loadingTask.destroy();
  }
}

export interface PdfPreviewPagesResult {
  pages: string[];
  totalPages: number;
  truncated: boolean;
}

export async function renderPdfPreviewPages(
  bytes: Uint8Array,
  maxPages = 20
): Promise<PdfPreviewPagesResult> {
  ensureWorkerConfigured();

  const dataCopy = bytes.slice();
  const loadingTask = pdfjsLib.getDocument({ data: dataCopy, verbosity: 0 });
  const pdf = await loadingTask.promise;

  try {
    const countToRender = Math.min(pdf.numPages, maxPages);
    const pages: string[] = [];

    for (let pageNum = 1; pageNum <= countToRender; pageNum += 1) {
      const page = await pdf.getPage(pageNum);
      const baseViewport = page.getViewport({ scale: 1 });
      const targetWidth = 640;
      const scale = Math.min(1.6, targetWidth / Math.max(baseViewport.width, 1));
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(viewport.width));
      canvas.height = Math.max(1, Math.round(viewport.height));

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        pages.push('');
        continue;
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvas,
        canvasContext: ctx,
        viewport,
      }).promise;

      pages.push(canvas.toDataURL('image/jpeg', 0.88));
      page.cleanup();
    }

    return {
      pages,
      totalPages: pdf.numPages,
      truncated: pdf.numPages > countToRender,
    };
  } finally {
    await loadingTask.destroy();
  }
}

