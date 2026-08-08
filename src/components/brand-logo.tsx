import Image from "next/image";
import { cn } from "@/lib/utils";

const wordmark = {
  src: "/logos/double-daeng-logo-01-wordmark-web.png",
  width: 1504,
  height: 327
};

const mark = {
  src: "/logos/double-daeng-logo-01-dd-web.png",
  width: 483,
  height: 225
};

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
  variant?: "responsive" | "wordmark" | "mark";
};

export function BrandLogo({
  className,
  priority = false,
  variant = "responsive"
}: BrandLogoProps) {
  if (variant === "mark") {
    return (
      <Image
        src={mark.src}
        alt="Double Daeng"
        width={mark.width}
        height={mark.height}
        priority={priority}
        className={cn("h-9 w-auto", className)}
      />
    );
  }

  if (variant === "wordmark") {
    return (
      <Image
        src={wordmark.src}
        alt="Double Daeng"
        width={wordmark.width}
        height={wordmark.height}
        priority={priority}
        className={cn("h-10 w-auto", className)}
      />
    );
  }

  return (
    <span aria-label="Double Daeng" className={cn("inline-flex", className)}>
      <Image
        src={mark.src}
        alt=""
        width={mark.width}
        height={mark.height}
        priority={priority}
        className="h-9 w-auto sm:hidden"
      />
      <Image
        src={wordmark.src}
        alt=""
        width={wordmark.width}
        height={wordmark.height}
        priority={priority}
        className="hidden h-10 w-auto sm:block"
      />
    </span>
  );
}
