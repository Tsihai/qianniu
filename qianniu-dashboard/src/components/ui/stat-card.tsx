"use client"

import * as React from "react"
import { LucideIcon } from "lucide-react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

// 趋势指示器变体
const trendVariants = cva(
  "inline-flex items-center text-xs font-medium",
  {
    variants: {
      trend: {
        up: "text-green-600 dark:text-green-400",
        down: "text-red-600 dark:text-red-400",
        neutral: "text-muted-foreground",
      },
    },
    defaultVariants: {
      trend: "neutral",
    },
  }
)

// 动画值组件
const AnimatedValue = React.memo<{ value: string | number; className?: string }>(({ value, className }) => {
  const [displayValue, setDisplayValue] = React.useState(value)
  const [isAnimating, setIsAnimating] = React.useState(false)

  React.useEffect(() => {
    if (displayValue !== value) {
      setIsAnimating(true)
      const timer = setTimeout(() => {
        setDisplayValue(value)
        setIsAnimating(false)
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [value, displayValue])

  return (
    <div 
      className={cn(
        "text-2xl font-bold transition-all duration-150",
        isAnimating && "scale-105 text-primary",
        className
      )}
    >
      {displayValue}
    </div>
  )
})

AnimatedValue.displayName = "AnimatedValue"

// 趋势指示器组件
const TrendIndicator = React.memo<{
  change: string
  trend?: "up" | "down" | "neutral"
  className?: string
}>(({ change, trend = "neutral", className }) => {
  const getTrendIcon = () => {
    switch (trend) {
      case "up":
        return "↗"
      case "down":
        return "↘"
      default:
        return "→"
    }
  }

  return (
    <p className={cn(trendVariants({ trend }), className)}>
      <span className="mr-1">{getTrendIcon()}</span>
      {change}
    </p>
  )
})

TrendIndicator.displayName = "TrendIndicator"

// 加载骨架屏组件
const StatCardSkeleton = React.memo(() => (
  <>
    <div className="h-4 bg-muted rounded animate-pulse mb-2" />
    <div className="h-8 bg-muted rounded animate-pulse mb-1" />
    <div className="h-3 bg-muted rounded animate-pulse w-20" />
  </>
))

StatCardSkeleton.displayName = "StatCardSkeleton"

// StatCard 属性接口
export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  value: string | number
  change?: string
  icon: LucideIcon
  loading?: boolean
  trend?: "up" | "down" | "neutral"
  description?: string
  error?: boolean
}

// StatCard 组件
const StatCard = React.memo(
  React.forwardRef<HTMLDivElement, StatCardProps>(
    (
      {
        title,
        value,
        change,
        icon: Icon,
        loading = false,
        trend = "neutral",
        description,
        error = false,
        className,
        ...props
      },
      ref
    ) => {
      return (
        <Card 
          ref={ref} 
          className={cn(
            "transition-all duration-200 hover:shadow-md",
            error && "border-destructive",
            className
          )} 
          {...props}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {title}
            </CardTitle>
            <Icon className={cn(
              "h-4 w-4",
              error ? "text-destructive" : "text-muted-foreground"
            )} />
          </CardHeader>
          <CardContent>
            {loading ? (
              <StatCardSkeleton />
            ) : error ? (
              <>
                <div className="text-2xl font-bold text-destructive">--</div>
                <p className="text-xs text-destructive">
                  数据加载失败
                </p>
              </>
            ) : (
              <>
                <AnimatedValue value={value} />
                {change && (
                  <TrendIndicator change={change} trend={trend} />
                )}
                {description && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {description}
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )
    }
  )
)

StatCard.displayName = "StatCard"

export { StatCard, StatCardSkeleton, AnimatedValue, TrendIndicator, trendVariants }