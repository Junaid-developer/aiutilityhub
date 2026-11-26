import { ArrowRight, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { Suspense, lazy, useState } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ToolCard, ToolIcon } from '../components/ToolCard';
import { TOOLS_DATA } from '../data/toolsData';
import { RoutePath, ToolSlug } from '../types/navigation';

const ImageCompressorWorkspace = lazy(() =>
  import('../components/workspaces/ImageCompressorWorkspace').then((m) => ({
    default: m.ImageCompressorWorkspace,
  }))
);
const QrCodeGeneratorWorkspace = lazy(() =>
  import('../components/workspaces/QrCodeGeneratorWorkspace').then((m) => ({
    default: m.QrCodeGeneratorWorkspace,
  }))
);
const PdfToolsWorkspace = lazy(() =>
  import('../components/workspaces/PdfToolsWorkspace').then((m) => ({
    default: m.PdfToolsWorkspace,
  }))
);
const JsonFormatterWorkspace = lazy(() =>
  import('../components/workspaces/JsonFormatterWorkspace').then((m) => ({
    default: m.JsonFormatterWorkspace,
  }))
);
const ImageResizerWorkspace = lazy(() =>
  import('../components/workspaces/ImageResizerWorkspace').then((m) => ({
    default: m.ImageResizerWorkspace,
  }))
);
const WordCounterWorkspace = lazy(() =>
  import('../components/workspaces/WordCounterWorkspace').then((m) => ({
    default: m.WordCounterWorkspace,
  }))
);
const PdfToWordWorkspace = lazy(() =>
  import('../components/workspaces/PdfToWordWorkspace').then((m) => ({
    default: m.PdfToWordWorkspace,
  }))
);
const WordToPdfWorkspace = lazy(() =>
  import('../components/workspaces/WordToPdfWorkspace').then((m) => ({
    default: m.WordToPdfWorkspace,
  }))
);
const ImageBackgroundRemoverWorkspace = lazy(() =>
  import('../components/workspaces/ImageBackgroundRemoverWorkspace').then(
    (m) => ({
      default: m.ImageBackgroundRemoverWorkspace,
    })
  )
);
const ImageBackgroundChangerWorkspace = lazy(() =>
  import('../components/workspaces/ImageBackgroundChangerWorkspace').then(
    (m) => ({
      default: m.ImageBackgroundChangerWorkspace,
    })
  )
);

interface ToolDetailPageProps {
  toolId: ToolSlug;
  onNavigate: (path: RoutePath) => void;
}

function WorkspaceLoadingFallback({ toolName }: { toolName: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-[#DCDDD3] bg-white p-8 text-center shadow-[0_1px_2px_rgba(23,63,53,0.03)] dark:border-[#35463E] dark:bg-[#24332C] dark:shadow-none"
    >
      <Loader2
        className="h-7 w-7 animate-spin text-[#173F35] dark:text-[#D9B978]"
        aria-hidden="true"
      />
      <p className="mt-3 font-display text-sm font-semibold text-[#252B28] dark:text-[#F2F0E9]">
        Loading {toolName} workspace...
      </p>
      <p className="mt-1 text-xs text-[#56615B] dark:text-[#B9C5BD]">
        Preparing browser utilities locally on your device.
      </p>
    </div>
  );
}

export function ToolDetailPage({ toolId, onNavigate }: ToolDetailPageProps) {
  const tool = TOOLS_DATA.find((item) => item.id === toolId) ?? TOOLS_DATA[0];
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const relatedTools = tool.relatedIds
    .map((id) => TOOLS_DATA.find((item) => item.id === id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const renderWorkspace = () => {
    switch (tool.id) {
      case 'image-compressor':
        return <ImageCompressorWorkspace />;
      case 'qr-code-generator':
        return <QrCodeGeneratorWorkspace />;
      case 'pdf-tools':
        return <PdfToolsWorkspace />;
      case 'json-formatter':
        return <JsonFormatterWorkspace />;
      case 'image-resizer':
        return <ImageResizerWorkspace />;
      case 'word-counter':
        return <WordCounterWorkspace />;
      case 'pdf-to-word':
        return <PdfToWordWorkspace />;
      case 'word-to-pdf':
        return <WordToPdfWorkspace />;
      case 'image-background-remover':
        return <ImageBackgroundRemoverWorkspace />;
      case 'image-background-changer':
        return <ImageBackgroundChangerWorkspace />;
    }
  };

  return (
    <div className="py-10 sm:py-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#56615B] dark:text-[#B9C5BD]">
            <li>
              <a
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate('/');
                }}
                className="hover:text-[#173F35] dark:hover:text-[#F2F0E9]"
              >
                Home
              </a>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="h-3.5 w-3.5" />
            </li>
            <li>
              <a
                href="/tools"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate('/tools');
                }}
                className="hover:text-[#173F35] dark:hover:text-[#F2F0E9]"
              >
                All Tools
              </a>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="h-3.5 w-3.5" />
            </li>
            <li
              aria-current="page"
              className="text-[#173F35] dark:text-[#D9B978]"
            >
              {tool.name}
            </li>
          </ol>
        </nav>

        {/* Tool Header */}
        <header className="mb-8 border-b border-[#DCDDD3] pb-8 dark:border-[#35463E]">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#173F35] text-[#F2F0E9] dark:bg-[#315D4D] dark:text-[#F2F0E9]">
              <ToolIcon iconName={tool.iconName} className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-[#56615B] dark:text-[#B9C5BD]">
                {tool.category} <span aria-hidden="true">·</span>{' '}
                {tool.subcategory}
              </p>
              <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-[#252B28] sm:text-3xl dark:text-[#F2F0E9]">
                {tool.name}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#56615B] sm:text-base dark:text-[#B9C5BD]">
                {tool.longDescription}
              </p>
            </div>
          </div>
        </header>

        {/* Tool Workspace with ErrorBoundary & Lazy Suspense */}
        <section aria-label={`${tool.name} workspace`}>
          <ErrorBoundary
            scopeName={tool.name}
            resetKey={tool.id}
            onNavigate={(path) => onNavigate(path)}
          >
            <Suspense fallback={<WorkspaceLoadingFallback toolName={tool.name} />}>
              {renderWorkspace()}
            </Suspense>
          </ErrorBoundary>
        </section>

        {/* Instructions & FAQs */}
        <section className="mt-14 grid grid-cols-1 items-start gap-10 border-t border-[#DCDDD3] pt-12 lg:grid-cols-12 dark:border-[#35463E]">
          {/* How to Use */}
          <div className="lg:col-span-5">
            <h2 className="font-display text-xl font-bold text-[#252B28] dark:text-[#F2F0E9]">
              How to Use {tool.name}
            </h2>
            <p className="mt-2 text-sm text-[#56615B] dark:text-[#B9C5BD]">
              A quick overview of the workflow inside this workspace.
            </p>
            <ol className="mt-6 space-y-4">
              {tool.instructions.map((step, index) => (
                <li key={index} className="flex items-start gap-3.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#DCDDD3] bg-white font-mono text-xs font-semibold text-[#173F35] tabular-nums dark:border-[#35463E] dark:bg-[#24332C] dark:text-[#D9B978]">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <p className="pt-0.5 text-sm leading-relaxed text-[#252B28] dark:text-[#F2F0E9]">
                    {step}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          {/* Frequently Asked Questions */}
          <div className="lg:col-span-7">
            <h2 className="font-display text-xl font-bold text-[#252B28] dark:text-[#F2F0E9]">
              Frequently Asked Questions
            </h2>
            <div className="mt-6 divide-y divide-[#DCDDD3] rounded-xl border border-[#DCDDD3] bg-white dark:divide-[#35463E] dark:border-[#35463E] dark:bg-[#24332C]">
              {tool.faqs.map((faq, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <div key={faq.question}>
                    <h3>
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() =>
                          setOpenFaqIndex(isOpen ? null : idx)
                        }
                        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-[#EDE9DF]/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#C49A58] dark:hover:bg-[#17231F]/40"
                      >
                        <span className="font-display text-sm font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                          {faq.question}
                        </span>
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 text-[#56615B] transition-transform duration-200 dark:text-[#B9C5BD] ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                          aria-hidden="true"
                        />
                      </button>
                    </h3>
                    {isOpen && (
                      <div className="px-5 pb-4 text-sm leading-relaxed text-[#56615B] dark:text-[#B9C5BD]">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Practical Use Cases, Tips & Technical Notes */}
        <section className="mt-14 grid grid-cols-1 gap-8 border-t border-[#DCDDD3] pt-12 lg:grid-cols-12 dark:border-[#35463E]">
          <div className="space-y-6 lg:col-span-7">
            <div>
              <h2 className="font-display text-xl font-bold text-[#252B28] dark:text-[#F2F0E9]">
                Practical Use Cases &amp; Tips
              </h2>
              <p className="mt-2 text-sm text-[#56615B] dark:text-[#B9C5BD]">
                Common tasks and recommended settings for getting the cleanest
                results.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-[#DCDDD3] bg-white p-5 dark:border-[#35463E] dark:bg-[#24332C]">
                <h3 className="font-display text-sm font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                  When to Use This Tool
                </h3>
                <ul className="mt-3 space-y-2.5">
                  {tool.useCases.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2.5 text-sm leading-relaxed text-[#56615B] dark:text-[#B9C5BD]"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#173F35] dark:bg-[#D9B978]"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-[#DCDDD3] bg-white p-5 dark:border-[#35463E] dark:bg-[#24332C]">
                <h3 className="font-display text-sm font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                  Workflow Tips
                </h3>
                <ul className="mt-3 space-y-2.5">
                  {tool.tips.map((tip) => (
                    <li
                      key={tip}
                      className="flex items-start gap-2.5 text-sm leading-relaxed text-[#56615B] dark:text-[#B9C5BD]"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7D5C23] dark:bg-[#D9B978]"
                      />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <h2 className="font-display text-xl font-bold text-[#252B28] dark:text-[#F2F0E9]">
              Formats, Limits &amp; Technical Notes
            </h2>
            <p className="mt-2 text-sm text-[#56615B] dark:text-[#B9C5BD]">
              Supported inputs, browser memory bounds, and execution details.
            </p>
            <dl className="mt-6 divide-y divide-[#DCDDD3] rounded-xl border border-[#DCDDD3] bg-white dark:divide-[#35463E] dark:border-[#35463E] dark:bg-[#24332C]">
              <div className="px-5 py-3.5">
                <dt className="text-xs font-semibold tracking-wide text-[#7D5C23] uppercase dark:text-[#D9B978]">
                  Supported Formats
                </dt>
                <dd className="mt-1 text-sm leading-relaxed text-[#252B28] dark:text-[#F2F0E9]">
                  {tool.technicalNotes.supportedFormats}
                </dd>
              </div>
              <div className="px-5 py-3.5">
                <dt className="text-xs font-semibold tracking-wide text-[#7D5C23] uppercase dark:text-[#D9B978]">
                  Browser Limits
                </dt>
                <dd className="mt-1 text-sm leading-relaxed text-[#252B28] dark:text-[#F2F0E9]">
                  {tool.technicalNotes.limits}
                </dd>
              </div>
              <div className="px-5 py-3.5">
                <dt className="text-xs font-semibold tracking-wide text-[#7D5C23] uppercase dark:text-[#D9B978]">
                  Execution &amp; Privacy
                </dt>
                <dd className="mt-1 text-sm leading-relaxed text-[#252B28] dark:text-[#F2F0E9]">
                  {tool.technicalNotes.privacyModel}
                </dd>
              </div>
              <div className="px-5 py-3.5">
                <dt className="text-xs font-semibold tracking-wide text-[#7D5C23] uppercase dark:text-[#D9B978]">
                  Important Trade-offs
                </dt>
                <dd className="mt-1 text-sm leading-relaxed text-[#56615B] dark:text-[#B9C5BD]">
                  {tool.technicalNotes.tradeoffs}
                </dd>
              </div>
            </dl>
          </div>
        </section>

        {/* Related Tools */}
        <section className="mt-14 border-t border-[#DCDDD3] pt-12 dark:border-[#35463E]">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-xl font-bold text-[#252B28] dark:text-[#F2F0E9]">
              Related Tools
            </h2>
            <a
              href="/tools"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/tools');
              }}
              className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-[#173F35] transition-colors hover:text-[#7D5C23] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C49A58] dark:text-[#D9B978] dark:hover:text-[#F2F0E9]"
            >
              <span>All Tools</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {relatedTools.map((relTool) => (
              <ToolCard
                key={relTool.id}
                tool={relTool}
                onNavigate={(path) => onNavigate(path)}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
