'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { WebSocketMessage } from '@/types/websocket'
import {
  Send,
  Trash2,
  Download,
  Filter,
  MessageSquare,
  ArrowUp,
  ArrowDown,
  Clock,
  User,
  Bot,
  AlertCircle,
  CheckCircle,
  Info,
  Heart,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface WebSocketMessagesProps {
  messages: WebSocketMessage[]
  onSendMessage?: (message: string | object) => void
  onClearMessages?: () => void
  className?: string
  maxMessages?: number
  showSendInput?: boolean
  showControls?: boolean
}

type MessageFilter = 'all' | 'sent' | 'received' | 'heartbeat' | 'error'
type MessageFormat = 'text' | 'json'

/**
 * WebSocket消息管理组件
 * 显示消息历史、发送消息、过滤和导出功能
 */
export function WebSocketMessages({
  messages,
  onSendMessage,
  onClearMessages,
  className,
  maxMessages = 100,
  showSendInput = true,
  showControls = true,
}: WebSocketMessagesProps) {
  const [messageInput, setMessageInput] = useState('')
  const [messageFormat, setMessageFormat] = useState<MessageFormat>('text')
  const [filter, setFilter] = useState<MessageFilter>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 过滤消息
  const filteredMessages = messages.filter((message) => {
    switch (filter) {
      case 'sent':
        return message.direction === 'outgoing'
      case 'received':
        return message.direction === 'incoming'
      case 'heartbeat':
        return message.type === 'heartbeat'
      case 'error':
        return message.type === 'error'
      case 'all':
      default:
        return true
    }
  }).slice(-maxMessages)

  // 自动滚动到底部
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [filteredMessages, autoScroll])

  // 发送消息
  const handleSendMessage = () => {
    if (!messageInput.trim() || !onSendMessage) return

    try {
      if (messageFormat === 'json') {
        const jsonMessage = JSON.parse(messageInput)
        onSendMessage(jsonMessage)
      } else {
        onSendMessage(messageInput)
      }
      setMessageInput('')
    } catch (error) {
      console.error('Invalid JSON format:', error)
    }
  }

  // 导出消息
  const handleExportMessages = () => {
    const exportData = {
      timestamp: new Date().toISOString(),
      totalMessages: filteredMessages.length,
      messages: filteredMessages,
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `websocket-messages-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // 获取消息类型图标
  const getMessageIcon = (message: WebSocketMessage) => {
    if (message.direction === 'outgoing') {
      return <ArrowUp className="h-3 w-3 text-blue-500" />
    }
    
    switch (message.type) {
      case 'heartbeat':
        return <Heart className="h-3 w-3 text-pink-500" />
      case 'error':
        return <AlertCircle className="h-3 w-3 text-red-500" />
      case 'system':
        return <Bot className="h-3 w-3 text-purple-500" />
      default:
        return <ArrowDown className="h-3 w-3 text-green-500" />
    }
  }

  // 获取消息类型标签
  const getMessageBadge = (message: WebSocketMessage) => {
    const variants = {
      heartbeat: 'secondary',
      error: 'destructive',
      system: 'outline',
      message: 'default',
      ping: 'secondary',
      pong: 'secondary',
      notification: 'default',
      status: 'outline',
    } as const

    return (
      <Badge variant={variants[message.type] || 'default'} className="text-xs">
        {message.type}
      </Badge>
    )
  }

  // 格式化消息内容
  const formatMessageData = (data: any) => {
    if (typeof data === 'string') {
      return data
    }
    return JSON.stringify(data, null, 2)
  }

  // 格式化时间
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString()
  }

  return (
    <Card className={cn('flex flex-col h-full', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-5 w-5" />
            <span>WebSocket消息</span>
            <Badge variant="outline" className="text-xs">
              {filteredMessages.length}
            </Badge>
          </CardTitle>
          
          {showControls && (
            <div className="flex items-center gap-2">
              {/* 过滤器 */}
              <Select value={filter} onValueChange={(value: MessageFilter) => setFilter(value)}>
                <SelectTrigger className="w-24 h-8">
                  <Filter className="h-3 w-3" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="sent">已发送</SelectItem>
                  <SelectItem value="received">已接收</SelectItem>
                  <SelectItem value="heartbeat">心跳</SelectItem>
                  <SelectItem value="error">错误</SelectItem>
                </SelectContent>
              </Select>
              
              {/* 导出按钮 */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportMessages}
                      disabled={filteredMessages.length === 0}
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <span>导出消息</span>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              {/* 清空按钮 */}
              {onClearMessages && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onClearMessages}
                        disabled={messages.length === 0}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <span>清空消息</span>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col gap-4 p-4">
        {/* 消息列表 */}
        <ScrollArea className="flex-1 h-0" ref={scrollAreaRef}>
          <div className="space-y-2">
            {filteredMessages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>暂无消息</p>
              </div>
            ) : (
              filteredMessages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex gap-3 p-3 rounded-lg border transition-colors',
                    message.direction === 'outgoing'
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-gray-50 border-gray-200',
                    message.type === 'error' && 'bg-red-50 border-red-200'
                  )}
                >
                  {/* 消息图标 */}
                  <div className="flex-shrink-0 mt-1">
                    {getMessageIcon(message)}
                  </div>
                  
                  {/* 消息内容 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getMessageBadge(message)}
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(message.timestamp)}
                      </span>
                    </div>
                    
                    <div className="text-sm">
                      {message.type === 'error' ? (
                        <div className="text-red-600">
                          {formatMessageData(message.data)}
                        </div>
                      ) : (
                        <pre className="whitespace-pre-wrap font-mono text-xs bg-white p-2 rounded border overflow-x-auto">
                          {formatMessageData(message.data)}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
        
        {/* 发送消息输入框 */}
        {showSendInput && onSendMessage && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Select
                  value={messageFormat}
                  onValueChange={(value: MessageFormat) => setMessageFormat(value)}
                >
                  <SelectTrigger className="w-20 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">文本</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                  </SelectContent>
                </Select>
                
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Info className="h-3 w-3" />
                  <span>{messageFormat === 'json' ? 'JSON格式' : '纯文本'}</span>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Input
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder={messageFormat === 'json' ? '输入JSON消息...' : '输入消息...'}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim()}
                  size="sm"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              
              {messageFormat === 'json' && (
                <p className="text-xs text-muted-foreground">
                  提示: 输入有效的JSON格式，例如: {'{"type": "message", "content": "Hello"}'}
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * 简化的消息显示组件
 * 只显示最近的几条消息
 */
export function WebSocketMessagePreview({
  messages,
  maxMessages = 5,
  className,
}: {
  messages: WebSocketMessage[]
  maxMessages?: number
  className?: string
}) {
  const recentMessages = messages.slice(-maxMessages)

  return (
    <div className={cn('space-y-2', className)}>
      {recentMessages.length === 0 ? (
        <div className="text-center text-muted-foreground py-4">
          <MessageSquare className="h-6 w-6 mx-auto mb-1 opacity-50" />
          <p className="text-sm">暂无消息</p>
        </div>
      ) : (
        recentMessages.map((message) => (
          <div
            key={message.id}
            className="flex items-center gap-2 p-2 rounded border bg-card text-sm"
          >
            <div className="flex-shrink-0">
              {message.direction === 'outgoing' ? (
                <ArrowUp className="h-3 w-3 text-blue-500" />
              ) : (
                <ArrowDown className="h-3 w-3 text-green-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="truncate">
                {typeof message.data === 'string'
                  ? message.data
                  : JSON.stringify(message.data)
                }
              </div>
            </div>
            <div className="flex-shrink-0 text-xs text-muted-foreground">
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ))
      )}
    </div>
  )
}