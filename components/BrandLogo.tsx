interface BrandLogoProps {
  className?: string;
}

export function BrandLogo({ className = 'h-8 w-8' }: BrandLogoProps) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="2"
        y="2"
        width="32"
        height="32"
        rx="8"
        className="fill-[#173F35] dark:fill-[#315D4D]"
      />
      <rect
        x="8.5"
        y="8.5"
        width="8"
        height="8"
        rx="2"
        className="fill-[#EDE9DF] dark:fill-[#F2F0E9]"
      />
      <rect
        x="19.5"
        y="8.5"
        width="8"
        height="8"
        rx="2"
        className="fill-[#C49A58] dark:fill-[#D9B978]"
      />
      <rect
        x="8.5"
        y="19.5"
        width="8"
        height="8"
        rx="2"
        className="fill-[#EDE9DF]/70 dark:fill-[#F2F0E9]/70"
      />
      <path
        d="M19.5 23.5H27.5M23.5 19.5V27.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        className="text-[#EDE9DF] dark:text-[#F2F0E9]"
      />
    </svg>
  );
}
