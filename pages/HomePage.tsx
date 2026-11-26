import {
  ArrowRight,
  CheckCircle2,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Zap,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { HeroVisual } from '../components/HeroVisual';
import { ToolCard, ToolIcon } from '../components/ToolCard';
import { TOOLS_DATA, WHY_CHOOSE_FEATURES } from '../data/toolsData';
import { FeatureItem, RoutePath } from '../types/navigation';

interface HomePageProps {
  onNavigate: (path: RoutePath, initialSearch?: string) => void;
}

const FEATURE_ICONS = {
  CheckCircle2,
  SlidersHorizontal,
  Zap,
  ShieldCheck,
};

function FeatureIcon({
  name,
}: {
  name: FeatureItem['iconName'];
}) {
  const Icon = FEATURE_ICONS[name];
  return <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />;
}

export function HomePage({ onNavigate }: HomePageProps) {
  const [heroQuery, setHeroQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const matchingTools = useMemo(() => {
    const q = heroQuery.trim().toLowerCase();
    if (!q) return [];
    return TOOLS_DATA.filter(
      (tool) =>
        tool.name.toLowerCase().includes(q) ||
        tool.shortDescription.toLowerCase().includes(q) ||
        tool.category.toLowerCase().includes(q)
    );
  }, [heroQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNavigate('/tools', heroQuery.trim());
  };

  return (
    <div>
      {/* Hero Section */}
      <section className="border-b border-[#DCDDD3] py-14 sm:py-20 lg:py-24 dark:border-[#35463E]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-14">
            {/* Left Copy & Search */}
            <div className="lg:col-span-6">
              <h1
                className="font-display font-bold tracking-tight text-[#252B28] dark:text-[#F2F0E9]"
                style={{
                  fontSize: 'clamp(2.25rem, 3.8vw, 3.35rem)',
                  lineHeight: 1.08,
                }}
              >
                Everything You Need, In One Utility Hub.
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-[#56615B] sm:text-lg dark:text-[#B9C5BD]">
                Discover simple, powerful and free online tools designed to make
                your everyday digital tasks easier.
              </p>

              {/* Prominent Search Bar & Primary Action */}
              <div className="relative mt-8 max-w-xl">
                <form
                  onSubmit={handleSearchSubmit}
                  className="flex flex-col gap-3 sm:flex-row"
                >
                  <div className="relative flex-1">
                    <Search
                      className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-[#56615B] dark:text-[#B9C5BD]"
                      aria-hidden="true"
                    />
                    <input
                      type="search"
                      value={heroQuery}
                      onChange={(e) => setHeroQuery(e.target.value)}
                      onFocus={() => setSearchFocused(true)}
                      onBlur={() => {
                        setTimeout(() => setSearchFocused(false), 150);
                      }}
                      placeholder="Search for a tool..."
                      aria-label="Search for a tool"
                      className="h-12 w-full rounded-xl border border-[#DCDDD3] bg-white pr-4 pl-11 text-sm text-[#252B28] placeholder-[#56615B] shadow-[0_1px_2px_rgba(23,63,53,0.04)] transition-colors focus:border-[#173F35] focus:outline-none dark:border-[#35463E] dark:bg-[#24332C] dark:text-[#F2F0E9] dark:placeholder-[#B9C5BD] dark:focus:border-[#D9B978]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#173F35] px-6 text-sm font-semibold text-[#F2F0E9] whitespace-nowrap transition-colors duration-150 hover:bg-[#173F35]/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C49A58] dark:bg-[#315D4D] dark:hover:bg-[#315D4D]/90"
                  >
                    <span>Explore All Tools</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </form>

                {/* Live Quick Suggestions Dropdown */}
                {searchFocused && heroQuery.trim().length > 0 && (
                  <div className="absolute right-0 left-0 z-20 mt-2 overflow-hidden rounded-xl border border-[#DCDDD3] bg-white shadow-md dark:border-[#35463E] dark:bg-[#24332C]">
                    {matchingTools.length > 0 ? (
                      <ul className="divide-y divide-[#DCDDD3]/70 dark:divide-[#35463E]">
                        {matchingTools.map((tool) => (
                          <li key={tool.id}>
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                onNavigate(`/tools/${tool.id}`);
                              }}
                              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[#EDE9DF]/60 dark:hover:bg-[#17231F]"
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#EDE9DF] text-[#173F35] dark:bg-[#17231F] dark:text-[#D9B978]">
                                  <ToolIcon
                                    iconName={tool.iconName}
                                    className="h-4 w-4"
                                  />
                                </span>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                                    {tool.name}
                                  </p>
                                  <p className="truncate text-xs text-[#56615B] dark:text-[#B9C5BD]">
                                    {tool.shortDescription}
                                  </p>
                                </div>
                              </div>
                              <span className="shrink-0 text-xs font-medium text-[#173F35] dark:text-[#D9B978]">
                                Open
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="px-4 py-3 text-sm text-[#56615B] dark:text-[#B9C5BD]">
                        No matching tools found. Press Enter to view all tools.
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#56615B] dark:text-[#B9C5BD]">
                <span className="font-medium text-[#173F35] dark:text-[#D9B978]">
                  Free Online Tools
                </span>
                <span aria-hidden="true">·</span>
                <span>Image, PDF, JSON &amp; Writing utilities</span>
              </div>
            </div>

            {/* Right Decorative Visual */}
            <div className="lg:col-span-6">
              <HeroVisual onNavigate={(path) => onNavigate(path)} />
            </div>
          </div>
        </div>
      </section>

      {/* Popular Tools Section */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div className="max-w-xl">
              <h2 className="font-display text-2xl font-bold tracking-tight text-[#252B28] sm:text-3xl dark:text-[#F2F0E9]">
                Explore Our Popular Tools
              </h2>
              <p className="mt-2 text-base text-[#56615B] dark:text-[#B9C5BD]">
                Everything you need to work smarter and faster.
              </p>
            </div>
            <a
              href="/tools"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/tools');
              }}
              className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#173F35] transition-colors hover:text-[#7D5C23] dark:text-[#D9B978] dark:hover:text-[#F2F0E9]"
            >
              <span>View all tools</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS_DATA.map((tool, index) => (
              <ToolCard
                key={tool.id}
                tool={tool}
                priority={index < 3}
                onNavigate={(path) => onNavigate(path)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section className="border-y border-[#DCDDD3] bg-[#E5E0D4]/55 py-16 sm:py-20 dark:border-[#35463E] dark:bg-[#1B2A24]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-xl">
            <h2 className="font-display text-2xl font-bold tracking-tight text-[#252B28] sm:text-3xl dark:text-[#F2F0E9]">
              Why Choose AI Utility Hub?
            </h2>
            <p className="mt-2 text-base text-[#56615B] dark:text-[#B9C5BD]">
              Built around clarity, speed, and thoughtful design for everyday
              digital work.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {WHY_CHOOSE_FEATURES.map((feature) => (
              <div
                key={feature.id}
                className="rounded-[18px] border border-[#DCDDD3] bg-white p-6 shadow-[0_2px_10px_-3px_rgba(23,63,53,0.05)] dark:border-[#35463E] dark:bg-[#24332C] dark:shadow-[0_2px_10px_-3px_rgba(0,0,0,0.2)]"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E3EAE4] text-[#173F35] dark:bg-[#30483C] dark:text-[#D9B978]">
                  <FeatureIcon name={feature.iconName} />
                </div>
                <h3 className="mt-5 font-display text-base font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#56615B] dark:text-[#B9C5BD]">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Browser-Side Architecture & Workflow Guide */}
      <section className="pt-16 sm:pt-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="font-display text-2xl font-bold tracking-tight text-[#252B28] sm:text-3xl dark:text-[#F2F0E9]">
              How Browser-Side Tools Protect Speed &amp; Privacy
            </h2>
            <p className="mt-2 text-base text-[#56615B] dark:text-[#B9C5BD]">
              Practical workflows across images, documents, and code—without
              uploading your working files to an application server.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="rounded-[18px] border border-[#DCDDD3] bg-white p-6 shadow-[0_2px_10px_-3px_rgba(23,63,53,0.05)] dark:border-[#35463E] dark:bg-[#24332C] dark:shadow-none">
              <h3 className="font-display text-base font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                Local Execution vs. Model Caching
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#56615B] dark:text-[#B9C5BD]">
                Text, JSON, QR, PDF, Word conversion, and image resizing run
                entirely on your device from the moment the page loads. The two
                AI background tools download open ONNX segmentation weights
                once on first use and cache them in browser storage while your
                photos stay local.
              </p>
            </div>

            <div className="rounded-[18px] border border-[#DCDDD3] bg-white p-6 shadow-[0_2px_10px_-3px_rgba(23,63,53,0.05)] dark:border-[#35463E] dark:bg-[#24332C] dark:shadow-none">
              <h3 className="font-display text-base font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                Choosing the Right Utility
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#56615B] dark:text-[#B9C5BD]">
                Start with Image Resizer when pixels must match exact frame
                dimensions, or Image Compressor when cutting file weight for the
                web. Use PDF Tools for page structure, and PDF to Word or Word
                to PDF for editable text-based document conversion.
              </p>
            </div>

            <div className="rounded-[18px] border border-[#DCDDD3] bg-white p-6 shadow-[0_2px_10px_-3px_rgba(23,63,53,0.05)] dark:border-[#35463E] dark:bg-[#24332C] dark:shadow-none">
              <h3 className="font-display text-base font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                Built-In Memory Safeguards
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#56615B] dark:text-[#B9C5BD]">
                Browser tabs protect stability with clear limits: up to 25 MB
                for images (33.2 MP canvas / 25 MP AI cutouts) and 50 MB per PDF
                (120 MB combined for merges). Oversized files surface actionable
                prompts instead of freezing your browser.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-8 rounded-2xl border border-[#173F35] bg-[#173F35] px-6 py-10 text-[#F2F0E9] sm:px-10 sm:py-12 lg:flex-row lg:items-center dark:border-[#35463E] dark:bg-[#315D4D]">
            <div className="max-w-xl">
              <h2 className="font-display text-2xl font-bold tracking-tight text-[#F2F0E9] sm:text-3xl">
                Make Your Daily Work Easier
              </h2>
              <p className="mt-2.5 text-base text-[#EDE9DF]/90 dark:text-[#F2F0E9]/85">
                Explore practical online tools designed for everyone.
              </p>
            </div>
            <a
              href="/tools"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/tools');
              }}
              className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-xl bg-[#C49A58] px-6 py-3 text-sm font-semibold text-[#17231F] whitespace-nowrap transition-colors duration-150 hover:bg-[#D9B978] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F2F0E9] dark:bg-[#D9B978] dark:text-[#17231F] dark:hover:bg-[#C49A58]"
            >
              <span>Explore All Tools</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
