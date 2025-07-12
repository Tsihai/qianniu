"use client"

import React from 'react'
import { Loader2, Wifi, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'

// 加载状态类型
export type LoadingVariant = 'spinner' | 'dots' | 'pulse' | 'skeleton'
export type LoadingSize = 'sm' | 'md' | 'lg' | 'xl'

interface LoadingProps {
  variant?: LoadingVariant
  size?: LoadingSize
  className?: string
  text?: string
  fullScreen?: boolean
}

// 尺寸映射
const sizeMap = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12'
}

/**
 * 通用加载组件
 */
export function Loading({ 
  variant = 'spinner', 
  size = 'md', 
  className, 
  text,
  fullScreen = false 
}: LoadingProps) {
  const renderLoader = () => {
    switch (variant) {
      case 'spinner':
        return (
          <Loader2 
            className={cn(
              'animate-spin text-primary',
              sizeMap[size],
              className
            )} 
          />
        )
      
      case 'dots':
        return (
          <div className={cn('flex space-x-1', className)}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={cn(
                  'bg-primary rounded-full animate-pulse',
                  size === 'sm' && 'h-1 w-1',
                  size === 'md' && 'h-2 w-2',
                  size === 'lg' && 'h-3 w-3',
                  size === 'xl' && 'h-4 w-4'
                )}
                style={{
                  animationDelay: `${i * 0.2}s`,
                  animationDuration: '1.4s'
                }}
              />
            ))}
          </div>
        )
      
      case 'pulse':
        return (
          <div 
            className={cn(
              'bg-primary rounded-full animate-pulse',
              sizeMap[size],
              className
            )}
          />
        )
      
      case 'skeleton':
        return (
          <div className={cn('space-y-2', className)}>
            <div className="h-4 bg-muted rounded animate-pulse" />
            <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
            <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
          </div>
        )
      
      default:
        return null
    }
  }

  const content = (
    <div className={cn(
      'flex flex-col items-center justify-center gap-2',
      fullScreen && 'min-h-screen'
    )}>
      {renderLoader()}
      {text && (
        <p className={cn(
          'text-muted-foreground',
          size === 'sm' && 'text-xs',
          size === 'md' && 'text-sm',
          size === 'lg' && 'text-base',
          size === 'xl' && 'text-lg'
        )}>
          {text}
        </p>
      )}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
        {content}
      </div>
    )
  }

  return content
}

/**
 * 页面加载组件
 */
export function PageLoading({ text = "加载中..." }: { text?: string }) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loading variant="spinner" size="lg" text={text} />
    </div>
  )
}

/**
 * 按钮加载状态
 */
export function ButtonLoading({ size = 'sm' }: { size?: LoadingSize }) {
  return <Loading variant="spinner" size={size} className="mr-2" />
}

/**
 * 卡片骨架屏
 */
export function CardSkeleton() {
  return (
    <div className="p-6 space-y-4">
      <div className="h-6 bg-muted rounded animate-pulse" />
      <div className="space-y-2">
        <div className="h-4 bg-muted rounded animate-pulse" />
        <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
        <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
      </div>
    </div>
  )
}

/**
 * 表格骨架屏
 */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {/* 表头 */}
      <div className="flex space-x-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-4 bg-muted rounded animate-pulse flex-1" />
        ))}
      </div>
      {/* 表格行 */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex space-x-4">
          {[1, 2, 3, 4].map((j) => (
            <div key={j} className="h-8 bg-muted rounded animate-pulse flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

/**
 * 连接状态指示器
 */
export function ConnectionStatus({ 
  isConnected, 
  className 
}: { 
  isConnected: boolean
  className?: string 
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {isConnected ? (
        <>
          <Wifi className="h-4 w-4 text-green-500" />
          <span className="text-sm text-green-500">已连接</span>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4 text-red-500" />
          <span className="text-sm text-red-500">连接断开</span>
          <Loading variant="spinner" size="sm" />
        </>
      )}
    </div>
  )
}

/**
 * 数据加载状态组件
 */
export function DataLoadingState({
  isLoading,
  error,
  children,
  loadingComponent,
  errorComponent
}: {
  isLoading: boolean
  error?: string | null
  children: React.ReactNode
  loadingComponent?: React.ReactNode
  errorComponent?: React.ReactNode
}) {
  if (isLoading) {
    return loadingComponent || <PageLoading />
  }

  if (error) {
    return errorComponent || (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="text-center">
          <p className="text-destructive mb-2">加载失败</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

/**
 * 延迟加载组件
 * 避免快速加载时的闪烁
 */
export function DelayedLoading({ 
  delay = 200, 
  children, 
  fallback 
}: { 
  delay?: number
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const [showFallback, setShowFallback] = React.useState(true)

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setShowFallback(false)
    }, delay)

    return () => clearTimeout(timer)
  }, [delay])

  if (showFallback) {
    return fallback || <Loading variant="spinner" size="sm" />
  }

  return <>{children}</>
}