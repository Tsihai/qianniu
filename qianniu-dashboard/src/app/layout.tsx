/**
 * 千牛客服系统 - 根布局组件
 * 
 * @description 应用程序的根布局，提供全局主题、错误边界、上下文提供者和基础布局结构
 * @author qianniu-dashboard
 * @created 2025-01-10
 * @updated 2025-01-10
 * @version 1.0.0
 * 
 * 功能特性：
 * - 全局主题管理（深色/浅色模式）
 * - 错误边界处理
 * - 应用状态管理
 * - 通知系统集成
 * - 响应式侧边栏和头部导航
 * 
 * 技术栈：
 * - Next.js 15 App Router
 * - React 19
 * - TypeScript
 * - Tailwind CSS
 * - Next Themes
 */

import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

import { ThemeProvider } from "@/components/theme-provider"
import { ErrorBoundary } from "@/components/error-boundary"
import { AppProvider } from "@/contexts/app-context"
import { NotificationProvider } from "@/contexts/notification-context"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "千牛客服自动化系统",
  description: "智能客服自动化管理平台",
}

// Next.js 15 兼容的布局组件Props类型定义
interface RootLayoutProps {
  children: React.ReactNode
  params: Promise<Record<string, string>>
}

/**
 * 根布局组件
 * 
 * @description 提供应用程序的基础布局结构和全局功能
 * @param props - Next.js 15布局组件属性
 * @returns 根布局JSX元素
 */
export default async function RootLayout(props: RootLayoutProps) {
  const { children } = props
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={inter.className}>
        <ErrorBoundary>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <AppProvider>
              <NotificationProvider>
                <div className="flex h-screen bg-background">
                  <Sidebar />
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-auto p-6">
                      {children}
                    </main>
                  </div>
                </div>
              </NotificationProvider>
            </AppProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}