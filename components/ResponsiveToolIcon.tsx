import { ToolSlug } from '../types/navigation';

interface ResponsiveToolIconProps {
  toolId: ToolSlug;
  sizes?: string;
  priority?: boolean;
  className?: string;
}

export function ResponsiveToolIcon({
  toolId,
  sizes = '(max-width: 639px) 44px, 48px',
  priority = false,
  className = 'h-full w-full object-cover',
}: ResponsiveToolIconProps) {
  const basePath = `/tool-icons/${toolId}`;

  return (
    <picture className="block h-full w-full">
      <source
        type="image/avif"
        srcSet={`${basePath}-48.avif 48w, ${basePath}-96.avif 96w, ${basePath}-144.avif 144w`}
        sizes={sizes}
      />
      <source
        type="image/webp"
        srcSet={`${basePath}-48.webp 48w, ${basePath}-96.webp 96w, ${basePath}-144.webp 144w`}
        sizes={sizes}
      />
      <img
        src={`${basePath}-96.png`}
        srcSet={`${basePath}-48.png 48w, ${basePath}-96.png 96w, ${basePath}-144.png 144w`}
        sizes={sizes}
        width={48}
        height={48}
        alt=""
        aria-hidden="true"
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        className={className}
      />
    </picture>
  );
}
