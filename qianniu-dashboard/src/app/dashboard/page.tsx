'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'
import { Chart } from '@/components/ui/chart'
import { WebSocketStatus } from '@/components/websocket/WebSocketStatus'
import { PerformanceMetrics } from '@/components/monitoring/PerformanceMetrics'
import { useRealTimeData } from '@/hooks/useRealTimeData'
import { useRealTimeMetrics } from '@/hooks/useRealTimeMetrics'
import { useWebSocket } from '@/hooks/useWebSocket'
import { METRICS_TYPE } from '@/lib/constants'
import type { ConnectionState, ConnectionInfo, WebSocketStats } from '@/types/websocket'
import { WebSocketReadyState } from '@/types/websocket'
import type { PerformanceAlert } from '@/types/monitoring'
import { 
  Activity, 
  Users, 
  MessageSquare, 
  Clock, 
  TrendingUp,
  Zap,
  Wifi,
  WifiOff,
  AlertTriangle
} from 'lucide-react'
import type { ChartDataPoint } from '@/components/ui/chart'

// 数据格式化工具函数
const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`
  }
  return num.toString()
}

const formatTime = (seconds: number): string => {
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds.toFixed(1)}s`
  }
  return `${seconds.toFixed(1)}s`
}

const formatPercentage = (value: number): string => {
  return `${value.toFixed(1)}%`
}

// 趋势计算函数
const calculateTrend = (current: number, previous: number): {
  change: string
  trend: 'up' | 'down' | 'neutral'
  percentage: number
} => {
  if (previous === 0 || !isFinite(previous)) {
    return {
      change: 'N/A',
      trend: 'neutral',
      percentage: 0
    }
  }
  
  const percentage = ((current - previous) / previous) * 100
  const absPercentage = Math.abs(percentage)
  
  return {
    change: `${percentage >= 0 ? '+' : ''}${percentage.toFixed(1)}%`,
    trend: absPercentage < 1 ? 'neutral' : percentage > 0 ? 'up' : 'down',
    percentage: absPercentage
  }
}

/**
 * 实时监控仪表板页面
 * 集成实时数据展示、统计卡片、图表和WebSocket状态监控
 */
export default function DashboardPage() {
  // 获取实时数据
  const {
    data: {
      messages,
      agents,
      systemStats,
      notifications,
      isConnected,
      lastUpdate
    }
  } = useRealTimeData({
    maxMessages: 1000,
    maxNotifications: 50,
    autoConnect: true
  })

  // 获取实时指标
  const {
    metrics,
    error: metricsError,
    isLoading: metricsLoading,
    refreshMetrics
  } = useRealTimeMetrics({
    calculationInterval: 5000,
    windowSize: 300000, // 5分钟窗口
    enabledMetrics: [
      METRICS_TYPE.MESSAGE_RATE,
      METRICS_TYPE.RESPONSE_TIME, 
      METRICS_TYPE.ERROR_RATE,
      METRICS_TYPE.CONNECTION_STABILITY,
      METRICS_TYPE.AGENT_WORKLOAD,
      METRICS_TYPE.SYSTEM_PERFORMANCE
    ]
  })

  // WebSocket连接状态管理
  const {
    readyState,
    connectionStatus,
    sendMessage,
    lastMessage,
    reconnect,
    disconnect
  } = useWebSocket({
    url: 'ws://localhost:8080/ws',
    onOpen: () => console.log('WebSocket连接已建立'),
    onClose: () => console.log('WebSocket连接已关闭'),
    onError: (error) => console.error('WebSocket连接错误:', error),
    onMessage: (message) => console.log('收到WebSocket消息:', message)
  })

  // 映射 readyState 到 connectionState
  const mapReadyStateToConnectionState = useCallback((state: WebSocketReadyState): ConnectionState => {
    switch (state) {
      case WebSocketReadyState.CONNECTING:
        return 'connecting'
      case WebSocketReadyState.OPEN:
        return 'connected'
      case WebSocketReadyState.CLOSING:
        return 'disconnected'
      case WebSocketReadyState.CLOSED:
        return 'disconnected'
      default:
        return 'disconnected'
    }
  }, [])

  // 模拟WebSocket统计数据和连接信息
  const wsStats: WebSocketStats = {
    messagesSent: 0,
    messagesReceived: 0,
    reconnectCount: 0,
    errorCount: 0,
    totalUptime: 0,
    averageLatency: 0,
    lastHeartbeat: Date.now(),
    connectionQuality: 'good'
  }

  const connectionInfo: ConnectionInfo = {
    url: 'ws://localhost:8080/ws',
    readyState,
    connectionState: connectionStatus,
    connectedAt: Date.now(),
    reconnectAttempts: 0,
    latency: 45
  }

  // 图表数据状态
  const [chartData, setChartData] = useState<{
    messageTraffic: ChartDataPoint[]
    responseTime: ChartDataPoint[]
    systemPerformance: ChartDataPoint[]
  }>({
    messageTraffic: [],
    responseTime: [],
    systemPerformance: []
  })

  // 图表数据缓存和处理
  const chartDataCache = useRef({
    messageTraffic: [] as Array<{ time: string; messages: number; responses: number; timestamp: number }>,
    responseTime: [] as Array<{ time: string; responseTime: number; timestamp: number }>,
    performance: [] as Array<{ time: string; cpu: number; memory: number; network: number; timestamp: number }>
  })

  // 数据处理函数
  const processChartData = useCallback(() => {
    const now = Date.now()
    const timeWindow = 30 * 60 * 1000 // 30分钟窗口
    const timeLabel = new Date(now).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })

    // 处理消息流量数据
    if (messages && messages.length > 0) {
      const newMessagePoint = {
        time: timeLabel,
        messages: messages.length,
        responses: Math.floor(messages.length * 0.85),
        timestamp: now
      }

      // 更新消息流量缓存
      chartDataCache.current.messageTraffic = [
        ...chartDataCache.current.messageTraffic.filter(item => now - item.timestamp < timeWindow),
        newMessagePoint
      ].slice(-50) // 保持最多50个数据点
    }

    // 处理响应时间数据
    if (metrics?.responseTime !== undefined) {
      const newResponsePoint = {
        time: timeLabel,
        responseTime: metrics.responseTime?.value || 0,
        timestamp: now
      }

      chartDataCache.current.responseTime = [
        ...chartDataCache.current.responseTime.filter(item => now - item.timestamp < timeWindow),
        newResponsePoint
      ].slice(-50)
    }

    // 处理系统性能数据
    const newPerformancePoint = {
      time: timeLabel,
      cpu: 20 + Math.random() * 60,
      memory: 30 + Math.random() * 50,
      network: 10 + Math.random() * 40,
      timestamp: now
    }

    chartDataCache.current.performance = [
      ...chartDataCache.current.performance.filter(item => now - item.timestamp < timeWindow),
      newPerformancePoint
    ].slice(-50)

    // 更新图表数据状态
    setChartData({
      messageTraffic: chartDataCache.current.messageTraffic.map(item => ({
        name: item.time,
        value: item.messages,
        timestamp: item.timestamp
      })),
      responseTime: chartDataCache.current.responseTime.map(item => ({
        name: item.time,
        value: item.responseTime,
        timestamp: item.timestamp
      })),
      systemPerformance: chartDataCache.current.performance.map(item => ({
        name: item.time,
        value: item.cpu,
        timestamp: item.timestamp
      }))
    })
  }, [messages, metrics])

  // 图表数据处理
  useEffect(() => {
    processChartData()
  }, [processChartData])

  // 定时更新图表数据
  useEffect(() => {
    const interval = setInterval(processChartData, 5000) // 每5秒更新一次
    return () => clearInterval(interval)
  }, [processChartData])

  // 历史数据状态用于趋势计算
  const [previousStats, setPreviousStats] = useState({
    onlineAgents: 0,
    totalMessages: 0,
    avgResponseTime: 0,
    automationRate: 0,
    errorRate: 0,
    connectionStability: 0
  })

  // 计算当前统计数据
  const currentStats = useMemo(() => ({
    onlineAgents: agents.filter(agent => agent.status === 'online').length,
    totalMessages: messages.length,
    avgResponseTime: metrics.responseTime?.value || 0,
    automationRate: systemStats?.automationRate || 0,
    errorRate: metrics.errorRate?.value || 0,
    connectionStability: metrics.connectionStability?.value || 0
  }), [agents, messages.length, metrics, systemStats])

  // 计算趋势数据
  const trendData = useMemo(() => ({
    onlineAgents: calculateTrend(currentStats.onlineAgents, previousStats.onlineAgents),
    totalMessages: calculateTrend(currentStats.totalMessages, previousStats.totalMessages),
    avgResponseTime: calculateTrend(currentStats.avgResponseTime, previousStats.avgResponseTime),
    automationRate: calculateTrend(currentStats.automationRate, previousStats.automationRate),
    errorRate: calculateTrend(currentStats.errorRate, previousStats.errorRate),
    connectionStability: calculateTrend(currentStats.connectionStability, previousStats.connectionStability)
  }), [currentStats, previousStats])

  // 定期更新历史数据用于趋势计算
  useEffect(() => {
    const interval = setInterval(() => {
      setPreviousStats(currentStats)
    }, 30000) // 每30秒更新一次历史数据

    return () => clearInterval(interval)
  }, [currentStats])

  // 错误状态检查
  const hasError = useCallback((value: number) => {
    return !isFinite(value) || isNaN(value)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto p-6 space-y-6">
        {/* 页面标题 */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              实时监控仪表板
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              千牛客服系统实时数据监控与分析
            </p>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            {connectionStatus === 'connected' ? (
              <>
                <Wifi className="h-4 w-4 text-green-500" />
                <span>实时连接</span>
              </>
            ) : connectionStatus === 'connecting' || connectionStatus === 'reconnecting' ? (
              <>
                <Activity className="h-4 w-4 text-blue-500 animate-spin" />
                <span>{connectionStatus === 'connecting' ? '连接中' : '重连中'}</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-red-500" />
                <span>连接断开</span>
              </>
            )}
          </div>
        </div>

        {/* WebSocket 连接状态监控区域 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5" />
              WebSocket 连接监控
            </CardTitle>
            <CardDescription>
              实时连接状态、性能指标和控制面板
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WebSocketStatus
              connectionState={mapReadyStateToConnectionState(readyState)}
              readyState={readyState}
              connectionInfo={connectionInfo}
              statistics={wsStats}
              onReconnect={reconnect}
              onDisconnect={disconnect}
              compact={false}
              className="w-full"
              showHistory={true}
              showDetails={true}
              connectionHistory={[
                {
                  id: '1',
                  timestamp: Date.now() - 300000,
                  event: 'connected',
                  latency: 45
                },
                {
                  id: '2',
                  timestamp: Date.now() - 240000,
                  event: 'error',
                  errorMessage: '网络超时',
                  latency: 1200
                },
                {
                  id: '3',
                  timestamp: Date.now() - 180000,
                  event: 'reconnecting',
                  reconnectAttempt: 1,
                  latency: 67
                },
                {
                  id: '4',
                  timestamp: Date.now() - 120000,
                  event: 'connected',
                  latency: 32
                }
              ]}
              maxHistoryItems={10}
            />
          </CardContent>
        </Card>

        {/* 统计卡片网格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="在线客服"
            value={formatNumber(currentStats.onlineAgents)}
            change={trendData.onlineAgents.change}
            icon={Users}
            trend={trendData.onlineAgents.trend}
            description="当前在线客服人数"
            loading={metricsLoading}
            error={hasError(currentStats.onlineAgents)}
          />
          
          <StatCard
            title="消息总数"
            value={formatNumber(currentStats.totalMessages)}
            change={trendData.totalMessages.change}
            icon={MessageSquare}
            trend={trendData.totalMessages.trend}
            description="今日处理消息数量"
            loading={metricsLoading}
            error={hasError(currentStats.totalMessages)}
          />
          
          <StatCard
            title="平均响应时间"
            value={formatTime(currentStats.avgResponseTime)}
            change={trendData.avgResponseTime.change}
            icon={Clock}
            trend={trendData.avgResponseTime.trend}
            description="消息平均响应时间"
            loading={metricsLoading}
            error={hasError(currentStats.avgResponseTime)}
          />
          
          <StatCard
            title="自动化率"
            value={formatPercentage(currentStats.automationRate)}
            change={trendData.automationRate.change}
            icon={Zap}
            trend={trendData.automationRate.trend}
            description="智能客服处理比例"
            loading={metricsLoading}
            error={hasError(currentStats.automationRate)}
          />
        </div>

        {/* 图表区域 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 消息流量图表 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                消息流量趋势
              </CardTitle>
              <CardDescription>
                实时消息处理量变化趋势
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Chart
                data={chartData.messageTraffic}
                type="line"
                xKey="name"
                yKey="value"
                config={{
                  value: {
                    label: '消息数/分钟',
                    color: 'hsl(var(--chart-1))'
                  }
                }}
                loading={metricsLoading}
                className="h-[300px]"
                realTime={true}
                autoUpdate={true}
                updateInterval={5000}
                maxDataPoints={50}

                onDataPointClick={(data, index) => {
                  console.log('Message traffic data point clicked:', data, index)
                }}
                onZoomChange={(domain) => {
                  console.log('Message traffic zoom changed:', domain)
                }}
              />
            </CardContent>
          </Card>

          {/* 响应时间图表 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                响应时间趋势
              </CardTitle>
              <CardDescription>
                平均响应时间变化趋势
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Chart
                data={chartData.responseTime}
                type="area"
                xKey="name"
                yKey="value"
                config={{
                  value: {
                    label: '响应时间(秒)',
                    color: 'hsl(var(--chart-2))'
                  }
                }}
                loading={metricsLoading}
                className="h-[300px]"
                realTime={true}
                autoUpdate={true}
                updateInterval={5000}
                maxDataPoints={50}

                showReferenceLine={true}
                referenceValue={1000}
                onDataPointClick={(data, index) => {
                  console.log('Response time data point clicked:', data, index)
                }}
              />
            </CardContent>
          </Card>
        </div>

        {/* 性能监控模块 */}
        <PerformanceMetrics
          config={{
            sampleInterval: 5000,
            maxDataPoints: 50,
            enableCpuMonitoring: true,
            enableMemoryMonitoring: true,
            enableApiMonitoring: true,
            enableErrorMonitoring: true,
            enableFpsMonitoring: true,
            enableAutoCleanup: true,
          }}
          autoStart={true}
          showDetails={true}
          showCharts={true}
          showAlerts={true}
          onAlert={(alert: PerformanceAlert) => {
            console.log('Performance alert:', alert)
            // 可以在这里添加通知逻辑
          }}
          onMetricsUpdate={(metrics) => {
            console.log('Performance metrics updated:', metrics)
            // 可以在这里更新其他相关状态
          }}
          className="w-full"
        />

        {/* 系统性能和错误监控 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 系统性能图表 */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                系统性能监控
              </CardTitle>
              <CardDescription>
                系统整体性能指标变化
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Chart
                data={chartData.systemPerformance}
                type="bar"
                xKey="name"
                yKey="value"
                config={{
                  value: {
                    label: '性能指数',
                    color: 'hsl(var(--chart-3))'
                  }
                }}
                loading={metricsLoading}
                className="h-[300px]"
                realTime={true}
                autoUpdate={true}
                updateInterval={3000}
                maxDataPoints={30}

                showReferenceLine={true}
                referenceValue={80}
                onDataPointClick={(data, index) => {
                  console.log('System performance data point clicked:', data, index)
                }}
              />
            </CardContent>
          </Card>

          {/* 关键指标卡片 */}
          <div className="space-y-4">
            <StatCard
              title="错误率"
              value={formatPercentage(currentStats.errorRate)}
              change={trendData.errorRate.change}
              icon={currentStats.errorRate > 5 ? AlertTriangle : Activity}
              trend={trendData.errorRate.trend}
              description="系统错误发生率"
              loading={metricsLoading}
              error={hasError(currentStats.errorRate) || currentStats.errorRate > 10}
            />
            
            <StatCard
              title="连接稳定性"
              value={formatPercentage(currentStats.connectionStability)}
              change={trendData.connectionStability.change}
              icon={currentStats.connectionStability < 90 ? WifiOff : Wifi}
              trend={trendData.connectionStability.trend}
              description="WebSocket连接稳定性"
              loading={metricsLoading}
              error={hasError(currentStats.connectionStability) || currentStats.connectionStability < 80}
            />
          </div>
        </div>

        {/* 最后更新时间 */}
        <div className="text-center text-sm text-slate-500 dark:text-slate-400">
          最后更新: {new Date(lastUpdate).toLocaleString('zh-CN')}
          {metricsError && (
            <span className="ml-4 text-red-500">
              指标计算错误: {metricsError.message}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}