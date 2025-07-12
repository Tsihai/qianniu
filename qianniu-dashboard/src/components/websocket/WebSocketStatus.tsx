'use client'

import React, { useState, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  ConnectionState,
  WebSocketReadyState,
  ConnectionInfo,
  WebSocketStats,
  type ConnectionQuality,
  type ConnectionHistoryEntry,
  type RealtimeStats,
} from '@/types/websocket'
import {
  getQualityColor,
  getQualityDescription,
} from '@/hooks/useWebSocketMonitoring'
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Activity,
  Clock,
  TrendingUp,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  History,
  Info,
  Zap,
  Signal,
  BarChart3,
  Timer,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface WebSocketStatusProps {
  connectionState: ConnectionState
  readyState: WebSocketReadyState
  connectionInfo: ConnectionInfo
  statistics?: WebSocketStats
  connectionQuality?: ConnectionQuality
  realtimeStats?: RealtimeStats
  connectionHistory?: ConnectionHistoryEntry[]
  onReconnect?: () => void
  onDisconnect?: () => void
  onClearHistory?: () => void
  className?: string
  compact?: boolean
  showHistory?: boolean
  showDetails?: boolean
  showQualityMetrics?: boolean
  maxHistoryItems?: number
}

/**
 * WebSocket连接状态组件
 * 显示连接状态、统计信息和操作按钮
 */
export function WebSocketStatus({
  connectionState,
  readyState,
  connectionInfo,
  statistics,
  connectionQuality,
  realtimeStats,
  connectionHistory = [],
  onReconnect,
  onDisconnect,
  onClearHistory,
  className,
  compact = false,
  showHistory = true,
  showDetails = true,
  showQualityMetrics = true,
  maxHistoryItems = 10,
}: WebSocketStatusProps) {
  const [showHistoryPanel, setShowHistoryPanel] = useState(false)
  const [showDetailsPanel, setShowDetailsPanel] = useState(false)
  const [showQualityPanel, setShowQualityPanel] = useState(false)
  // 获取连接状态的显示信息
  const getConnectionStateInfo = () => {
    switch (connectionState) {
      case 'connected':
        return {
          icon: CheckCircle,
          label: '已连接',
          color: 'text-green-500',
          bgColor: 'bg-green-50',
          variant: 'default' as const,
        }
      case 'connecting':
        return {
          icon: Loader2,
          label: '连接中',
          color: 'text-blue-500',
          bgColor: 'bg-blue-50',
          variant: 'secondary' as const,
        }
      case 'reconnecting':
        return {
          icon: RefreshCw,
          label: '重连中',
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-50',
          variant: 'outline' as const,
        }
      case 'error':
        return {
          icon: AlertCircle,
          label: '连接错误',
          color: 'text-red-500',
          bgColor: 'bg-red-50',
          variant: 'destructive' as const,
        }
      case 'disconnected':
      default:
        return {
          icon: XCircle,
          label: '已断开',
          color: 'text-gray-500',
          bgColor: 'bg-gray-50',
          variant: 'secondary' as const,
        }
    }
  }

  // 获取连接质量的显示信息
  const getQualityInfo = () => {
    if (!connectionQuality) {
      return { label: '未知', color: 'text-gray-500' }
    }
    return {
      label: getQualityDescription(connectionQuality.level),
      color: getQualityColor(connectionQuality.level),
    }
  }

  // 处理连接历史记录
  const recentHistory = useMemo(() => {
    return connectionHistory
      .slice(-maxHistoryItems)
      .sort((a, b) => b.timestamp - a.timestamp)
  }, [connectionHistory, maxHistoryItems])

  // 格式化历史事件
  const formatHistoryEvent = (event: ConnectionHistoryEntry['event']) => {
    switch (event) {
      case 'connected':
        return { label: '已连接', color: 'text-green-600', icon: CheckCircle }
      case 'disconnected':
        return { label: '已断开', color: 'text-gray-600', icon: XCircle }
      case 'error':
        return { label: '连接错误', color: 'text-red-600', icon: AlertCircle }
      case 'reconnecting':
        return { label: '重新连接', color: 'text-blue-600', icon: RefreshCw }
      default:
        return { label: '未知', color: 'text-gray-600', icon: Info }
    }
  }

  // 计算连接稳定性
  const connectionStability = useMemo(() => {
    if (connectionQuality) {
      return Math.round(connectionQuality.stability)
    }
    if (recentHistory.length === 0) return 100
    const errorCount = recentHistory.filter(item => item.event === 'error').length
    const disconnectCount = recentHistory.filter(item => item.event === 'disconnected').length
    const totalEvents = recentHistory.length
    return Math.max(0, Math.round((1 - (errorCount + disconnectCount) / totalEvents) * 100))
  }, [connectionQuality, recentHistory])

  // 格式化时间
  const formatTime = (timestamp?: number) => {
    if (!timestamp) return '-'
    return new Date(timestamp).toLocaleTimeString()
  }

  // 格式化延迟
  const formatLatency = (latency?: number) => {
    if (!latency) return '-'
    return `${Math.round(latency)}ms`
  }

  // 格式化字节数
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // 格式化持续时间
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}秒`
    if (seconds < 3600) return `${Math.round(seconds / 60)}分钟`
    return `${Math.round(seconds / 3600)}小时`
  }

  const stateInfo = getConnectionStateInfo()
  const qualityInfo = getQualityInfo()
  const StateIcon = stateInfo.icon

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn('flex items-center gap-2', className)}>
              <StateIcon
                className={cn(
                  'h-4 w-4',
                  stateInfo.color,
                  connectionState === 'connecting' || connectionState === 'reconnecting'
                    ? 'animate-spin'
                    : ''
                )}
              />
              <Badge variant={stateInfo.variant} className="text-xs">
                {stateInfo.label}
              </Badge>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1 text-sm">
              <div>状态: {stateInfo.label}</div>
              <div>质量: {qualityInfo.label}</div>
              <div>延迟: {formatLatency(connectionQuality?.latency || connectionInfo.latency)}</div>
              <div>重连次数: {realtimeStats?.reconnectCount || statistics?.reconnectCount || 0}</div>
              <div>稳定性: {connectionStability}%</div>
              {connectionQuality && (
                <div>质量分数: {connectionQuality.score}/100</div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <StateIcon
              className={cn(
                'h-5 w-5',
                stateInfo.color,
                connectionState === 'connecting' || connectionState === 'reconnecting'
                  ? 'animate-spin'
                  : ''
              )}
            />
            <span>WebSocket连接</span>
          </div>
          <Badge variant={stateInfo.variant}>{stateInfo.label}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 连接信息 */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Wifi className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">服务器:</span>
            </div>
            <div className="font-mono text-xs break-all">
              {connectionInfo.url}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">连接质量:</span>
            </div>
            <div className={cn('font-medium', qualityInfo.color)}>
              {qualityInfo.label}
            </div>
          </div>
        </div>

        <Separator />

        {/* 统计信息 */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">已发送:</span>
              </div>
              <span className="font-medium">{realtimeStats?.messagesSent || statistics?.messagesSent || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">已接收:</span>
              </div>
              <span className="font-medium">{realtimeStats?.messagesReceived || statistics?.messagesReceived || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">稳定性:</span>
              </div>
              <span className={cn(
                'font-medium',
                connectionStability >= 90 ? 'text-green-600' :
                connectionStability >= 70 ? 'text-yellow-600' : 'text-red-600'
              )}>
                {connectionStability}%
              </span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">延迟:</span>
              </div>
              <span className={cn(
                'font-medium',
                !(realtimeStats?.currentLatency || connectionInfo.latency) ? 'text-gray-500' :
                (realtimeStats?.currentLatency || connectionInfo.latency || 0) < 100 ? 'text-green-600' :
                (realtimeStats?.currentLatency || connectionInfo.latency || 0) < 300 ? 'text-yellow-600' : 'text-red-600'
              )}>
                {formatLatency(realtimeStats?.currentLatency || connectionInfo.latency)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">重连次数:</span>
              </div>
              <span className="font-medium">{realtimeStats?.reconnectCount || statistics?.reconnectCount || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">消息速率:</span>
              </div>
              <span className="font-medium">
                {realtimeStats ? 
                  Math.round(((realtimeStats.messagesSent + realtimeStats.messagesReceived) / Math.max(1, realtimeStats.connectionUptime / 60))) :
                  Math.round(((statistics?.messagesSent || 0) + (statistics?.messagesReceived || 0)) / Math.max(1, (Date.now() - (connectionInfo.connectedAt || Date.now())) / 60000))
                }/分钟
              </span>
            </div>
          </div>
        </div>

        {/* 时间信息 */}
        {(connectionInfo.connectedAt || connectionInfo.disconnectedAt) && (
          <>
            <Separator />
            <div className="space-y-2 text-sm">
              {connectionInfo.connectedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">连接时间:</span>
                  <span className="font-medium">
                    {formatTime(connectionInfo.connectedAt)}
                  </span>
                </div>
              )}
              {connectionInfo.disconnectedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">断开时间:</span>
                  <span className="font-medium">
                    {formatTime(connectionInfo.disconnectedAt)}
                  </span>
                </div>
              )}
            </div>
          </>
        )}

        {/* 错误信息 */}
        {connectionInfo.lastError && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                <span>最近错误:</span>
              </div>
              <div className="text-sm text-red-600 bg-red-50 p-2 rounded border">
                {connectionInfo.lastError}
              </div>
            </div>
          </>
        )}

        {/* 连接历史记录 */}
        {showHistory && recentHistory.length > 0 && (
          <>
            <Separator />
            <Collapsible open={showHistoryPanel} onOpenChange={setShowHistoryPanel}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4" />
                    <span>连接历史 ({recentHistory.length})</span>
                  </div>
                  {showHistoryPanel ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pt-2">
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {recentHistory.map((item, index) => {
                    const eventInfo = formatHistoryEvent(item.event)
                    const EventIcon = eventInfo.icon
                    return (
                      <div
                        key={item.id || index}
                        className="flex items-center justify-between text-xs p-2 rounded bg-muted/50"
                      >
                        <div className="flex items-center gap-2">
                          <EventIcon className={cn('h-3 w-3', eventInfo.color)} />
                          <span className={eventInfo.color}>{eventInfo.label}</span>
                          {item.errorMessage && (
                            <span className="text-muted-foreground truncate max-w-24">
                              {item.errorMessage}
                            </span>
                          )}
                          {item.duration && (
                            <span className="text-muted-foreground text-xs">
                              ({formatDuration(item.duration / 1000)})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          {item.latency && (
                            <span>{Math.round(item.latency)}ms</span>
                          )}
                          <span>{formatTime(item.timestamp)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {onClearHistory && recentHistory.length > 0 && (
                  <div className="pt-2">
                    <Button
                      onClick={onClearHistory}
                      size="sm"
                      variant="outline"
                      className="w-full text-xs"
                    >
                      <History className="h-3 w-3 mr-1" />
                      清除历史记录
                    </Button>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          </>
        )}

        {/* 连接质量面板 */}
        {showQualityMetrics && connectionQuality && (
          <>
            <Separator />
            <Collapsible open={showQualityPanel} onOpenChange={setShowQualityPanel}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between">
                  <div className="flex items-center gap-2">
                    <Signal className="h-4 w-4" />
                    <span>连接质量</span>
                    <Badge variant="outline" className={cn('text-xs', getQualityColor(connectionQuality.level))}>
                      {connectionQuality.score}/100
                    </Badge>
                  </div>
                  {showQualityPanel ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-2">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">质量分数</span>
                      <span className={cn('font-medium', getQualityColor(connectionQuality.level))}>
                        {connectionQuality.score}/100
                      </span>
                    </div>
                    <Progress value={connectionQuality.score} className="h-2" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">延迟:</span>
                        <span className="font-medium">{formatLatency(connectionQuality.latency)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">稳定性:</span>
                        <span className="font-medium">{Math.round(connectionQuality.stability)}%</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">正常运行:</span>
                        <span className="font-medium">{formatDuration(connectionQuality.uptime)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">错误率:</span>
                        <span className="font-medium">{connectionQuality.errorRate.toFixed(2)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </>
        )}

        {/* 实时统计面板 */}
        {realtimeStats && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <BarChart3 className="h-4 w-4" />
                <span>实时统计</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">数据发送:</span>
                    <span className="font-medium">{formatBytes(realtimeStats.bytesSent)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">数据接收:</span>
                    <span className="font-medium">{formatBytes(realtimeStats.bytesReceived)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">平均延迟:</span>
                    <span className="font-medium">{formatLatency(realtimeStats.averageLatency)}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">当前延迟:</span>
                    <span className="font-medium">{formatLatency(realtimeStats.currentLatency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">错误次数:</span>
                    <span className="font-medium">{realtimeStats.errorCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">最后心跳:</span>
                    <span className="font-medium">
                      {realtimeStats.lastHeartbeat ? formatTime(realtimeStats.lastHeartbeat) : '-'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* 详细信息面板 */}
        {showDetails && (
          <>
            <Separator />
            <Collapsible open={showDetailsPanel} onOpenChange={setShowDetailsPanel}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    <span>详细信息</span>
                  </div>
                  {showDetailsPanel ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="space-y-2">
                    <div className="font-medium text-muted-foreground">连接信息</div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span>协议:</span>
                        <span className="font-mono">WebSocket</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Ready State:</span>
                        <span className="font-mono">{readyState}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>缓冲数据:</span>
                        <span>{realtimeStats ? formatBytes(realtimeStats.bytesSent + realtimeStats.bytesReceived) : '0 bytes'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="font-medium text-muted-foreground">性能指标</div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span>平均延迟:</span>
                        <span>{formatLatency(realtimeStats?.averageLatency || connectionInfo.latency)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>连接时长:</span>
                        <span>
                          {realtimeStats?.connectionUptime ? formatDuration(realtimeStats.connectionUptime) :
                           connectionInfo.connectedAt ? formatDuration((Date.now() - connectionInfo.connectedAt) / 1000) : '-'
                          }
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>数据传输:</span>
                        <span>{(realtimeStats?.messagesSent || 0) + (realtimeStats?.messagesReceived || 0)} 条</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-2 pt-2">
          {connectionState === 'disconnected' && onReconnect && (
            <Button
              onClick={onReconnect}
              size="sm"
              className="flex-1"
              variant="default"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              重新连接
            </Button>
          )}
          {connectionState === 'connected' && onDisconnect && (
            <Button
              onClick={onDisconnect}
              size="sm"
              className="flex-1"
              variant="outline"
            >
              <WifiOff className="h-4 w-4 mr-2" />
              断开连接
            </Button>
          )}
          {(connectionState === 'connecting' || connectionState === 'reconnecting') && (
            <Button size="sm" className="flex-1" variant="outline" disabled>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {connectionState === 'connecting' ? '连接中...' : '重连中...'}
            </Button>
          )}
          {connectionState === 'error' && onReconnect && (
            <Button
              onClick={onReconnect}
              size="sm"
              className="flex-1"
              variant="destructive"
            >
              <AlertCircle className="h-4 w-4 mr-2" />
              重试连接
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * 简化的WebSocket状态指示器
 * 只显示基本的连接状态
 */
export function WebSocketIndicator({
  connectionState,
  className,
}: {
  connectionState: ConnectionState
  className?: string
}) {
  const stateInfo = {
    connected: { icon: CheckCircle, color: 'text-green-500' },
    connecting: { icon: Loader2, color: 'text-blue-500' },
    reconnecting: { icon: RefreshCw, color: 'text-yellow-500' },
    error: { icon: AlertCircle, color: 'text-red-500' },
    disconnected: { icon: XCircle, color: 'text-gray-500' },
  }[connectionState]

  const Icon = stateInfo.icon

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Icon
            className={cn(
              'h-4 w-4',
              stateInfo.color,
              (connectionState === 'connecting' || connectionState === 'reconnecting') &&
                'animate-spin',
              className
            )}
          />
        </TooltipTrigger>
        <TooltipContent>
          <span className="capitalize">{connectionState}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}