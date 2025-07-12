/**
 * 千牛客服系统 - 主页面组件
 * 
 * @description 系统主页面，展示实时监控数据、统计信息和快速操作入口
 * @author qianniu-dashboard
 * @created 2025-01-10
 * @updated 2025-01-10
 * @version 1.0.0
 * 
 * 功能特性：
 * - 实时监控数据展示
 * - 关键指标统计卡片
 * - 系统活动流展示
 * - 快速操作入口
 * 
 * 技术栈：
 * - Next.js 15 App Router
 * - React 19
 * - TypeScript
 * - Tailwind CSS
 * - Lucide React Icons
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Activity, MessageSquare, Users, TrendingUp } from "lucide-react"

// Next.js 15 兼容的页面组件Props类型定义
interface HomePageProps {
  params: Promise<Record<string, string>>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

/**
 * 主页面组件
 * 
 * @description 展示千牛客服系统的实时监控数据和关键指标
 * @param props - Next.js 15页面组件属性
 * @returns 主页面JSX元素
 */
export default async function HomePage(_props: HomePageProps) {
  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">实时监控</h1>
        <p className="text-muted-foreground">
          监控千牛客服系统的实时状态和关键指标
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              在线客服
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">
              +2 较昨日
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              今日消息
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,234</div>
            <p className="text-xs text-muted-foreground">
              +15% 较昨日
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              响应时间
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2.3s</div>
            <p className="text-xs text-muted-foreground">
              -0.5s 较昨日
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              自动化率
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">78%</div>
            <p className="text-xs text-muted-foreground">
              +5% 较昨日
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 主要内容区域 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>实时活动</CardTitle>
            <CardDescription>
              系统实时活动和消息流
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">客服小王接收新消息</p>
                  <p className="text-xs text-muted-foreground">2分钟前</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">自动回复规则触发</p>
                  <p className="text-xs text-muted-foreground">5分钟前</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">客服小李上线</p>
                  <p className="text-xs text-muted-foreground">10分钟前</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>快速操作</CardTitle>
            <CardDescription>
              常用功能快速入口
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full" variant="outline">
              查看待处理消息
            </Button>
            <Button className="w-full" variant="outline">
              配置自动回复
            </Button>
            <Button className="w-full" variant="outline">
              导出数据报告
            </Button>
            <Button className="w-full" variant="outline">
              系统设置
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}