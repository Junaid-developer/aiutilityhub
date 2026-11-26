import {
  AlertCircle,
  Check,
  ClipboardPaste,
  Copy,
  FileText,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { analyzeText } from '../../utils/wordCounter';

const DRAFT_STORAGE_KEY = 'ai-utility-hub-word-counter-draft';

const SAMPLE_TEXT =
  "AI Utility Hub brings together practical, clutter-free tools for everyday digital work. Whether you're drafting an article, refining product copy, or checking strict character limits, every metric updates automatically as you write.\n\nWell-structured writing relies on clear pacing and concise sentences. Paste your own draft here to inspect word counts, paragraph breaks, and estimated reading time in real time.";

function loadSavedDraft(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(DRAFT_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function WordCounterWorkspace() {
  const [text, setText] = useState<string>(loadSavedDraft);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [pasteError, setPasteError] = useState<string>('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const stats = useMemo(() => analyzeText(text), [text]);
  const hasText = text.length > 0;
  const canUseClipboardRead =
    typeof navigator !== 'undefined' &&
    Boolean(navigator.clipboard) &&
    typeof navigator.clipboard.readText === 'function';

  // Persist draft locally to protect against accidental page reloads
  useEffect(() => {
    try {
      if (text.length > 0) {
        localStorage.setItem(DRAFT_STORAGE_KEY, text);
      } else {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }, [text]);

  // Warn before closing or reloading the tab when unsaved text exists
  useEffect(() => {
    if (text.trim().length === 0) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [text]);

  // Auto-clear copy confirmation message
  useEffect(() => {
    if (copyStatus === 'idle') return;
    const timer = window.setTimeout(() => setCopyStatus('idle'), 2500);
    return () => window.clearTimeout(timer);
  }, [copyStatus]);

  // Reset confirmation prompt if editor becomes empty
  useEffect(() => {
    if (!hasText && confirmingClear) {
      setConfirmingClear(false);
    }
  }, [hasText, confirmingClear]);

  const handleCopyText = async () => {
    if (!hasText) return;
    setPasteError('');
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
        setCopyStatus('copied');
        return;
      }
      throw new Error('Clipboard API unavailable');
    } catch {
      // Fallback copy via textarea selection
      try {
        const el = textareaRef.current;
        if (el) {
          const prevStart = el.selectionStart;
          const prevEnd = el.selectionEnd;
          el.focus();
          el.select();
          const ok = document.execCommand('copy');
          el.setSelectionRange(prevStart, prevEnd);
          if (ok) {
            setCopyStatus('copied');
            return;
          }
        }
        setCopyStatus('error');
      } catch {
        setCopyStatus('error');
      }
    }
  };

  const handlePasteText = async () => {
    setPasteError('');
    setConfirmingClear(false);
    try {
      if (!canUseClipboardRead) {
        setPasteError(
          'Clipboard paste permission is unavailable in this browser. Use Ctrl+V or Cmd+V inside the text box.'
        );
        textareaRef.current?.focus();
        return;
      }

      const clipboardText = await navigator.clipboard.readText();
      if (!clipboardText) {
        setPasteError('Your clipboard is currently empty.');
        return;
      }

      const el = textareaRef.current;
      if (el && typeof el.selectionStart === 'number' && typeof el.selectionEnd === 'number') {
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const nextText = text.slice(0, start) + clipboardText + text.slice(end);
        setText(nextText);
        requestAnimationFrame(() => {
          el.focus();
          const cursorPos = start + clipboardText.length;
          el.setSelectionRange(cursorPos, cursorPos);
        });
      } else {
        setText((prev) => (prev ? `${prev}${clipboardText}` : clipboardText));
      }
    } catch {
      setPasteError(
        'Clipboard access was denied. Please press Ctrl+V (or Cmd+V) inside the editor to paste.'
      );
      textareaRef.current?.focus();
    }
  };

  const handleConfirmClear = () => {
    setText('');
    setConfirmingClear(false);
    setPasteError('');
    setCopyStatus('idle');
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
    textareaRef.current?.focus();
  };

  const handleInsertSample = () => {
    setText(SAMPLE_TEXT);
    setPasteError('');
    setConfirmingClear(false);
    textareaRef.current?.focus();
  };

  const statItems = [
    {
      label: 'Total Words',
      value: stats.words.toLocaleString(),
      accent: true,
    },
    {
      label: 'Characters (with spaces)',
      value: stats.charactersWithSpaces.toLocaleString(),
    },
    {
      label: 'Characters (no spaces)',
      value: stats.charactersWithoutSpaces.toLocaleString(),
    },
    {
      label: 'Sentences',
      value: stats.sentences.toLocaleString(),
    },
    {
      label: 'Paragraphs',
      value: stats.paragraphs.toLocaleString(),
    },
    {
      label: 'Estimated Reading Time',
      value: stats.readingTimeLabel,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Live Statistics Dashboard */}
      <section
        aria-label="Live text statistics"
        className="rounded-[18px] border border-[#DCDDD3] bg-white p-5 shadow-[0_2px_10px_-3px_rgba(23,63,53,0.06)] sm:p-6 dark:border-[#35463E] dark:bg-[#24332C] dark:shadow-[0_2px_10px_-3px_rgba(0,0,0,0.24)]"
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 lg:gap-0 lg:divide-x lg:divide-[#DCDDD3] dark:lg:divide-[#35463E]">
          {statItems.map((item, idx) => (
            <div
              key={item.label}
              className={`flex flex-col justify-between rounded-xl bg-[#EDE9DF]/45 p-3.5 lg:rounded-none lg:bg-transparent lg:px-5 lg:py-1 dark:bg-[#17231F]/60 dark:lg:bg-transparent ${
                idx === 0 ? 'lg:pl-0' : ''
              } ${idx === statItems.length - 1 ? 'lg:pr-0' : ''}`}
            >
              <p className="text-xs font-medium leading-snug text-[#56615B] dark:text-[#B9C5BD]">
                {item.label}
              </p>
              <p
                className={`mt-2 font-display text-2xl font-bold tracking-tight tabular-nums sm:text-[1.65rem] ${
                  item.accent
                    ? 'text-[#173F35] dark:text-[#D9B978]'
                    : 'text-[#252B28] dark:text-[#F2F0E9]'
                }`}
              >
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Main Text Editor Workspace */}
      <section
        aria-label="Word Counter editor"
        className="rounded-[18px] border border-[#DCDDD3] bg-white p-5 shadow-[0_2px_10px_-3px_rgba(23,63,53,0.06)] sm:p-7 dark:border-[#35463E] dark:bg-[#24332C] dark:shadow-[0_2px_10px_-3px_rgba(0,0,0,0.24)]"
      >
        {/* Editor Toolbar */}
        <div className="flex flex-col gap-3 border-b border-[#DCDDD3] pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-[#35463E]">
          <div>
            <label
              htmlFor="word-counter-editor"
              className="font-display text-sm font-semibold text-[#252B28] dark:text-[#F2F0E9]"
            >
              Text Editor
            </label>
            <p className="mt-0.5 text-xs text-[#56615B] tabular-nums dark:text-[#B9C5BD]">
              {stats.words.toLocaleString()}{' '}
              {stats.words === 1 ? 'word' : 'words'} ·{' '}
              {stats.charactersWithSpaces.toLocaleString()}{' '}
              {stats.charactersWithSpaces === 1 ? 'character' : 'characters'}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {canUseClipboardRead && (
              <button
                type="button"
                onClick={handlePasteText}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#DCDDD3] bg-[#EDE9DF]/45 px-3.5 text-xs font-semibold text-[#252B28] whitespace-nowrap transition-colors hover:border-[#C49A58] hover:bg-[#EDE9DF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C49A58] dark:border-[#35463E] dark:bg-[#17231F] dark:text-[#F2F0E9] dark:hover:border-[#D9B978]"
              >
                <ClipboardPaste className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Paste Text</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCopyText}
              disabled={!hasText}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#DCDDD3] bg-[#EDE9DF]/45 px-3.5 text-xs font-semibold text-[#252B28] whitespace-nowrap transition-colors hover:border-[#C49A58] hover:bg-[#EDE9DF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C49A58] disabled:cursor-not-allowed disabled:opacity-45 dark:border-[#35463E] dark:bg-[#17231F] dark:text-[#F2F0E9] dark:hover:border-[#D9B978]"
            >
              {copyStatus === 'copied' ? (
                <>
                  <Check
                    className="h-3.5 w-3.5 text-[#173F35] dark:text-[#D9B978]"
                    aria-hidden="true"
                  />
                  <span className="text-[#173F35] dark:text-[#D9B978]">
                    Copied
                  </span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Copy Text</span>
                </>
              )}
            </button>

            {confirmingClear ? (
              <div className="flex items-center gap-1.5 rounded-lg border border-[#C49A58] bg-[#EDE9DF]/70 px-2.5 py-1 dark:border-[#D9B978] dark:bg-[#17231F]">
                <span className="text-xs font-medium text-[#252B28] dark:text-[#F2F0E9]">
                  Clear all text?
                </span>
                <button
                  type="button"
                  onClick={handleConfirmClear}
                  className="min-h-8 rounded-md bg-[#173F35] px-2.5 text-xs font-semibold text-[#F2F0E9] transition-colors hover:bg-[#173F35]/90 dark:bg-[#315D4D]"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingClear(false)}
                  className="min-h-8 rounded-md px-2 text-xs font-medium text-[#56615B] hover:text-[#252B28] dark:text-[#B9C5BD] dark:hover:text-[#F2F0E9]"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (hasText) {
                    setConfirmingClear(true);
                  }
                }}
                disabled={!hasText}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#DCDDD3] bg-white px-3.5 text-xs font-semibold text-[#56615B] whitespace-nowrap transition-colors hover:border-[#C49A58] hover:text-[#252B28] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C49A58] disabled:cursor-not-allowed disabled:opacity-45 dark:border-[#35463E] dark:bg-[#24332C] dark:text-[#B9C5BD] dark:hover:border-[#D9B978] dark:hover:text-[#F2F0E9]"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Clear All</span>
              </button>
            )}
          </div>
        </div>

        {/* Inline Status / Clipboard Notifications */}
        {(copyStatus === 'copied' || copyStatus === 'error' || pasteError) && (
          <div className="mt-4">
            {copyStatus === 'copied' && (
              <p
                role="status"
                className="flex items-center gap-2 rounded-lg bg-[#E3EAE4] px-3.5 py-2 text-xs font-medium text-[#173F35] dark:bg-[#30483C] dark:text-[#F2F0E9]"
              >
                <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Text copied to your clipboard.</span>
              </p>
            )}
            {copyStatus === 'error' && (
              <p
                role="alert"
                className="flex items-center gap-2 rounded-lg bg-[#EDE9DF] px-3.5 py-2 text-xs font-medium text-[#252B28] dark:bg-[#17231F] dark:text-[#F2F0E9]"
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0 text-[#7D5C23] dark:text-[#D9B978]" aria-hidden="true" />
                <span>
                  Unable to copy automatically. Select your text and press
                  Ctrl+C (or Cmd+C).
                </span>
              </p>
            )}
            {pasteError && (
              <p
                role="status"
                className="flex items-center justify-between gap-2 rounded-lg bg-[#EDE9DF] px-3.5 py-2 text-xs font-medium text-[#252B28] dark:bg-[#17231F] dark:text-[#B9C5BD]"
              >
                <span className="flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 text-[#7D5C23] dark:text-[#D9B978]" aria-hidden="true" />
                  <span>{pasteError}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setPasteError('')}
                  className="shrink-0 font-semibold text-[#173F35] hover:underline dark:text-[#D9B978]"
                >
                  Dismiss
                </button>
              </p>
            )}
          </div>
        )}

        {/* Multiline Textarea */}
        <div className="mt-4">
          <textarea
            ref={textareaRef}
            id="word-counter-editor"
            rows={12}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (pasteError) setPasteError('');
            }}
            placeholder="Start typing or paste your text here..."
            className="min-h-[280px] w-full resize-y rounded-xl border border-[#DCDDD3] bg-[#EDE9DF]/35 p-4 text-base leading-relaxed text-[#252B28] placeholder-[#56615B] transition-colors focus:border-[#173F35] focus:bg-white focus:outline-none dark:border-[#35463E] dark:bg-[#17231F] dark:text-[#F2F0E9] dark:placeholder-[#B9C5BD] dark:focus:border-[#D9B978] dark:focus:bg-[#17231F]"
          />
        </div>

        {/* Helpful Empty State or Active Draft Footer */}
        {!hasText ? (
          <div className="mt-4 flex flex-col items-start justify-between gap-3 rounded-xl border border-[#DCDDD3]/80 bg-[#EDE9DF]/45 px-4 py-3.5 sm:flex-row sm:items-center dark:border-[#35463E] dark:bg-[#17231F]/65">
            <div className="flex items-start gap-2.5">
              <FileText
                className="mt-0.5 h-4 w-4 shrink-0 text-[#173F35] dark:text-[#D9B978]"
                aria-hidden="true"
              />
              <p className="text-xs leading-relaxed text-[#56615B] dark:text-[#B9C5BD]">
                Your editor is currently empty. Type or paste text above to
                count words, characters, sentences, paragraphs, and reading time
                locally in your browser.
              </p>
            </div>
            <button
              type="button"
              onClick={handleInsertSample}
              className="inline-flex min-h-9 shrink-0 items-center rounded-lg border border-[#DCDDD3] bg-white px-3.5 text-xs font-semibold text-[#173F35] whitespace-nowrap transition-colors hover:border-[#C49A58] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C49A58] dark:border-[#35463E] dark:bg-[#24332C] dark:text-[#D9B978]"
            >
              Load Sample Text
            </button>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#56615B] dark:text-[#B9C5BD]">
            <span>
              Processed locally in your browser · Reading speed: 200 words/min
            </span>
            <span className="tabular-nums">
              Draft auto-saved locally
            </span>
          </div>
        )}
      </section>
    </div>
  );
}
