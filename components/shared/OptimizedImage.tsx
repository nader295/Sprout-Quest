"use client";

import Image, { ImageProps } from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "./Skeleton";

interface OptimizedImageProps extends Omit<ImageProps, "onLoad"> {
  fallbackSrc?: string;
  withSkeleton?: boolean;
}

/**
 * Universal blur placeholder generated for high-performance lazy loading fallback
 * A tiny 1x1 base64 transparent/grey pixel.
 */
const BLUR_PLACEHOLDER = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

export function OptimizedImage({
  src,
  alt,
  className,
  fallbackSrc = "/default-avatar.png", // Assume a sensible global fallback
  withSkeleton = true,
  ...props
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);

  // If source explicitly broken or undefined
  const finalSrc = error || !src ? fallbackSrc : src;

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* Structural skeleton placeholder while loading over network */}
      {withSkeleton && !isLoaded && !error && (
        <Skeleton 
          variant="rectangular" 
          animate="shimmer" 
          className="absolute inset-0 z-0 h-full w-full rounded-inherit" 
        />
      )}
      
      <Image
        src={finalSrc}
        alt={alt || "Image"}
        loading="lazy"
        placeholder="blur"
        blurDataURL={BLUR_PLACEHOLDER}
        onLoad={() => setIsLoaded(true)}
        onError={() => setError(true)}
        className={cn(
          "h-full w-full object-cover transition-[scale,filter] duration-500 ease-smooth",
          isLoaded || error ? "scale-100 blur-0" : "scale-[1.02] blur-sm",
          className
        )}
        {...props}
      />
    </div>
  );
}
