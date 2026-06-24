import { cn } from "@/lib/utils";

interface BrandMarkProps {
  className?: string;
}

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <div
      className={cn(
        "relative flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-brand-900 via-brand-800 to-brand-500 text-white shadow-[0_10px_24px_rgba(71,48,155,0.28)]",
        className
      )}
      aria-hidden="true"
    >
      <svg className="h-[62%] w-[62%]" viewBox="0 0 96 96" fill="none">
        <path d="M28 24h14v38h28v13H28V24Z" fill="currentColor" />
        <path d="M58 22c13 12 21 25 21 38 0 11-8 19-20 19-11 0-19-8-19-19 0-13 7-26 18-38Z" fill="currentColor" fillOpacity=".18" />
        <circle cx="65" cy="54" r="12" fill="currentColor" />
      </svg>
    </div>
  );
}
