"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    config: Record<string, { label?: string; color?: string }>
  }
>(({ className, children, config, ...props }, ref) => {
  const cssVars = React.useMemo(() => {
    const vars: Record<string, string> = {}
    Object.entries(config).forEach(([key, value]) => {
      if (value.color) {
        vars[`--color-${key}`] = value.color
      }
    })
    return vars
  }, [config])

  return (
    <div
      ref={ref}
      className={cn("flex aspect-video justify-center text-xs", className)}
      style={cssVars as React.CSSProperties}
      {...props}
    >
      {children}
    </div>
  )
})
ChartContainer.displayName = "ChartContainer"

function ChartTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border border-border bg-card p-2 shadow-xl">
      {label && <p className="mb-1 text-xs font-medium text-foreground">{label}</p>}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium text-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

function ChartTooltip({ content, ...props }: { content?: React.ReactElement } & Record<string, unknown>) {
  return content ? React.cloneElement(content, props) : null
}

export { ChartContainer, ChartTooltip, ChartTooltipContent }
