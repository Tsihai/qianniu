/**
 * 千牛客服系统 - Dashboard布局组件
 * 
 * @description Dashboard页面专用布局，提供Suspense、ErrorBoundary和优化的加载状态
 * @author qianniu-dashboard
 * @created 2025-01-10
 * @updated 2025-01-10
 * @version 1.0.0
 * 
 * 功能特性：
 * - React Suspense集成用于异步组件加载
 * - 错误边界处理Dashboard特定错误
 * - 加载状态和骨架屏
 * - 性能监控集成
 * - 实时数据流管理
 * 
 * 技术栈：
 * - Next.js 15 App Router
 * - React 19 Suspense
 * - TypeScript
 * - Tailwind CSS
 */

import { Suspense } from 'react'
import { ErrorBoundary } from '@/components/error-boundary'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Activity, BarChart3, Wifi, Users } from 'lucide-react'

// Next.js 15 兼容的布局组件Props类型定义
interface DashboardLayoutProps {
  children: React.ReactNode
  params: Promise<Record<string, string>>
}

/**
 * Dashboard加载骨架屏组件
 * 在Suspense fallback中显示，提供良好的用户体验
 */
function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto p-6 space-y-6">
        {/* 页面标题骨架 */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-6 w-24" />
        </div>

        {/* WebSocket状态卡片骨架 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5 animate-pulse" />
              <Skeleton className="h-6 w-32" />
            </CardTitle>
            <CardDescription>
              <Skeleton className="h-4 w-48" />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-6 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 统计卡片网格骨架 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  <Skeleton className="h-4 w-20" />
                </CardTitle>
                <div className="h-4 w-4">
                  {i === 0 && <Users className="animate-pulse" />}
                  {i === 1 && <Activity className="animate-pulse" />}
                  {i === 2 && <BarChart3 className="animate-pulse" />}
                  {i === 3 && <Wifi className="animate-pulse" />}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 图表区域骨架 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 animate-pulse" />
                  <Skeleton className="h-6 w-32" />
                </CardTitle>
                <CardDescription>
                  <Skeleton className="h-4 w-48" />
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[300px] w-full" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 性能监控模块骨架 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 animate-pulse" />
              <Skeleton className="h-6 w-32" />
            </CardTitle>
            <CardDescription>
              <Skeleton className="h-4 w-48" />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 加载指示器 */}
        <div className="text-center text-sm text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
          <Activity className="h-4 w-4 animate-spin" />
          <span>正在加载实时监控数据...</span>
        </div>
      </div>
    </div>
  )
}

/**
 * Dashboard错误回退组件
 * 当Dashboard页面发生错误时显示的专用错误界面
 */
function DashboardErrorFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto p-6">
        <Card className="max-w-md mx-auto mt-20">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 text-destructive">
              <Activity className="h-full w-full" />
            </div>
            <CardTitle className="text-xl">监控仪表板暂时不可用</CardTitle>
            <CardDescription>
              实时监控系统遇到了问题，请稍后重试或联系技术支持。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                可能的原因：
              </p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• WebSocket连接中断</li>
                <li>• 数据源服务异常</li>
                <li>• 网络连接问题</li>
              </ul>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => window.location.reload()}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors"
              >
                重新加载
              </button>
              <button 
                onClick={() => window.history.back()}
                className="flex-1 px-4 py-2 border border-input bg-background rounded-md text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                返回上页
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/**
 * Dashboard布局组件
 * 
 * @description 为Dashboard页面提供专用布局，集成Suspense和ErrorBoundary
 * @param props - Next.js 15布局组件属性
 * @returns Dashboard布局JSX元素
 */
export default async function DashboardLayout(props: DashboardLayoutProps) {
  const { children } = props
  
  return (
    <ErrorBoundary fallback={<DashboardErrorFallback />}>
      <Suspense fallback={<DashboardSkeleton />}>
        <div className="dashboard-layout">
          {children}
        </div>
      </Suspense>
    </ErrorBoundary>
  )
}

/**
 * 布局元数据
 * 为Dashboard页面提供SEO和性能优化
 */
export const metadata = {
  title: '实时监控仪表板 - 千牛客服系统',
  description: '千牛客服系统实时数据监控与分析仪表板',
  keywords: '实时监控,仪表板,客服系统,数据分析',
  robots: 'noindex, nofollow', // Dashboard页面通常不需要搜索引擎索引
}

/**
 * 布局配置
 * 启用流式渲染和并发特性
 */
export const dynamic = 'force-dynamic' // 强制动态渲染
export const revalidate = 0 // 禁用静态生成缓存
export const fetchCache = 'force-no-store' // 禁用fetch缓存