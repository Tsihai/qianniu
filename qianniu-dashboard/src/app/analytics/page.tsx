'use client'

/**
 * 千牛客服系统 - 数据分析页面组件
 * 
 * @description 数据分析页面，展示客服系统的详细数据分析和性能报告
 * @author qianniu-dashboard
 * @created 2025-01-10
 * @updated 2025-01-10
 * @version 1.0.0
 * 
 * 功能特性：
 * - 关键指标统计展示
 * - 数据趋势图表分析
 * - 消息类型分布统计
 * - 客服效率分析
 * - 数据报告导出
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
import { Chart } from "@/components/ui/chart"
import { StatCard } from "@/components/ui/stat-card"
import { TrendingUp, Download, Calendar, MessageSquare, Clock, Star } from "lucide-react"
import { useEffect, useState } from "react"

/**
 * 数据分析页面组件
 * 
 * @description 展示客服系统的详细数据分析和性能报告
 * @returns 数据分析页面JSX元素
 */
export default function AnalyticsPage() {
  // 模拟图表数据
  const messageVolumeData = [
    { date: '1月4日', messages: 1200 },
    { date: '1月5日', messages: 1350 },
    { date: '1月6日', messages: 1100 },
    { date: '1月7日', messages: 1450 },
    { date: '1月8日', messages: 1600 },
    { date: '1月9日', messages: 1380 },
    { date: '1月10日', messages: 1520 },
  ]

  const responseTimeData = [
    { time: '00:00', avgTime: 2.1 },
    { time: '04:00', avgTime: 1.8 },
    { time: '08:00', avgTime: 2.5 },
    { time: '12:00', avgTime: 3.2 },
    { time: '16:00', avgTime: 2.8 },
    { time: '20:00', avgTime: 2.3 },
  ]

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">数据分析</h1>
          <p className="text-muted-foreground">
            查看客服系统的详细数据分析和性能报告
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline">
            <Calendar className="mr-2 h-4 w-4" />
            选择时间范围
          </Button>
          <Button>
            <Download className="mr-2 h-4 w-4" />
            导出报告
          </Button>
        </div>
      </div>

      {/* 关键指标 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="总消息量"
          value="8,432"
          change="+12.5% 较上周"
          icon={MessageSquare}
          trend="up"
        />
        
        <StatCard
          title="自动化处理率"
          value="76.2%"
          change="+3.1% 较上周"
          icon={TrendingUp}
          trend="up"
        />
        
        <StatCard
          title="平均响应时间"
          value="2.1s"
          change="-0.3s 较上周"
          icon={Clock}
          trend="down"
        />
        
        <StatCard
          title="客户满意度"
          value="4.8/5"
          change="+0.2 较上周"
          icon={Star}
          trend="up"
        />
      </div>

      {/* 图表区域 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>消息量趋势</CardTitle>
            <CardDescription>
              过去7天的消息处理量变化
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Chart
              type="bar"
              data={messageVolumeData}
              xKey="date"
              yKey="messages"
              height={300}
              showGrid
              showTooltip
              config={{
                messages: {
                  label: '消息量',
                  color: 'hsl(var(--primary))'
                }
              }}
            />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>响应时间分布</CardTitle>
            <CardDescription>
              不同时间段的响应时间统计
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Chart
              type="line"
              data={responseTimeData}
              xKey="time"
              yKey="avgTime"
              height={300}
              showGrid
              showTooltip
              config={{
                avgTime: {
                  label: '平均响应时间(秒)',
                  color: 'hsl(var(--chart-2))'
                }
              }}
            />
          </CardContent>
        </Card>
      </div>

      {/* 详细统计 */}
      <div className="grid gap-4 md:grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>详细数据统计</CardTitle>
            <CardDescription>
              各项指标的详细分析数据
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* 消息类型分析 */}
              <div>
                <h4 className="text-sm font-medium mb-3">消息类型分析</h4>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">咨询类</span>
                      <span className="text-sm font-medium">45%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div className="bg-blue-600 h-2 rounded-full" style={{width: '45%'}}></div>
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">投诉类</span>
                      <span className="text-sm font-medium">15%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div className="bg-red-600 h-2 rounded-full" style={{width: '15%'}}></div>
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">售后类</span>
                      <span className="text-sm font-medium">40%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div className="bg-green-600 h-2 rounded-full" style={{width: '40%'}}></div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* 客服效率分析 */}
              <div>
                <h4 className="text-sm font-medium mb-3">客服效率分析</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <span className="text-sm font-medium">客服小王</span>
                      <p className="text-xs text-muted-foreground">处理消息 156 条</p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium">平均 1.8s</span>
                      <p className="text-xs text-muted-foreground">响应时间</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <span className="text-sm font-medium">客服小李</span>
                      <p className="text-xs text-muted-foreground">处理消息 142 条</p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium">平均 2.1s</span>
                      <p className="text-xs text-muted-foreground">响应时间</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <span className="text-sm font-medium">客服小张</span>
                      <p className="text-xs text-muted-foreground">处理消息 128 条</p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium">平均 2.5s</span>
                      <p className="text-xs text-muted-foreground">响应时间</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}