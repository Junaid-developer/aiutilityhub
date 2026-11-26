import {
  ArrowRight,
  Braces,
  Eraser,
  FileOutput,
  FilePlus2,
  FileText,
  Image as ImageIcon,
  Palette,
  QrCode,
  Scan,
  Type,
} from 'lucide-react';
import { RoutePath, ToolDefinition } from '../types/navigation';
import { ResponsiveToolIcon } from './ResponsiveToolIcon';

interface ToolCardProps {
  tool: ToolDefinition;
  onNavigate: (path: RoutePath) => void;
  priority?: boolean;
}

const TOOL_ICONS = {
  Image: ImageIcon,
  QrCode: QrCode,
  FileText: FileText,
  Braces: Braces,
  Scan: Scan,
  Type: Type,
  FileOutput: FileOutput,
  FilePlus2: FilePlus2,
  Eraser: Eraser,
  Palette: Palette,
};

export function ToolIcon({
  iconName,
  className = 'h-5 w-5',
}: {
  iconName: ToolDefinition['iconName'];
  className?: string;
}) {
  const Icon = TOOL_ICONS[iconName];
  return <Icon className={className} strokeWidth={1.75} aria-hidden="true" />;
}

export function ToolCard({
  tool,
  onNavigate,
  priority = false,
}: ToolCardProps) {
  const targetPath: RoutePath = `/tools/${tool.id}`;

  return (
    <article className="group flex h-full flex-col justify-between rounded-[18px] border border-[#DCDDD3] bg-white p-6 shadow-[0_2px_10px_-3px_rgba(23,63,53,0.06)] transition-[border-color,transform,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:border-[#C49A58] hover:shadow-[0_12px_28px_-10px_rgba(23,63,53,0.14)] sm:p-7 dark:border-[#35463E] dark:bg-[#24332C] dark:shadow-[0_2px_10px_-3px_rgba(0,0,0,0.24)] dark:hover:border-[#D9B978] dark:hover:shadow-[0_14px_28px_-10px_rgba(0,0,0,0.42)]">
      <div>
        <div className="aspect-square h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-[#DCDDD3]/70 bg-[#E3EAE4] sm:h-12 sm:w-12 dark:border-[#35463E] dark:bg-[#E3EAE4]">
          <ResponsiveToolIcon toolId={tool.id} priority={priority} />
        </div>

        <h3 className="mt-5 font-display text-lg font-semibold tracking-tight text-[#252B28] dark:text-[#F2F0E9]">
          <a
            href={targetPath}
            onClick={(e) => {
              e.preventDefault();
              onNavigate(targetPath);
            }}
            className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C49A58]"
          >
            {tool.name}
          </a>
        </h3>

        <p className="mt-2 text-sm leading-relaxed text-[#56615B] dark:text-[#B9C5BD]">
          {tool.shortDescription}
        </p>
      </div>

      <div className="mt-6 pt-2">
        <a
          href={targetPath}
          onClick={(e) => {
            e.preventDefault();
            onNavigate(targetPath);
          }}
          className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#173F35] transition-colors duration-150 group-hover:text-[#7D5C23] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C49A58] dark:text-[#D9B978] dark:group-hover:text-[#F2F0E9]"
        >
          <span>Explore Tool</span>
          <ArrowRight
            className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
            aria-hidden="true"
          />
        </a>
      </div>
    </article>
  );
}
