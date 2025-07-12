'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useWebSocket } from '@/hooks/useWebSocket'
import { WebSocketStatus } from './WebSocketStatus'
import { WebSocketMessages } from './WebSocketMessages'
import type { WebSocketMessage } from '@/types/websocket'
import {
  Settings,
  Bug,
  Play,
  Square,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Zap,
  Timer,
  Network,
  MessageCircle,
  Activity,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { WEBSOCKET_CONFIG } from '@/lib/constants'

interface WebSocketDebugPanelProps {
  className?: string
  defaultUrl?: string
  autoConnect?: boolean
}

/**
 * WebSocket调试面板
 * 提供完整的WebSocket连接管理、消息调试和配置功能
 */
export function WebSocketDebugPanel({
  className,
  defaultUrl = WEBSOCKET_CONFIG.URL,
  autoConnect = false,
}: WebSocketDebugPanelProps) {
  // WebSocket配置状态
  const [url, setUrl] = useState(defaultUrl)
  const [enableReconnect, setEnableReconnect] = useState(true)
  const [enableHeartbeat, setEnableHeartbeat] = useState(true)
  const [heartbeatInterval, setHeartbeatInterval] = useState(30000)
  const [reconnectInterval, setReconnectInterval] = useState(1000)
  const [maxReconnectAttempts, setMaxReconnectAttempts] = useState(10)
  
  // UI状态
  const [configExpanded, setConfigExpanded] = useState(false)
  const [statsExpanded, setStatsExpanded] = useState(true)
  
  // WebSocket Hook
  const {
    readyState,
    sendMessage,
    lastMessage,
    connectionStatus,
    connectionInfo,
    stats,
    connect: wsConnect,
    disconnect: wsDisconnect,
    sendJsonMessage,
    clearMessages: wsClearMessages
  } = useWebSocket({
    url,
    onOpen: () => console.log('WebSocket连接已建立'),
    onClose: () => console.log('WebSocket连接已关闭'),
    onError: (error) => console.error('WebSocket连接错误:', error),
    onMessage: (message) => console.log('收到WebSocket消息:', message)
  })

  // 使用WebSocket hook返回的状态
  const connectionState = connectionStatus
  const messages: WebSocketMessage[] = []
  
  // 使用WebSocket hook的控制函数
  const connect = wsConnect
  const disconnect = wsDisconnect
  const clearMessages = wsClearMessages
  const updateConfig = (config: unknown) => console.log('更新配置:', config)

  // 应用配置更改
  const handleApplyConfig = () => {
    updateConfig({
      url,
      autoConnect,
      reconnect: {
        enabled: enableReconnect,
        maxAttempts: maxReconnectAttempts,
        initialDelay: reconnectInterval,
        maxDelay: 30000,
        backoffFactor: 2,
        jitter: true,
      },
      heartbeat: {
        enabled: enableHeartbeat,
        interval: heartbeatInterval,
        timeout: 10000,
        pingMessage: 'ping',
        pongMessage: 'pong',
      },
    })
  }

  // 重置配置
  const handleResetConfig = () => {
    setUrl(defaultUrl)
    setEnableReconnect(true)
    setEnableHeartbeat(true)
    setHeartbeatInterval(30000)
    setReconnectInterval(1000)
    setMaxReconnectAttempts(10)
  }

  // 发送测试消息
  const handleSendTestMessage = () => {
    const testMessage = {
      type: 'test',
      timestamp: Date.now(),
      data: 'Hello from WebSocket Debug Panel',
    }
    sendJsonMessage(testMessage)
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* 标题和控制按钮 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5" />
              <span>WebSocket调试面板</span>
            </CardTitle>
            
            <div className="flex items-center gap-2">
              {connectionState === 'disconnected' && (
                <Button onClick={connect} size="sm" variant="default">
                  <Play className="h-4 w-4 mr-2" />
                  连接
                </Button>
              )}
              {connectionState === 'connected' && (
                <Button onClick={disconnect} size="sm" variant="outline">
                  <Square className="h-4 w-4 mr-2" />
                  断开
                </Button>
              )}
              {(connectionState === 'connecting' || connectionState === 'reconnecting') && (
                <Button size="sm" variant="outline" disabled>
                  <Activity className="h-4 w-4 mr-2 animate-pulse" />
                  {connectionState === 'connecting' ? '连接中' : '重连中'}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* 主要内容区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 左侧：连接状态和配置 */}
        <div className="space-y-4">
          {/* 连接状态 */}
          <WebSocketStatus
            connectionState={connectionState}
            readyState={readyState}
            connectionInfo={connectionInfo}
            statistics={stats}
            onReconnect={connect}
            onDisconnect={disconnect}
          />

          {/* 配置面板 */}
          <Card>
            <Collapsible open={configExpanded} onOpenChange={setConfigExpanded}>
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Settings className="h-4 w-4" />
                      <span>连接配置</span>
                    </CardTitle>
                    {configExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  {/* WebSocket URL */}
                  <div className="space-y-2">
                    <Label htmlFor="websocket-url">WebSocket URL</Label>
                    <Input
                      id="websocket-url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="ws://localhost:8080/ws"
                      className="font-mono text-sm"
                    />
                  </div>

                  <Separator />

                  {/* 重连配置 */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="enable-reconnect" className="flex items-center gap-2">
                        <RotateCcw className="h-4 w-4" />
                        <span>自动重连</span>
                      </Label>
                      <Switch
                        id="enable-reconnect"
                        checked={enableReconnect}
                        onCheckedChange={setEnableReconnect}
                      />
                    </div>
                    
                    {enableReconnect && (
                      <div className="grid grid-cols-2 gap-3 ml-6">
                        <div className="space-y-1">
                          <Label htmlFor="reconnect-interval" className="text-xs">
                            重连间隔 (ms)
                          </Label>
                          <Input
                            id="reconnect-interval"
                            type="number"
                            value={reconnectInterval}
                            onChange={(e) => setReconnectInterval(Number(e.target.value))}
                            min={100}
                            max={60000}
                            className="text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="max-reconnect-attempts" className="text-xs">
                            最大重试次数
                          </Label>
                          <Input
                            id="max-reconnect-attempts"
                            type="number"
                            value={maxReconnectAttempts}
                            onChange={(e) => setMaxReconnectAttempts(Number(e.target.value))}
                            min={1}
                            max={100}
                            className="text-xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* 心跳配置 */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="enable-heartbeat" className="flex items-center gap-2">
                        <Timer className="h-4 w-4" />
                        <span>心跳检测</span>
                      </Label>
                      <Switch
                        id="enable-heartbeat"
                        checked={enableHeartbeat}
                        onCheckedChange={setEnableHeartbeat}
                      />
                    </div>
                    
                    {enableHeartbeat && (
                      <div className="ml-6">
                        <div className="space-y-1">
                          <Label htmlFor="heartbeat-interval" className="text-xs">
                            心跳间隔 (ms)
                          </Label>
                          <Input
                            id="heartbeat-interval"
                            type="number"
                            value={heartbeatInterval}
                            onChange={(e) => setHeartbeatInterval(Number(e.target.value))}
                            min={1000}
                            max={300000}
                            className="text-xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* 配置操作按钮 */}
                  <div className="flex gap-2">
                    <Button
                      onClick={handleApplyConfig}
                      size="sm"
                      className="flex-1"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      应用配置
                    </Button>
                    <Button
                      onClick={handleResetConfig}
                      size="sm"
                      variant="outline"
                      className="flex-1"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      重置
                    </Button>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* 统计信息 */}
          <Card>
            <Collapsible open={statsExpanded} onOpenChange={setStatsExpanded}>
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Activity className="h-4 w-4" />
                      <span>连接统计</span>
                    </CardTitle>
                    {statsExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">连接时长:</span>
                        <span className="font-medium">
                          {connectionState === 'connected' ? '已连接' : '-'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">消息发送:</span>
                        <span className="font-medium">{stats.messagesSent}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">消息接收:</span>
                        <span className="font-medium">{stats.messagesReceived}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">重连次数:</span>
                        <span className="font-medium">{stats.reconnectCount}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">错误次数:</span>
                        <span className="font-medium">{stats.errorCount}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">连接质量:</span>
                        <Badge
                          variant={
                            stats.connectionQuality === 'excellent'
                              ? 'default'
                              : stats.connectionQuality === 'good'
                              ? 'secondary'
                              : stats.connectionQuality === 'poor'
                              ? 'outline'
                              : 'destructive'
                          }
                          className="text-xs"
                        >
                          {{
                            excellent: '优秀',
                            good: '良好',
                            poor: '较差',
                            disconnected: '断开',
                          }[stats.connectionQuality]}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  {/* 快速测试按钮 */}
                  <Separator />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSendTestMessage}
                      size="sm"
                      variant="outline"
                      disabled={connectionState !== 'connected'}
                      className="flex-1"
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      发送测试消息
                    </Button>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        </div>

        {/* 右侧：消息管理 */}
        <div className="space-y-4">
          <WebSocketMessages
            messages={messages}
            onSendMessage={(message: string | object) => {
              if (typeof message === 'string') {
                sendMessage(message)
              } else {
                sendMessage(JSON.stringify(message))
              }
            }}
            onClearMessages={clearMessages}
            className="h-[600px]"
          />
        </div>
      </div>
    </div>
  )
}

/**
 * 简化的WebSocket调试工具
 * 适用于开发环境的快速调试
 */
export function WebSocketDebugTool({
  url = WEBSOCKET_CONFIG.URL,
  className,
}: {
  url?: string
  className?: string
}) {
  const {
    readyState,
    sendMessage,
    lastMessage,
    connectionStatus
  } = useWebSocket({
    url,
    onOpen: () => console.log('WebSocket连接已建立'),
    onClose: () => console.log('WebSocket连接已关闭'),
    onError: (error: any) => console.error('WebSocket连接错误:', error),
    onMessage: (message: any) => console.log('收到WebSocket消息:', message)
  })

  // 模拟连接状态和统计信息
  const connectionState = connectionStatus
  const connectionInfo = { url, protocol: 'ws' }
  const stats = { messagesSent: 0, messagesReceived: 0, reconnectAttempts: 0, reconnectCount: 0, errorCount: 0, connectionQuality: 'good' as const }
  const messages: WebSocketMessage[] = []
  
  // 简化的控制函数
  const connect = () => console.log('连接WebSocket')
  const disconnect = () => console.log('断开WebSocket')
  const clearMessages = () => console.log('清除消息历史')

  return (
    <Card className={cn('w-full max-w-md', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Bug className="h-4 w-4" />
          <span>WebSocket调试</span>
          <Badge variant="outline" className="text-xs">
            {connectionState}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* 连接控制 */}
        <div className="flex gap-2">
          {connectionState === 'disconnected' && (
            <Button onClick={connect} size="sm" className="flex-1">
              连接
            </Button>
          )}
          {connectionState === 'connected' && (
            <Button onClick={disconnect} size="sm" variant="outline" className="flex-1">
              断开
            </Button>
          )}
        </div>
        
        {/* 基本统计 */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="text-center p-2 bg-muted rounded">
            <div className="font-medium">{stats.messagesSent}</div>
            <div className="text-muted-foreground">已发送</div>
          </div>
          <div className="text-center p-2 bg-muted rounded">
            <div className="font-medium">{stats.messagesReceived}</div>
            <div className="text-muted-foreground">已接收</div>
          </div>
        </div>
        
        {/* 快速发送 */}
        <div className="flex gap-2">
          <Button
            onClick={() => sendMessage(JSON.stringify({ type: 'ping', data: 'ping' }))}
            size="sm"
            variant="outline"
            disabled={connectionState !== 'connected'}
            className="flex-1"
          >
            Ping
          </Button>
          <Button
            onClick={clearMessages}
            size="sm"
            variant="outline"
            disabled={messages.length === 0}
            className="flex-1"
          >
            清空
          </Button>
        </div>
        
        {/* 最近消息 */}
        {messages.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">最近消息:</div>
            <ScrollArea className="h-20">
              <div className="space-y-1">
                {messages.slice(-3).map((message: WebSocketMessage) => (
                  <div
                    key={message.id}
                    className="text-xs p-1 bg-muted rounded truncate"
                  >
                    {typeof message.data === 'string'
                      ? message.data
                      : JSON.stringify(message.data)
                    }
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  )
}