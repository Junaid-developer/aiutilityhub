import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

let workerConfigured = false;

export function ensurePdfJsBrowserWorker() {
  if (!workerConfigured) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    workerConfigured = true;
  }
}

export async function loadPdfWithBrowserPdfJs(bytes: Uint8Array) {
  ensurePdfJsBrowserWorker();
  const loadingTask = pdfjsLib.getDocument({
    data: bytes.slice(),
    verbosity: 0,
  });
  const doc = await loadingTask.promise;
  return {
    doc,
    cleanup: () => loadingTask.destroy(),
  };
}
