/**
 * 千牛客服系统 - Dashboard加载页面
 * 
 * @description Dashboard页面专用加载组件，提供优雅的加载状态
 * @author qianniu-dashboard
 * @created 2025-01-10
 * @updated 2025-01-10
 * @version 1.0.0
 * 
 * 功能特性：
 * - 骨架屏加载效果
 * - 实时数据加载指示
 * - 响应式布局
 * - 动画效果
 * 
 * 技术栈：
 * - Next.js 15 App Router
 * - React 19
 * - TypeScript
 * - Tailwind CSS
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Activity, BarChart3, Wifi, Users, MessageSquare, Clock, Zap } from 'lucide-react'

/**
 * Dashboard加载页面组件
 * 
 * @description 在Dashboard页面加载时显示的骨架屏
 * @returns Dashboard加载页面JSX元素
 */
export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto p-6 space-y-6">
        {/* 页面标题骨架 */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 animate-spin text-blue-500" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>

        {/* WebSocket状态卡片骨架 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5 animate-pulse text-slate-400" />
              <Skeleton className="h-6 w-40" />
            </CardTitle>
            <CardDescription>
              <Skeleton className="h-4 w-56" />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              <Skeleton className="h-4 w-32" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Skeleton className="h-3 w-3 rounded-full" />
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 统计卡片网格骨架 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: Users, label: '在线客服' },
            { icon: MessageSquare, label: '消息总数' },
            { icon: Clock, label: '响应时间' },
            { icon: Zap, label: '自动化率' }
          ].map((item, i) => (
            <Card key={i} className="relative overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  <Skeleton className="h-4 w-20" />
                </CardTitle>
                <item.icon className="h-4 w-4 animate-pulse text-slate-400" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Skeleton className="h-8 w-16" />
                  <div className="flex items-center gap-1">
                    <Skeleton className="h-3 w-3 rounded-full" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                  <Skeleton className="h-3 w-24" />
                </div>
              </CardContent>
              {/* 加载动画效果 */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_2s_infinite] dark:via-slate-800/10" />
            </Card>
          ))}
        </div>

        {/* 图表区域骨架 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[
            { icon: Activity, title: '消息流量趋势', description: '实时消息处理量变化趋势' },
            { icon: Clock, title: '响应时间趋势', description: '平均响应时间变化趋势' }
          ].map((chart, i) => (
            <Card key={i} className="relative overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <chart.icon className="h-5 w-5 animate-pulse text-slate-400" />
                  <Skeleton className="h-6 w-32" />
                </CardTitle>
                <CardDescription>
                  <Skeleton className="h-4 w-48" />
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] relative">
                  {/* 模拟图表骨架 */}
                  <div className="absolute inset-0 flex items-end justify-between px-4 pb-4">
                    {Array.from({ length: 12 }).map((_, j) => (
                      <div
                        key={j}
                        className="bg-slate-200 dark:bg-slate-700 rounded-t animate-pulse"
                        style={{
                          width: '6%',
                          height: `${20 + Math.random() * 60}%`,
                          animationDelay: `${j * 0.1}s`
                        }}
                      />
                    ))}
                  </div>
                  {/* X轴标签骨架 */}
                  <div className="absolute bottom-0 left-0 right-0 flex justify-between px-4">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <Skeleton key={j} className="h-3 w-8" />
                    ))}
                  </div>
                  {/* Y轴标签骨架 */}
                  <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between py-4">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Skeleton key={j} className="h-3 w-8" />
                    ))}
                  </div>
                </div>
              </CardContent>
              {/* 加载动画效果 */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_3s_infinite] dark:via-slate-800/5" />
            </Card>
          ))}
        </div>

        {/* 性能监控模块骨架 */}
        <Card className="relative overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 animate-pulse text-slate-400" />
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
                  <div className="space-y-1">
                    <Skeleton className="h-2 w-full" />
                    <Skeleton className="h-2 w-3/4" />
                    <Skeleton className="h-2 w-1/2" />
                  </div>
                  <Skeleton className="h-16 w-full rounded" />
                </div>
              ))}
            </div>
          </CardContent>
          {/* 加载动画效果 */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_4s_infinite] dark:via-slate-800/5" />
        </Card>

        {/* 系统性能和错误监控骨架 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 系统性能图表骨架 */}
          <Card className="lg:col-span-2 relative overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 animate-pulse text-slate-400" />
                <Skeleton className="h-6 w-32" />
              </CardTitle>
              <CardDescription>
                <Skeleton className="h-4 w-48" />
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] relative">
                {/* 模拟柱状图骨架 */}
                <div className="absolute inset-0 flex items-end justify-between px-4 pb-8">
                  {Array.from({ length: 10 }).map((_, j) => (
                    <div
                      key={j}
                      className="bg-slate-200 dark:bg-slate-700 rounded animate-pulse"
                      style={{
                        width: '8%',
                        height: `${30 + Math.random() * 50}%`,
                        animationDelay: `${j * 0.15}s`
                      }}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
            {/* 加载动画效果 */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_3.5s_infinite] dark:via-slate-800/5" />
          </Card>

          {/* 关键指标卡片骨架 */}
          <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i} className="relative overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    <Skeleton className="h-4 w-16" />
                  </CardTitle>
                  <Activity className="h-4 w-4 animate-pulse text-slate-400" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-14" />
                    <div className="flex items-center gap-1">
                      <Skeleton className="h-3 w-3 rounded-full" />
                      <Skeleton className="h-4 w-10" />
                    </div>
                    <Skeleton className="h-3 w-20" />
                  </div>
                </CardContent>
                {/* 加载动画效果 */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_2.5s_infinite] dark:via-slate-800/10" />
              </Card>
            ))}
          </div>
        </div>

        {/* 加载指示器 */}
        <div className="text-center text-sm text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
          <Activity className="h-4 w-4 animate-spin text-blue-500" />
          <span>正在加载实时监控数据...</span>
        </div>
      </div>
    </div>
  )
}

/**
 * 自定义CSS动画
 * 添加到全局样式中以支持shimmer效果
 */
// @keyframes shimmer {
//   0% {
//     transform: translateX(-100%);
//   }
//   100% {
//     transform: translateX(100%);
//   }
// }