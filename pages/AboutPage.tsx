import { ArrowRight, Compass, Layers, ShieldCheck } from 'lucide-react';
import { RoutePath } from '../types/navigation';

interface AboutPageProps {
  onNavigate: (path: RoutePath) => void;
}

const PRINCIPLES = [
  {
    title: 'Clarity Over Clutter',
    description:
      'Every workspace removes distracting banners, unnecessary popups, and confusing menus so you can finish routine digital tasks without friction.',
    icon: Compass,
  },
  {
    title: 'Consistent Craft',
    description:
      'Whether you are formatting JSON or resizing a photo, every utility follows the same familiar layout, keyboard flow, and typography.',
    icon: Layers,
  },
  {
    title: 'Respectful Design',
    description:
      'We build utilities around local browser execution and honest disclosures rather than hidden account walls or opaque uploads.',
    icon: ShieldCheck,
  },
];

const WORKFLOW_TRACKS = [
  {
    title: 'Canvas Image Editing',
    detail:
      'Image Resizer and Image Compressor decode, scale, and re-encode JPG, PNG, and WebP assets locally via the HTML5 Canvas API.',
  },
  {
    title: 'Document & PDF Engines',
    detail:
      'PDF Tools, Word to PDF, and PDF to Word run client-side using pdf-lib, PDF.js, mammoth, JSZip, and docx with zero document uploads.',
  },
  {
    title: 'Text, JSON & QR Code Tools',
    detail:
      'Word Counter, JSON Formatter, and QR Code Generator execute instantaneously in browser memory and export clean UTF-8 text, JSON, PNG, or SVG.',
  },
  {
    title: 'WebAssembly AI Segmentation',
    detail:
      'Background Remover and Background Changer share a Web Worker ONNX Runtime session; open model weights download once and cache in CacheStorage.',
  },
];

const KNOWN_LIMITS = [
  'File size & resolution bounds: Image utilities accept up to 25 MB (capped at 33.2 MP for resize/compression and 25 MP / 8,000 px per side for AI cutouts). PDF Tools accept up to 50 MB per PDF (120 MB combined / 25 files max in Merge queues).',
  'PDF to Word conversion requires selectable embedded text and does not include OCR for scanned image-only PDFs; complex magazine spreads simplify into structured blocks.',
  'Word to PDF conversion supports modern .docx files (not legacy binary .doc) and renders clean standard typography rather than custom desktop fonts or Office macros.',
  'First-time AI background editing fetches ~44 MB model weights from public model hosts (Hugging Face or IMG.LY CDN fallback) unless already cached locally.',
];

export function AboutPage({ onNavigate }: AboutPageProps) {
  return (
    <div className="py-12 sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-[#7D5C23] dark:text-[#D9B978]">
            About AI Utility Hub
          </p>
          <h1 className="mt-2.5 font-display text-3xl font-bold tracking-tight text-[#252B28] sm:text-4xl dark:text-[#F2F0E9]">
            Useful Tools. Simpler Work.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-[#56615B] sm:text-lg dark:text-[#B9C5BD]">
            AI Utility Hub brings together ten everyday digital utilities inside
            one calm, browser-first web workspace—built for creators,
            developers, students, and teams who value fast, transparent tools.
          </p>
        </div>

        {/* Editorial Story Block */}
        <div className="mt-12 grid grid-cols-1 gap-8 border-y border-[#DCDDD3] py-10 md:grid-cols-12 dark:border-[#35463E]">
          <div className="md:col-span-5">
            <h2 className="font-display text-xl font-bold text-[#252B28] dark:text-[#F2F0E9]">
              Why We Built One Focused Hub
            </h2>
          </div>
          <div className="space-y-4 text-sm leading-relaxed text-[#56615B] sm:text-base md:col-span-7 dark:text-[#B9C5BD]">
            <p>
              Simple online tasks—compressing an image, checking word counts,
              generating a clean QR code, or validating JSON—often send people
              across dozens of cluttered single-purpose websites filled with
              popups, upload queues, and confusing buttons.
            </p>
            <p>
              AI Utility Hub replaces that friction with one cohesive workspace
              where your files stay in the browser. Each tool shares one
              dependable interface, WCAG-checked contrast in both Light and Dark
              themes, and clear controls tailored to the task at hand.
            </p>
          </div>
        </div>

        {/* Principles Grid */}
        <div className="mt-12">
          <h2 className="font-display text-2xl font-bold text-[#252B28] dark:text-[#F2F0E9]">
            Our Guiding Principles
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
            {PRINCIPLES.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="rounded-[18px] border border-[#DCDDD3] bg-white p-6 shadow-[0_2px_10px_-3px_rgba(23,63,53,0.05)] dark:border-[#35463E] dark:bg-[#24332C] dark:shadow-[0_2px_10px_-3px_rgba(0,0,0,0.2)]"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E3EAE4] text-[#173F35] dark:bg-[#30483C] dark:text-[#D9B978]">
                    <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                  </div>
                  <h3 className="mt-5 font-display text-base font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#56615B] dark:text-[#B9C5BD]">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Architecture & Honest Limitations */}
        <div className="mt-14 grid grid-cols-1 gap-8 border-t border-[#DCDDD3] pt-12 lg:grid-cols-12 dark:border-[#35463E]">
          <div className="lg:col-span-6">
            <h2 className="font-display text-xl font-bold text-[#252B28] dark:text-[#F2F0E9]">
              How the 10 Tools Execute
            </h2>
            <p className="mt-2 text-sm text-[#56615B] dark:text-[#B9C5BD]">
              Every utility runs directly inside your browser using modern web
              standards:
            </p>
            <div className="mt-5 space-y-4">
              {WORKFLOW_TRACKS.map((track) => (
                <div
                  key={track.title}
                  className="rounded-xl border border-[#DCDDD3] bg-white p-4 dark:border-[#35463E] dark:bg-[#24332C]"
                >
                  <h3 className="font-display text-sm font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                    {track.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-[#56615B] dark:text-[#B9C5BD]">
                    {track.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-6">
            <h2 className="font-display text-xl font-bold text-[#252B28] dark:text-[#F2F0E9]">
              Practical Scope &amp; Known Limits
            </h2>
            <p className="mt-2 text-sm text-[#56615B] dark:text-[#B9C5BD]">
              Because processing happens locally on your device rather than on
              remote servers, keep these transparent boundaries in mind:
            </p>
            <ul className="mt-5 space-y-3 rounded-xl border border-[#DCDDD3] bg-white p-5 dark:border-[#35463E] dark:bg-[#24332C]">
              {KNOWN_LIMITS.map((limit) => (
                <li
                  key={limit}
                  className="flex items-start gap-2.5 text-sm leading-relaxed text-[#56615B] dark:text-[#B9C5BD]"
                >
                  <span
                    aria-hidden="true"
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#173F35] dark:bg-[#D9B978]"
                  />
                  <span>{limit}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* CTA Banner */}
        <div className="mt-14 flex flex-col items-start justify-between gap-6 rounded-2xl border border-[#DCDDD3] bg-white p-6 sm:flex-row sm:items-center sm:p-8 dark:border-[#35463E] dark:bg-[#24332C]">
          <div>
            <h2 className="font-display text-lg font-bold text-[#252B28] dark:text-[#F2F0E9]">
              Ready to explore the workspace?
            </h2>
            <p className="mt-1 text-sm text-[#56615B] dark:text-[#B9C5BD]">
              View all ten tool interfaces designed for daily productivity.
            </p>
          </div>
          <a
            href="/tools"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/tools');
            }}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg bg-[#173F35] px-5 py-2.5 text-sm font-semibold text-[#F2F0E9] transition-colors hover:bg-[#173F35]/90 dark:bg-[#315D4D]"
          >
            <span>Explore All Tools</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </div>
    </div>
  );
}
