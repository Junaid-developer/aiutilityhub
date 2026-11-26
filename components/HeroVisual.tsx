import {
  ArrowRight,
  Braces,
  FileText,
  Image as ImageIcon,
  QrCode,
  Scan,
  Type,
} from 'lucide-react';
import { RoutePath } from '../types/navigation';

interface HeroVisualProps {
  onNavigate: (path: RoutePath) => void;
}

const SUITE_ITEMS: {
  title: string;
  category: string;
  path: RoutePath;
  icon: typeof ImageIcon;
}[] = [
  {
    title: 'Image Compressor',
    category: 'Image Optimization',
    path: '/tools/image-compressor',
    icon: ImageIcon,
  },
  {
    title: 'QR Code Generator',
    category: 'Sharing & Codes',
    path: '/tools/qr-code-generator',
    icon: QrCode,
  },
  {
    title: 'PDF Tools',
    category: 'Document Pages',
    path: '/tools/pdf-tools',
    icon: FileText,
  },
  {
    title: 'JSON Formatter',
    category: 'Structured Data',
    path: '/tools/json-formatter',
    icon: Braces,
  },
  {
    title: 'Image Resizer',
    category: 'Canvas & Dimensions',
    path: '/tools/image-resizer',
    icon: Scan,
  },
  {
    title: 'Word Counter',
    category: 'Writing & Reading Time',
    path: '/tools/word-counter',
    icon: Type,
  },
];

export function HeroVisual({ onNavigate }: HeroVisualProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#DCDDD3] bg-white shadow-[0_8px_28px_-10px_rgba(23,63,53,0.1)] dark:border-[#35463E] dark:bg-[#24332C] dark:shadow-none">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-[#DCDDD3] bg-[#EDE9DF]/45 px-5 py-4 sm:px-6 dark:border-[#35463E] dark:bg-[#17231F]/60">
        <div>
          <p className="font-display text-sm font-semibold text-[#173F35] dark:text-[#F2F0E9]">
            Workspace Directory
          </p>
          <p className="text-xs text-[#56615B] dark:text-[#B9C5BD]">
            Select any utility to open its workspace
          </p>
        </div>
        <a
          href="/tools"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('/tools');
          }}
          className="inline-flex min-h-8 items-center gap-1.5 text-xs font-semibold text-[#173F35] transition-colors hover:text-[#7D5C23] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C49A58] dark:text-[#D9B978] dark:hover:text-[#F2F0E9]"
        >
          <span>All Tools</span>
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </div>

      {/* Hairline-Divided Tool Index (no nested cards) */}
      <ul className="divide-y divide-[#DCDDD3]/80 dark:divide-[#35463E]">
        {SUITE_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.path}>
              <a
                href={item.path}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(item.path);
                }}
                className="group flex w-full items-center justify-between gap-4 px-5 py-3.5 text-left transition-colors duration-150 hover:bg-[#EDE9DF]/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#C49A58] sm:px-6 dark:hover:bg-[#17231F]/70"
              >
                <div className="flex min-w-0 items-center gap-3.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EDE9DF] text-[#173F35] transition-colors duration-150 group-hover:bg-[#173F35] group-hover:text-[#F2F0E9] dark:bg-[#17231F] dark:text-[#D9B978] dark:group-hover:bg-[#315D4D] dark:group-hover:text-[#F2F0E9]">
                    <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-display text-sm font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                      {item.title}
                    </p>
                    <p className="truncate text-xs text-[#56615B] dark:text-[#B9C5BD]">
                      {item.category}
                    </p>
                  </div>
                </div>
                <ArrowRight
                  className="h-4 w-4 shrink-0 text-[#56615B] transition-transform duration-150 group-hover:translate-x-1 group-hover:text-[#173F35] dark:text-[#B9C5BD] dark:group-hover:text-[#D9B978]"
                  aria-hidden="true"
                />
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
