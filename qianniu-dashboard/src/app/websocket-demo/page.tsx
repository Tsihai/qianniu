'use client'

import dynamic from 'next/dynamic'
import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  WebSocketStatus,
  WebSocketIndicator,
  useWebSocket,
} from '@/components/websocket'
import type { ConnectionState } from '@/types/websocket'
import {
  Activity,
  Code,
  Zap,
  Shield,
  MessageSquare,
  Settings,
  Bug,
  Wifi,
} from 'lucide-react'
import { WEBSOCKET_CONFIG } from '@/lib/constants'

// 动态导入组件以避免SSR问题
const WebSocketDebugPanel = dynamic(() => import('@/components/websocket/WebSocketDebugPanel').then(mod => ({ default: mod.WebSocketDebugPanel })), { ssr: false })
const WebSocketMessages = dynamic(() => import('@/components/websocket/WebSocketMessages').then(mod => ({ default: mod.WebSocketMessages })), { ssr: false })
const WebSocketDebugTool = dynamic(() => import('@/components/websocket').then(mod => ({ default: mod.WebSocketDebugTool })), { ssr: false })

/**
 * WebSocket功能演示页面
 * 展示各种WebSocket组件和Hook的使用方法
 */
export default function WebSocketDemoPage() {
  // WebSocket连接实例
  const enhancedWS = useWebSocket({
    url: WEBSOCKET_CONFIG.URL,
    onOpen: () => console.log('Enhanced WebSocket连接已建立'),
    onClose: () => console.log('Enhanced WebSocket连接已关闭'),
    onError: (error: any) => console.error('Enhanced WebSocket连接错误:', error),
    onMessage: (message: any) => console.log('Enhanced收到WebSocket消息:', message)
  })
  
  const simpleWS = useWebSocket({
    url: WEBSOCKET_CONFIG.URL,
    onOpen: () => console.log('Simple WebSocket连接已建立'),
    onClose: () => console.log('Simple WebSocket连接已关闭'),
    onError: (error: any) => console.error('Simple WebSocket连接错误:', error),
    onMessage: (message: any) => console.log('Simple收到WebSocket消息:', message)
  })

  // 初始状态
  const [wsConnections, setWsConnections] = React.useState({
    enhancedWS: {
      connectionStatus: 'disconnected',
      readyState: -1,
      sendMessage: (msg: string) => console.log('发送消息:', msg),
    },
    simpleWS: {
      connectionStatus: 'disconnected',
      readyState: -1,
    },
    reliableWS: {
      connectionStatus: 'disconnected',
      readyState: -1,
    }
  })

  // 模拟增强功能的属性
  const enhancedWSWithMockProps = {
    ...enhancedWS,
    connectionState: enhancedWS.connectionState || 'disconnected',
    connectionInfo: { 
      url: WEBSOCKET_CONFIG.URL, 
      readyState: enhancedWS.readyState || -1,
      connectionState: enhancedWS.connectionState || 'disconnected',
      reconnectAttempts: 0,
      latency: 45
    },
    statistics: { 
      messagesSent: 0, 
      messagesReceived: 0, 
      reconnectCount: 0,
      errorCount: 0,
      totalUptime: 0,
      averageLatency: 0,
      connectionQuality: 'good' as const
    },
    messageHistory: [],
    connect: enhancedWS.connect || (() => console.log('连接Enhanced WebSocket')),
    disconnect: enhancedWS.disconnect || (() => console.log('断开Enhanced WebSocket')),
    sendMessage: enhancedWS.sendMessage || ((msg: string) => console.log('发送消息:', msg)),
    sendJsonMessage: enhancedWS.sendJsonMessage || ((message: unknown) => console.log('发送JSON消息:', message))
  }

  // 更新连接状态
  React.useEffect(() => {
    setWsConnections({
      enhancedWS: {
        connectionStatus: enhancedWS.connectionState || 'disconnected',
        readyState: enhancedWS.readyState || -1,
        sendMessage: enhancedWS.sendMessage || ((msg: string) => console.log('发送消息:', msg)),
      },
      simpleWS: {
        connectionStatus: simpleWS.connectionState || 'disconnected',
        readyState: simpleWS.readyState || -1,
      },
      reliableWS: {
        connectionStatus: 'connecting',
        readyState: 0,
      }
    })
  }, [enhancedWS.connectionState, enhancedWS.readyState, simpleWS.connectionState, simpleWS.readyState])

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 页面标题 */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Wifi className="h-8 w-8 text-blue-500" />
          WebSocket连接管理演示
        </h1>
        <p className="text-muted-foreground">
          展示WebSocket客户端连接管理的各种功能和组件使用方法
        </p>
      </div>

      {/* 功能概览 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Activity className="h-8 w-8 text-green-500" />
              <div>
                <h3 className="font-semibold">自动重连</h3>
                <p className="text-sm text-muted-foreground">指数退避重连策略</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Zap className="h-8 w-8 text-yellow-500" />
              <div>
                <h3 className="font-semibold">心跳检测</h3>
                <p className="text-sm text-muted-foreground">自动心跳保活机制</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-8 w-8 text-blue-500" />
              <div>
                <h3 className="font-semibold">消息队列</h3>
                <p className="text-sm text-muted-foreground">离线消息缓存</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-purple-500" />
              <div>
                <h3 className="font-semibold">状态管理</h3>
                <p className="text-sm text-muted-foreground">完整的连接状态</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 主要演示内容 */}
      <Tabs defaultValue="debug-panel" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="debug-panel" className="flex items-center gap-2">
            <Bug className="h-4 w-4" />
            调试面板
          </TabsTrigger>
          <TabsTrigger value="components" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            组件展示
          </TabsTrigger>
          <TabsTrigger value="hooks" className="flex items-center gap-2">
            <Code className="h-4 w-4" />
            Hook示例
          </TabsTrigger>
          <TabsTrigger value="tools" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            调试工具
          </TabsTrigger>
        </TabsList>

        {/* 调试面板 */}
        <TabsContent value="debug-panel" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bug className="h-5 w-5" />
                完整调试面板
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WebSocketDebugPanel
                defaultUrl={WEBSOCKET_CONFIG.URL}
                autoConnect={false}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* 组件展示 */}
        <TabsContent value="components" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 连接状态组件 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">连接状态组件</CardTitle>
              </CardHeader>
              <CardContent>
                <WebSocketStatus
                  connectionState={enhancedWSWithMockProps.connectionState}
                  readyState={enhancedWSWithMockProps.readyState}
                  connectionInfo={enhancedWSWithMockProps.connectionInfo}
                  statistics={enhancedWSWithMockProps.statistics}
                  onReconnect={enhancedWSWithMockProps.connect}
                  onDisconnect={enhancedWSWithMockProps.disconnect}
                />
              </CardContent>
            </Card>

            {/* 消息管理组件 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">消息管理组件</CardTitle>
              </CardHeader>
              <CardContent>
                <WebSocketMessages
                  messages={enhancedWSWithMockProps.messageHistory}
                  onSendMessage={(message: string | object) => {
                    if (typeof message === 'string') {
                      enhancedWSWithMockProps.sendMessage(message)
                    } else {
                      enhancedWSWithMockProps.sendJsonMessage(message)
                    }
                  }}
                  onClearMessages={() => console.log('清除消息历史')}
                  className="h-[400px]"
                />
              </CardContent>
            </Card>
          </div>

          {/* 状态指示器 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">状态指示器</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm">Enhanced WebSocket:</span>
                  <WebSocketIndicator connectionState={enhancedWSWithMockProps.connectionState} />
                  <Badge variant="outline" className="text-xs">
                    {enhancedWSWithMockProps.connectionState}
                  </Badge>
                </div>
                <Separator orientation="vertical" className="h-6" />
                <div className="flex items-center gap-2">
                  <span className="text-sm">Simple WebSocket:</span>
                  <WebSocketIndicator connectionState={wsConnections.simpleWS.connectionStatus as ConnectionState} />
                  <Badge variant="outline" className="text-xs">
                    {wsConnections.simpleWS.connectionStatus}
                  </Badge>
                </div>
                <Separator orientation="vertical" className="h-6" />
                <div className="flex items-center gap-2">
                  <span className="text-sm">Reliable WebSocket:</span>
                  <WebSocketIndicator connectionState={wsConnections.reliableWS.connectionStatus as ConnectionState} />
                  <Badge variant="outline" className="text-xs">
                    {wsConnections.reliableWS.connectionStatus}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Hook示例 */}
        <TabsContent value="hooks" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Enhanced WebSocket Hook */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Enhanced Hook
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>状态:</span>
                    <Badge variant="outline">{enhancedWSWithMockProps.connectionState}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>消息数:</span>
                    <span>{enhancedWSWithMockProps.messageHistory.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>重连次数:</span>
                    <span>{enhancedWSWithMockProps.statistics.reconnectCount}</span>
                  </div>
                </div>
                <Separator />
                <div className="flex gap-2">
                  {enhancedWSWithMockProps.connectionState === 'disconnected' ? (
                    <button
                      onClick={enhancedWSWithMockProps.connect}
                      className="flex-1 px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      连接
                    </button>
                  ) : (
                    <button
                      onClick={enhancedWSWithMockProps.disconnect}
                      className="flex-1 px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      断开
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Simple WebSocket Hook */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  Simple Hook
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>状态:</span>
                    <Badge variant="outline">{wsConnections.simpleWS.connectionStatus}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>连接状态:</span>
                    <span>{wsConnections.simpleWS.connectionStatus === 'connected' ? '已连接' : '未连接'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>最后消息:</span>
                    <span>{simpleWS.lastMessage ? '有消息' : '无消息'}</span>
                  </div>
                </div>
                <Separator />
                <div className="flex gap-2">
                  {wsConnections.simpleWS.connectionStatus !== 'connected' ? (
                    <button
                      onClick={() => console.log('连接Simple WebSocket')}
                      className="flex-1 px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                    >
                      连接
                    </button>
                  ) : (
                    <button
                      onClick={() => console.log('断开Simple WebSocket')}
                      className="flex-1 px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      断开
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Reliable WebSocket Hook */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Reliable Hook
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>状态:</span>
                    <Badge variant="outline">{wsConnections.reliableWS.connectionStatus}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>消息数:</span>
                    <span>0</span>
                  </div>
                  <div className="flex justify-between">
                    <span>连接质量:</span>
                    <Badge variant="secondary">良好</Badge>
                  </div>
                </div>
                <Separator />
                <div className="flex gap-2">
                  {wsConnections.reliableWS.connectionStatus === 'disconnected' ? (
                    <button
                      onClick={() => console.log('连接Reliable WebSocket')}
                      className="flex-1 px-3 py-1 text-xs bg-purple-500 text-white rounded hover:bg-purple-600"
                    >
                      连接
                    </button>
                  ) : (
                    <button
                      onClick={() => console.log('断开Reliable WebSocket')}
                      className="flex-1 px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      断开
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 代码示例 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">使用示例代码</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto">
{`// WebSocket Hook 基础用法
const {
  lastMessage,
  lastJsonMessage,
  sendMessage,
  sendJsonMessage,
  readyState,
  getWebSocket,
} = useWebSocket('ws://localhost:8080/ws', {
  onOpen: () => console.log('WebSocket连接已建立'),
  onClose: () => console.log('WebSocket连接已关闭'),
  onError: (event) => console.error('WebSocket错误:', event),
  onMessage: (event) => console.log('收到消息:', event.data),
  shouldReconnect: (closeEvent) => true,
  reconnectAttempts: 10,
  reconnectInterval: 3000,
})

// 发送消息示例
sendMessage('Hello WebSocket!')
sendJsonMessage({ type: 'greeting', message: 'Hello!' })

// 连接状态检查
const connectionStatus = {
  [WebSocketReadyState.CONNECTING]: 'connecting',
  [WebSocketReadyState.OPEN]: 'connected',
  [WebSocketReadyState.CLOSING]: 'closing',
  [WebSocketReadyState.CLOSED]: 'disconnected',
}[readyState]`}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 调试工具 */}
        <TabsContent value="tools" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <WebSocketDebugTool url={WEBSOCKET_CONFIG.URL} />
            <WebSocketDebugTool url="ws://localhost:8081/ws" />
            <WebSocketDebugTool url="ws://localhost:8082/ws" />
          </div>

          {/* 工具说明 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">调试工具说明</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <h4 className="font-semibold">主要功能:</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• 快速连接/断开WebSocket</li>
                    <li>• 实时显示连接状态</li>
                    <li>• 消息发送和接收统计</li>
                    <li>• 一键发送测试消息</li>
                    <li>• 消息历史查看</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">适用场景:</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• 开发环境调试</li>
                    <li>• 连接状态监控</li>
                    <li>• 快速功能测试</li>
                    <li>• 多服务器连接测试</li>
                    <li>• 性能问题排查</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}