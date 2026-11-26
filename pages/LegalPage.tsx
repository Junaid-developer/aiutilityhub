import { RoutePath } from '../types/navigation';

interface LegalPageProps {
  type: 'privacy' | 'terms';
  onNavigate: (path: RoutePath) => void;
}

const PRIVACY_SECTIONS = [
  {
    title: '1. Overview',
    body: 'AI Utility Hub is built around local browser execution and transparent privacy disclosures. This Privacy Policy explains exactly what happens in your browser when you visit pages, save local workspace preferences, or run any of the ten utilities.',
  },
  {
    title: '2. Theme Preferences & Browser Storage',
    body: 'AI Utility Hub does not require user accounts or login sessions. Browser localStorage is used strictly on your device for two optional preferences: your Light/Dark theme selection (ai-utility-hub-theme) and your active Word Counter draft text (ai-utility-hub-word-counter-draft) until you clear it. You can erase both at any time through your browser site-data settings.',
  },
  {
    title: '3. Local File Processing & AI Model Caching',
    body: 'All ten tools—Word Counter, JSON Formatter, QR Code Generator, Image Resizer, Image Compressor, PDF Tools, Word to PDF, PDF to Word, Image Background Remover, and Image Background Changer—process your files, text, and images locally inside your browser. Your documents and images are not uploaded to an AI Utility Hub server. When you run AI background segmentation for the first time, the WebAssembly ONNX Runtime (/ort-wasm/) is loaded from the app itself and open segmentation model weights are cached locally in browser CacheStorage (ai-utility-hub-bg-models-v1) so repeat uses require zero re-downloading.',
  },
  {
    title: '4. Third-Party Network Requests & External Hosts',
    body: 'While user files remain on your device, your browser makes two categories of external network requests during normal usage: (a) loading Plus Jakarta Sans, DM Sans, and JetBrains Mono stylesheets and font files from Google Fonts (fonts.googleapis.com and fonts.gstatic.com); and (b) on first-time use of AI Background Remover or Image Background Changer before a model is cached locally, downloading quantized ONNX segmentation weights from Hugging Face (huggingface.co for BRIA RMBG-1.4 ~44.4 MB primary and MODNet ~6.6 MB lightweight fallback) or IMG.LY CDN (staticimgly.com for IS-Net ~44.3 MB fallback). Those third-party hosts process standard HTTP request metadata (such as IP address and user-agent headers) under their own privacy policies.',
  },
  {
    title: '5. Cookies, Analytics & Future Advertising Disclosure',
    body: 'AI Utility Hub does not currently run third-party analytics trackers, behavioral profiling scripts, or advertising cookies. If advertising services (such as Google AdSense) are enabled on the site in the future, third-party partners including Google may use cookies or similar browser storage to serve and measure ads, and applicable regional consent notices (including EEA, UK, and Switzerland requirements) along with updated disclosures will be active before any advertising goes live.',
  },
  {
    title: '6. Contact & Policy Updates',
    body: 'We may update this Privacy Policy as contact channels, domain configuration, or site features evolve. Once our production domain and support inbox are finalized, verified contact details will be published on the Contact Us page.',
  },
];

const TERMS_SECTIONS = [
  {
    title: '1. Acceptance of Terms',
    body: 'By accessing and browsing AI Utility Hub, you agree to comply with these Terms & Conditions and all applicable local laws and regulations.',
  },
  {
    title: '2. Use of Website & Browser Utilities',
    body: 'AI Utility Hub provides browser-based utilities intended for lawful personal, educational, and professional workflows. You remain solely responsible for verifying the accuracy of converted documents, resized or compressed images, QR codes, and formatted data before publishing or distributing them.',
  },
  {
    title: '3. Browser Limits & Document Fidelity',
    body: 'Because tools execute locally inside your browser, maximum file sizes and canvas dimensions are bounded by browser memory limits. Document conversions (PDF to Word and Word to PDF) work best on structured, selectable-text files and do not perform OCR on scanned image-only PDFs or preserve every custom desktop publishing layout.',
  },
  {
    title: '4. Intellectual Property',
    body: 'You retain full rights to all files, images, and text you process in your browser. The AI Utility Hub brand name, logo mark, page layouts, and original interface designs remain the property of AI Utility Hub and may not be redistributed as a competing template without permission.',
  },
  {
    title: '5. Disclaimer of Warranties',
    body: 'All pages and online utilities are provided on an "as available" basis without warranties of uninterrupted availability, error-free conversion, or fitness for a particular commercial purpose.',
  },
  {
    title: '6. Changes to Terms',
    body: 'We may update these Terms & Conditions as new tools and capabilities are introduced. Continued use of the website after updates constitutes acceptance of the revised terms.',
  },
];

export function LegalPage({ type, onNavigate }: LegalPageProps) {
  const isPrivacy = type === 'privacy';
  const title = isPrivacy ? 'Privacy Policy' : 'Terms & Conditions';
  const subtitle = isPrivacy
    ? 'How AI Utility Hub handles browser storage, local file execution, and external model/font requests.'
    : 'Guidelines for accessing and using the AI Utility Hub website and browser utilities.';
  const sections = isPrivacy ? PRIVACY_SECTIONS : TERMS_SECTIONS;

  return (
    <div className="py-12 sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          {/* Left Sticky Legal Navigation */}
          <aside className="lg:col-span-4">
            <div className="lg:sticky lg:top-24">
              <p className="text-sm font-medium text-[#7D5C23] dark:text-[#D9B978]">
                Legal Documentation
              </p>
              <h1 className="mt-2.5 font-display text-3xl font-bold tracking-tight text-[#252B28] sm:text-4xl dark:text-[#F2F0E9]">
                {title}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-[#56615B] sm:text-base dark:text-[#B9C5BD]">
                {subtitle}
              </p>
              <p className="mt-3 font-mono text-xs text-[#56615B] dark:text-[#B9C5BD]">
                Last updated: November 2026
              </p>

              <nav
                aria-label="Legal pages"
                className="mt-6 flex flex-col gap-1.5 border-t border-[#DCDDD3] pt-5 dark:border-[#35463E]"
              >
                <a
                  href="/privacy"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('/privacy');
                  }}
                  aria-current={isPrivacy ? 'page' : undefined}
                  className={`flex min-h-10 items-center rounded-lg px-3.5 text-left text-sm font-medium transition-colors ${
                    isPrivacy
                      ? 'bg-[#173F35] text-[#F2F0E9] dark:bg-[#315D4D]'
                      : 'text-[#56615B] hover:bg-white hover:text-[#252B28] dark:text-[#B9C5BD] dark:hover:bg-[#24332C] dark:hover:text-[#F2F0E9]'
                  }`}
                >
                  Privacy Policy
                </a>
                <a
                  href="/terms"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('/terms');
                  }}
                  aria-current={!isPrivacy ? 'page' : undefined}
                  className={`flex min-h-10 items-center rounded-lg px-3.5 text-left text-sm font-medium transition-colors ${
                    !isPrivacy
                      ? 'bg-[#173F35] text-[#F2F0E9] dark:bg-[#315D4D]'
                      : 'text-[#56615B] hover:bg-white hover:text-[#252B28] dark:text-[#B9C5BD] dark:hover:bg-[#24332C] dark:hover:text-[#F2F0E9]'
                  }`}
                >
                  Terms &amp; Conditions
                </a>
                <a
                  href="/contact"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('/contact');
                  }}
                  className="flex min-h-10 items-center rounded-lg px-3.5 text-left text-sm font-medium text-[#56615B] transition-colors hover:bg-white hover:text-[#252B28] dark:text-[#B9C5BD] dark:hover:bg-[#24332C] dark:hover:text-[#F2F0E9]"
                >
                  Questions? Contact Us
                </a>
              </nav>
            </div>
          </aside>

          {/* Right Document Content */}
          <div className="lg:col-span-8">
            <div className="space-y-8 rounded-2xl border border-[#DCDDD3] bg-white p-6 shadow-[0_1px_2px_rgba(23,63,53,0.03)] sm:p-10 dark:border-[#35463E] dark:bg-[#24332C] dark:shadow-none">
              {sections.map((section) => (
                <section
                  key={section.title}
                  className="border-b border-[#DCDDD3]/80 pb-6 last:border-b-0 last:pb-0 dark:border-[#35463E]"
                >
                  <h2 className="font-display text-lg font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                    {section.title}
                  </h2>
                  <p className="mt-2.5 text-sm leading-relaxed text-[#56615B] sm:text-base dark:text-[#B9C5BD]">
                    {section.body}
                  </p>
                </section>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
