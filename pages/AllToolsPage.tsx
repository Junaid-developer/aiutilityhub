import { RotateCcw, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ToolCard } from '../components/ToolCard';
import { TOOL_CATEGORIES, TOOLS_DATA } from '../data/toolsData';
import { RoutePath, ToolCategory } from '../types/navigation';

interface AllToolsPageProps {
  onNavigate: (path: RoutePath) => void;
  initialSearch?: string;
}

export function AllToolsPage({
  onNavigate,
  initialSearch = '',
}: AllToolsPageProps) {
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [activeCategory, setActiveCategory] = useState<ToolCategory>('All');

  useEffect(() => {
    setSearchQuery(initialSearch);
  }, [initialSearch]);

  const filteredTools = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return TOOLS_DATA.filter((tool) => {
      const matchesCategory =
        activeCategory === 'All' || tool.category === activeCategory;
      const matchesQuery =
        !query ||
        tool.name.toLowerCase().includes(query) ||
        tool.shortDescription.toLowerCase().includes(query) ||
        tool.category.toLowerCase().includes(query) ||
        tool.subcategory.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });
  }, [searchQuery, activeCategory]);

  const resetFilters = () => {
    setSearchQuery('');
    setActiveCategory('All');
  };

  return (
    <div className="py-12 sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Page Heading */}
        <div className="max-w-2xl">
          <h1 className="font-display text-3xl font-bold tracking-tight text-[#252B28] sm:text-4xl dark:text-[#F2F0E9]">
            All Online Tools
          </h1>
          <p className="mt-3 text-base leading-relaxed text-[#56615B] dark:text-[#B9C5BD]">
            Browse our full collection of focused digital utilities for image
            optimization, document workflows, structured data, and writing.
          </p>
        </div>

        {/* Search and Category Filters */}
        <div className="mt-8 flex flex-col gap-4 border-b border-[#DCDDD3] pb-6 lg:flex-row lg:items-center lg:justify-between dark:border-[#35463E]">
          <div className="relative w-full lg:max-w-sm">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#56615B] dark:text-[#B9C5BD]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tools by name or category..."
              aria-label="Search all tools"
              className="h-11 w-full rounded-xl border border-[#DCDDD3] bg-white pr-4 pl-10 text-sm text-[#252B28] placeholder-[#56615B] transition-colors focus:border-[#173F35] focus:outline-none dark:border-[#35463E] dark:bg-[#24332C] dark:text-[#F2F0E9] dark:placeholder-[#B9C5BD] dark:focus:border-[#D9B978]"
            />
          </div>

          <div
            role="tablist"
            aria-label="Filter tools by category"
            className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[#DCDDD3] bg-white p-1.5 dark:border-[#35463E] dark:bg-[#24332C]"
          >
            {TOOL_CATEGORIES.map((category) => {
              const isSelected = activeCategory === category;
              return (
                <button
                  key={category}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setActiveCategory(category)}
                  className={`min-h-9 rounded-lg px-3.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors duration-150 ${
                    isSelected
                      ? 'bg-[#173F35] text-[#F2F0E9] dark:bg-[#315D4D] dark:text-[#F2F0E9]'
                      : 'text-[#56615B] hover:bg-[#EDE9DF]/70 hover:text-[#252B28] dark:text-[#B9C5BD] dark:hover:bg-[#17231F] dark:hover:text-[#F2F0E9]'
                  }`}
                >
                  {category}
                </button>
              );
            })}
          </div>
        </div>

        {/* Result Count */}
        <div className="mt-6 flex items-center justify-between text-xs text-[#56615B] dark:text-[#B9C5BD]">
          <p className="tabular-nums">
            Showing {filteredTools.length} of {TOOLS_DATA.length} tools
          </p>
          {(searchQuery || activeCategory !== 'All') && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 font-medium text-[#173F35] hover:underline dark:text-[#D9B978]"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Reset filters</span>
            </button>
          )}
        </div>

        {/* Tools Grid or Empty State */}
        {filteredTools.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTools.map((tool, index) => (
              <ToolCard
                key={tool.id}
                tool={tool}
                priority={index < 3}
                onNavigate={(path) => onNavigate(path)}
              />
            ))}
          </div>
        ) : (
          <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-[#DCDDD3] bg-white px-6 py-16 text-center dark:border-[#35463E] dark:bg-[#24332C]">
            <p className="font-display text-lg font-semibold text-[#252B28] dark:text-[#F2F0E9]">
              No tools matched your search
            </p>
            <p className="mt-2 max-w-md text-sm text-[#56615B] dark:text-[#B9C5BD]">
              Try adjusting your search keywords or switching back to all tool
              categories.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-6 inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#173F35] px-5 py-2 text-sm font-semibold text-[#F2F0E9] transition-colors hover:bg-[#173F35]/90 dark:bg-[#315D4D]"
            >
              Show All Tools
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
