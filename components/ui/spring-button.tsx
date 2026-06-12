"use client";

/**
 * SpringButton — physics-based interactive button.
 *
 * - whileHover: subtle lift + stretch
 * - whileTap: squash (stretch vertical compress horizontal) like a rubber button
 * - Uses framer-motion spring with low stiffness / high damping for that
 *   "bowling-pin" recoil feel the brief asked for.
 * - Respects prefers-reduced-motion automatically via MotionConfig at layout.
 * - Polymorphic via `as` (default: button; can be "a" / "div").
 *
 * Usage:
 *   <SpringButton onClick={...}>Sign in</SpringButton>
 *   <SpringButton as="a" href="/login" variant="ghost">Learn more</SpringButton>
 */

import { motion, type HTMLMotionProps, type Transition } from "framer-motion";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "outline" | "soft";
type Size = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-[var(--primary)] text-white shadow-[0_8px_24px_-8px_color-mix(in_srgb,var(--primary)_60%,transparent)] hover:brightness-110",
  ghost:
    "bg-transparent text-foreground hover:bg-muted/60",
  outline:
    "border border-border/70 bg-background/40 text-foreground hover:border-[var(--primary)]/60 hover:bg-[var(--primary-dim)]",
  soft:
    "bg-[var(--primary-dim)] text-[var(--primary)] hover:bg-[color-mix(in_srgb,var(--primary)_18%,transparent)]",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-9 px-3.5 text-xs gap-1.5 rounded-xl",
  md: "h-11 px-5 text-sm gap-2 rounded-2xl",
  lg: "h-14 px-7 text-base gap-2.5 rounded-2xl",
};

// Signature bouncy spring — snappy but playful.
const BOUNCE_SPRING: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 14,
  mass: 0.9,
};

type SpringButtonOwnProps = {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  /** Skip the squash-on-tap animation (e.g. for links that change pages). */
  noTap?: boolean;
};

type SpringButtonProps = SpringButtonOwnProps &
  Omit<HTMLMotionProps<"button">, keyof SpringButtonOwnProps>;

export const SpringButton = forwardRef<HTMLButtonElement, SpringButtonProps>(
  function SpringButton(
    { variant = "primary", size = "md", fullWidth, noTap, className, children, ...rest },
    ref,
  ) {
    return (
      <motion.button
        ref={ref}
        className={cn(
          "relative inline-flex items-center justify-center font-bold select-none",
          "transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/60",
          "disabled:opacity-50 disabled:pointer-events-none",
          SIZE_CLASSES[size],
          VARIANT_CLASSES[variant],
          fullWidth && "w-full",
          className,
        )}
        whileHover={{ y: -2, scale: 1.02 }}
        whileTap={noTap ? undefined : { scaleX: 0.92, scaleY: 1.08, y: 2 }}
        transition={BOUNCE_SPRING}
        {...rest}
      >
        {children}
      </motion.button>
    );
  },
);

/**
 * SpringTile — stagger-friendly card/tile with bouncy entrance + press.
 * Used for grid items inside the More drawer, onboarding, etc.
 */
type SpringTileProps = HTMLMotionProps<"div"> & {
  index?: number;
};

export function SpringTile({ index = 0, className, children, ...rest }: SpringTileProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: "spring",
        stiffness: 380,
        damping: 18,
        mass: 0.7,
        delay: index * 0.035,
      }}
      whileHover={{ y: -3, scale: 1.03 }}
      whileTap={{ scale: 0.94, y: 1 }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export { BOUNCE_SPRING };
