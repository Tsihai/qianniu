/**
 * WebSocket组件导出文件
 * 提供完整的WebSocket客户端连接管理组件
 */

// 核心组件
export { WebSocketStatus, WebSocketIndicator } from './WebSocketStatus'
export { WebSocketMessages, WebSocketMessagePreview } from './WebSocketMessages'
export { WebSocketDebugPanel, WebSocketDebugTool } from './WebSocketDebugPanel'

// 类型定义
export type {
  WebSocketReadyState,
  ConnectionState,
  WebSocketMessage,
  HeartbeatConfig,
  ReconnectConfig,
  WebSocketConfig,
  ConnectionInfo,
  WebSocketEvents,
  QueuedMessage,
  WebSocketStats,
  UseWebSocketReturn,
  UseWebSocketOptions,
  WebSocketError,
} from '@/types/websocket'

// Hook导出
export {
  useWebSocket,
} from '@/hooks/useWebSocket'

// 核心类导出
export { WebSocketClient } from '@/lib/websocket'

// 常量导出
export {
  DEFAULT_WEBSOCKET_CONFIG,
  DEFAULT_HEARTBEAT_CONFIG,
  DEFAULT_RECONNECT_CONFIG,
} from '@/types/websocket'