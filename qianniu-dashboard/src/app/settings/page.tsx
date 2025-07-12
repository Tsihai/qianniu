/**
 * 千牛客服系统 - 系统设置页面组件
 * 
 * @description 系统设置页面，配置系统参数、连接设置、通知设置和安全设置
 * @author qianniu-dashboard
 * @created 2025-01-10
 * @updated 2025-01-10
 * @version 1.0.0
 * 
 * 功能特性：
 * - WebSocket连接配置
 * - 系统通知设置
 * - 安全参数配置
 * - 用户权限管理
 * - 设置保存和恢复
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
import { Save, RefreshCw, Database, Bell, Shield, Users } from "lucide-react"

// Next.js 15 兼容的页面组件Props类型定义
interface SettingsPageProps {
  params: Promise<Record<string, string>>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

/**
 * 系统设置页面组件
 * 
 * @description 配置系统参数和管理用户权限
 * @param props - Next.js 15页面组件属性
 * @returns 系统设置页面JSX元素
 */
export default async function SettingsPage(_props: SettingsPageProps) {
  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">系统设置</h1>
          <p className="text-muted-foreground">
            配置系统参数和管理用户权限
          </p>
        </div>
        <Button>
          <Save className="mr-2 h-4 w-4" />
          保存设置
        </Button>
      </div>

      {/* 设置分类 */}
      <div className="grid gap-6">
        {/* 连接设置 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Database className="mr-2 h-5 w-5" />
              连接设置
            </CardTitle>
            <CardDescription>
              配置千牛服务和数据库连接参数
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">WebSocket 服务地址</label>
                <div className="flex space-x-2">
                  <input 
                    type="text" 
                    className="flex-1 px-3 py-2 border border-input rounded-md text-sm"
                    defaultValue="ws://localhost:8080/ws"
                    placeholder="输入 WebSocket 地址"
                  />
                  <Button size="sm" variant="outline">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  当前状态: <span className="text-green-600">已连接</span>
                </p>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">连接超时时间 (秒)</label>
                <input 
                  type="number" 
                  className="w-full px-3 py-2 border border-input rounded-md text-sm"
                  defaultValue="30"
                  placeholder="输入超时时间"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">重连间隔 (秒)</label>
                <input 
                  type="number" 
                  className="w-full px-3 py-2 border border-input rounded-md text-sm"
                  defaultValue="5"
                  placeholder="输入重连间隔"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">最大重连次数</label>
                <input 
                  type="number" 
                  className="w-full px-3 py-2 border border-input rounded-md text-sm"
                  defaultValue="3"
                  placeholder="输入最大重连次数"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 通知设置 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Bell className="mr-2 h-5 w-5" />
              通知设置
            </CardTitle>
            <CardDescription>
              配置系统通知和提醒功能
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">新消息通知</label>
                  <p className="text-xs text-muted-foreground">收到新客户消息时发送通知</p>
                </div>
                <Button variant="outline" size="sm">
                  启用
                </Button>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">系统异常通知</label>
                  <p className="text-xs text-muted-foreground">系统出现异常时发送警告通知</p>
                </div>
                <Button variant="outline" size="sm">
                  启用
                </Button>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">规则触发通知</label>
                  <p className="text-xs text-muted-foreground">自动化规则触发时发送通知</p>
                </div>
                <Button variant="outline" size="sm">
                  禁用
                </Button>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">通知邮箱</label>
                <input 
                  type="email" 
                  className="w-full px-3 py-2 border border-input rounded-md text-sm"
                  defaultValue="admin@company.com"
                  placeholder="输入通知邮箱"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 安全设置 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="mr-2 h-5 w-5" />
              安全设置
            </CardTitle>
            <CardDescription>
              配置系统安全和访问控制
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">启用访问日志</label>
                  <p className="text-xs text-muted-foreground">记录所有用户访问和操作日志</p>
                </div>
                <Button variant="outline" size="sm">
                  启用
                </Button>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">IP 白名单</label>
                  <p className="text-xs text-muted-foreground">只允许白名单内的 IP 访问系统</p>
                </div>
                <Button variant="outline" size="sm">
                  禁用
                </Button>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">会话超时时间 (分钟)</label>
                <input 
                  type="number" 
                  className="w-full px-3 py-2 border border-input rounded-md text-sm"
                  defaultValue="60"
                  placeholder="输入会话超时时间"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">API 访问密钥</label>
                <div className="flex space-x-2">
                  <input 
                    type="password" 
                    className="flex-1 px-3 py-2 border border-input rounded-md text-sm"
                    defaultValue="sk-1234567890abcdef"
                    placeholder="API 密钥"
                  />
                  <Button size="sm" variant="outline">
                    重新生成
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 用户管理 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="mr-2 h-5 w-5" />
              用户管理
            </CardTitle>
            <CardDescription>
              管理系统用户和权限分配
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">当前用户数量</span>
                <span className="text-sm">5 个用户</span>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <span className="text-sm font-medium">管理员</span>
                    <p className="text-xs text-muted-foreground">admin@company.com</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-red-100 text-red-800">
                      超级管理员
                    </span>
                    <Button size="sm" variant="outline">
                      编辑
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <span className="text-sm font-medium">客服主管</span>
                    <p className="text-xs text-muted-foreground">supervisor@company.com</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                      管理员
                    </span>
                    <Button size="sm" variant="outline">
                      编辑
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <span className="text-sm font-medium">客服小王</span>
                    <p className="text-xs text-muted-foreground">wang@company.com</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                      普通用户
                    </span>
                    <Button size="sm" variant="outline">
                      编辑
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="pt-4">
                <Button variant="outline" className="w-full">
                  添加新用户
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}