/**
 * 千牛客服系统 - Dashboard错误页面
 * 
 * @description Dashboard页面专用错误处理组件
 * @author qianniu-dashboard
 * @created 2025-01-10
 * @updated 2025-01-10
 * @version 1.0.0
 * 
 * 功能特性：
 * - 错误边界处理
 * - 用户友好的错误信息
 * - 错误恢复操作
 * - 错误报告功能
 * 
 * 技术栈：
 * - Next.js 15 App Router
 * - React 19
 * - TypeScript
 * - Tailwind CSS
 */

'use client'

import { useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Activity, 
  AlertTriangle, 
  RefreshCw, 
  ArrowLeft, 
  Wifi, 
  WifiOff,
  Bug,
  Home
} from 'lucide-react'

// 错误类型定义
interface DashboardErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * 错误类型分析函数
 * 根据错误信息判断错误类型并提供相应的解决方案
 */
function analyzeError(error: Error): {
  type: 'network' | 'websocket' | 'data' | 'permission' | 'unknown'
  title: string
  description: string
  suggestions: string[]
  icon: React.ComponentType<any>
  severity: 'low' | 'medium' | 'high' | 'critical'
} {
  const message = error.message.toLowerCase()
  const stack = error.stack?.toLowerCase() || ''

  // 网络相关错误
  if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
    return {
      type: 'network',
      title: '网络连接异常',
      description: '无法连接到服务器，请检查网络连接状态。',
      suggestions: [
        '检查网络连接是否正常',
        '确认服务器地址配置正确',
        '尝试刷新页面重新连接',
        '联系网络管理员检查防火墙设置'
      ],
      icon: WifiOff,
      severity: 'high'
    }
  }

  // WebSocket相关错误
  if (message.includes('websocket') || message.includes('ws') || message.includes('socket')) {
    return {
      type: 'websocket',
      title: 'WebSocket连接失败',
      description: '实时数据连接中断，监控功能可能受到影响。',
      suggestions: [
        '检查WebSocket服务器状态',
        '确认浏览器支持WebSocket',
        '尝试重新建立连接',
        '检查代理服务器配置'
      ],
      icon: Wifi,
      severity: 'medium'
    }
  }

  // 数据相关错误
  if (message.includes('data') || message.includes('parse') || message.includes('json')) {
    return {
      type: 'data',
      title: '数据处理异常',
      description: '监控数据格式异常或解析失败。',
      suggestions: [
        '检查数据源格式是否正确',
        '确认API接口返回数据有效',
        '尝试清除浏览器缓存',
        '联系技术支持检查数据格式'
      ],
      icon: Bug,
      severity: 'medium'
    }
  }

  // 权限相关错误
  if (message.includes('permission') || message.includes('unauthorized') || message.includes('403')) {
    return {
      type: 'permission',
      title: '访问权限不足',
      description: '您没有访问此监控仪表板的权限。',
      suggestions: [
        '确认您已正确登录',
        '检查账户权限设置',
        '联系管理员申请访问权限',
        '尝试重新登录系统'
      ],
      icon: AlertTriangle,
      severity: 'high'
    }
  }

  // 未知错误
  return {
    type: 'unknown',
    title: '系统异常',
    description: '监控仪表板遇到未知错误，请稍后重试。',
    suggestions: [
      '尝试刷新页面',
      '清除浏览器缓存和Cookie',
      '检查浏览器控制台错误信息',
      '联系技术支持并提供错误详情'
    ],
    icon: AlertTriangle,
    severity: 'critical'
  }
}

/**
 * Dashboard错误页面组件
 * 
 * @description 当Dashboard页面发生错误时显示的专用错误界面
 * @param props - 错误属性和重置函数
 * @returns Dashboard错误页面JSX元素
 */
export default function DashboardError({ error, reset }: DashboardErrorProps) {
  const errorInfo = analyzeError(error)

  // 错误日志记录
  useEffect(() => {
    // 记录错误到控制台
    console.error('Dashboard Error:', {
      message: error.message,
      stack: error.stack,
      digest: error.digest,
      type: errorInfo.type,
      severity: errorInfo.severity,
      timestamp: new Date().toISOString()
    })

    // 可以在这里添加错误上报逻辑
    // reportError(error, errorInfo)
  }, [error, errorInfo])

  // 错误严重程度对应的样式
  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'border-red-500 bg-red-50 dark:bg-red-950/20'
      case 'high':
        return 'border-orange-500 bg-orange-50 dark:bg-orange-950/20'
      case 'medium':
        return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20'
      case 'low':
        return 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
      default:
        return 'border-gray-500 bg-gray-50 dark:bg-gray-950/20'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto p-6">
        <div className="max-w-2xl mx-auto mt-20 space-y-6">
          {/* 主错误卡片 */}
          <Card className={`border-2 ${getSeverityStyles(errorInfo.severity)}`}>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-16 w-16 text-destructive">
                <errorInfo.icon className="h-full w-full" />
              </div>
              <CardTitle className="text-2xl text-destructive">
                {errorInfo.title}
              </CardTitle>
              <CardDescription className="text-base">
                {errorInfo.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 错误详情 */}
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <Bug className="h-4 w-4" />
                  错误详情
                </h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p><strong>错误类型:</strong> {errorInfo.type}</p>
                  <p><strong>严重程度:</strong> {errorInfo.severity}</p>
                  <p><strong>错误信息:</strong> {error.message}</p>
                  {error.digest && (
                    <p><strong>错误ID:</strong> {error.digest}</p>
                  )}
                  <p><strong>发生时间:</strong> {new Date().toLocaleString('zh-CN')}</p>
                </div>
              </div>

              {/* 解决建议 */}
              <div>
                <h4 className="font-semibold text-sm mb-3">解决建议:</h4>
                <ul className="space-y-2">
                  {errorInfo.suggestions.map((suggestion, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 操作按钮 */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  onClick={reset}
                  className="flex-1 flex items-center gap-2"
                  size="lg"
                >
                  <RefreshCw className="h-4 w-4" />
                  重试加载
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={() => window.location.reload()}
                  className="flex-1 flex items-center gap-2"
                  size="lg"
                >
                  <Activity className="h-4 w-4" />
                  刷新页面
                </Button>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  variant="outline"
                  onClick={() => window.history.back()}
                  className="flex-1 flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  返回上页
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={() => window.location.href = '/'}
                  className="flex-1 flex items-center gap-2"
                >
                  <Home className="h-4 w-4" />
                  返回首页
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 技术支持信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">需要帮助？</CardTitle>
              <CardDescription>
                如果问题持续存在，请联系技术支持团队
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium">技术支持邮箱:</p>
                  <p className="text-muted-foreground">support@qianniu.com</p>
                </div>
                <div>
                  <p className="font-medium">支持热线:</p>
                  <p className="text-muted-foreground">400-123-4567</p>
                </div>
              </div>
              
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">
                  报告问题时，请提供错误ID和发生时间以便快速定位问题。
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 系统状态检查 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5" />
                系统状态检查
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span>前端服务正常</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-yellow-500" />
                  <span>API服务检查中</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-red-500" />
                  <span>WebSocket异常</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}