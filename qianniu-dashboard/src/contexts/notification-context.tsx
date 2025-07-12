"use client"

import React, { createContext, useContext, useReducer, ReactNode, useCallback } from 'react'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

// 通知类型
export type NotificationType = 'success' | 'error' | 'warning' | 'info'

// 通知接口
export interface NotificationItem {
  id: string
  type: NotificationType
  title: string
  message?: string
  duration?: number // 自动关闭时间（毫秒），0表示不自动关闭
  action?: {
    label: string
    onClick: () => void
  }
  timestamp: number
}

// 通知状态
interface NotificationState {
  notifications: NotificationItem[]
  maxNotifications: number
}

// 通知动作
type NotificationAction =
  | { type: 'ADD_NOTIFICATION'; payload: NotificationItem }
  | { type: 'REMOVE_NOTIFICATION'; payload: string }
  | { type: 'CLEAR_ALL' }
  | { type: 'SET_MAX_NOTIFICATIONS'; payload: number }

// 初始状态
const initialState: NotificationState = {
  notifications: [],
  maxNotifications: 5
}

// Reducer
function notificationReducer(state: NotificationState, action: NotificationAction): NotificationState {
  switch (action.type) {
    case 'ADD_NOTIFICATION': {
      const newNotifications = [action.payload, ...state.notifications]
      // 限制通知数量
      if (newNotifications.length > state.maxNotifications) {
        newNotifications.splice(state.maxNotifications)
      }
      return {
        ...state,
        notifications: newNotifications
      }
    }
    case 'REMOVE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload)
      }
    case 'CLEAR_ALL':
      return {
        ...state,
        notifications: []
      }
    case 'SET_MAX_NOTIFICATIONS':
      return {
        ...state,
        maxNotifications: action.payload
      }
    default:
      return state
  }
}

// Context接口
interface NotificationContextType {
  notifications: NotificationItem[]
  addNotification: (notification: Omit<NotificationItem, 'id' | 'timestamp'>) => string
  removeNotification: (id: string) => void
  clearAll: () => void
  success: (title: string, message?: string, options?: Partial<NotificationItem>) => string
  error: (title: string, message?: string, options?: Partial<NotificationItem>) => string
  warning: (title: string, message?: string, options?: Partial<NotificationItem>) => string
  info: (title: string, message?: string, options?: Partial<NotificationItem>) => string
}

// 创建Context
const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

// 生成唯一ID
function generateId(): string {
  return `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Provider组件
export function NotificationProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(notificationReducer, initialState)

  // 添加通知
  const addNotification = useCallback((notification: Omit<NotificationItem, 'id' | 'timestamp'>) => {
    const id = generateId()
    const newNotification: NotificationItem = {
      ...notification,
      id,
      timestamp: Date.now(),
      duration: notification.duration ?? 5000 // 默认5秒
    }

    dispatch({ type: 'ADD_NOTIFICATION', payload: newNotification })

    // 自动移除通知
    if (newNotification.duration && newNotification.duration > 0) {
      setTimeout(() => {
        dispatch({ type: 'REMOVE_NOTIFICATION', payload: id })
      }, newNotification.duration)
    }

    return id
  }, [])

  // 移除通知
  const removeNotification = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_NOTIFICATION', payload: id })
  }, [])

  // 清空所有通知
  const clearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' })
  }, [])

  // 便捷方法
  const success = useCallback((title: string, message?: string, options?: Partial<NotificationItem>) => {
    return addNotification({ ...options, type: 'success', title, message })
  }, [addNotification])

  const error = useCallback((title: string, message?: string, options?: Partial<NotificationItem>) => {
    return addNotification({ ...options, type: 'error', title, message, duration: 0 }) // 错误通知不自动关闭
  }, [addNotification])

  const warning = useCallback((title: string, message?: string, options?: Partial<NotificationItem>) => {
    return addNotification({ ...options, type: 'warning', title, message })
  }, [addNotification])

  const info = useCallback((title: string, message?: string, options?: Partial<NotificationItem>) => {
    return addNotification({ ...options, type: 'info', title, message })
  }, [addNotification])

  const value: NotificationContextType = {
    notifications: state.notifications,
    addNotification,
    removeNotification,
    clearAll,
    success,
    error,
    warning,
    info
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationContainer />
    </NotificationContext.Provider>
  )
}

// Hook for using notifications
export function useNotifications() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}

// 通知容器组件
function NotificationContainer() {
  const { notifications, removeNotification } = useNotifications()

  if (notifications.length === 0) {
    return null
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onClose={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  )
}

// 单个通知组件
function NotificationItem({ 
  notification, 
  onClose 
}: { 
  notification: NotificationItem
  onClose: () => void 
}) {
  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case 'info':
        return <Info className="h-5 w-5 text-blue-500" />
      default:
        return null
    }
  }

  const getBorderColor = () => {
    switch (notification.type) {
      case 'success':
        return 'border-l-green-500'
      case 'error':
        return 'border-l-red-500'
      case 'warning':
        return 'border-l-yellow-500'
      case 'info':
        return 'border-l-blue-500'
      default:
        return 'border-l-gray-500'
    }
  }

  return (
    <div className={cn(
      'bg-background border border-l-4 rounded-lg shadow-lg p-4 transition-all duration-300 ease-in-out',
      'animate-in slide-in-from-right-full',
      getBorderColor()
    )}>
      <div className="flex items-start gap-3">
        {getIcon()}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm">{notification.title}</h4>
          {notification.message && (
            <p className="text-sm text-muted-foreground mt-1">
              {notification.message}
            </p>
          )}
          {notification.action && (
            <button
              onClick={notification.action.onClick}
              className="text-sm text-primary hover:underline mt-2"
            >
              {notification.action.label}
            </button>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// 导出类型已在文件开头定义