"use client"

import React, { createContext, useContext, useReducer, ReactNode } from 'react'
import type { Agent, Message, SystemStats, Notification } from '@/types'

// 应用状态接口
export interface AppState {
  // 用户信息
  user: {
    id: string
    name: string
    role: string
    avatar?: string
  } | null
  
  // 系统状态
  system: {
    isLoading: boolean
    isConnected: boolean
    lastUpdate: number
    error: string | null
  }
  
  // 实时数据
  realTime: {
    messages: Message[]
    agents: Agent[]
    systemStats: SystemStats | null
    notifications: Notification[]
  }
  
  // UI状态
  ui: {
    sidebarCollapsed: boolean
    theme: 'light' | 'dark' | 'system'
    activeTab: string
    selectedMessageId: string | null
  }
  
  // 设置
  settings: {
    autoRefresh: boolean
    refreshInterval: number
    notificationsEnabled: boolean
    soundEnabled: boolean
  }
}

// 动作类型
export type AppAction =
  // 用户相关
  | { type: 'SET_USER'; payload: AppState['user'] }
  | { type: 'LOGOUT' }
  
  // 系统状态
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_CONNECTED'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'UPDATE_LAST_UPDATE' }
  
  // 实时数据
  | { type: 'SET_MESSAGES'; payload: Message[] }
  | { type: 'ADD_MESSAGE'; payload: Message }
  | { type: 'UPDATE_MESSAGE'; payload: { id: string; updates: Partial<Message> } }
  | { type: 'SET_AGENTS'; payload: Agent[] }
  | { type: 'UPDATE_AGENT'; payload: { id: string; updates: Partial<Agent> } }
  | { type: 'SET_SYSTEM_STATS'; payload: SystemStats }
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'REMOVE_NOTIFICATION'; payload: string }
  | { type: 'CLEAR_NOTIFICATIONS' }
  
  // UI状态
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_SIDEBAR_COLLAPSED'; payload: boolean }
  | { type: 'SET_THEME'; payload: AppState['ui']['theme'] }
  | { type: 'SET_ACTIVE_TAB'; payload: string }
  | { type: 'SET_SELECTED_MESSAGE'; payload: string | null }
  
  // 设置
  | { type: 'UPDATE_SETTINGS'; payload: Partial<AppState['settings']> }
  | { type: 'RESET_SETTINGS' }

// 初始状态
const initialState: AppState = {
  user: null,
  system: {
    isLoading: false,
    isConnected: false,
    lastUpdate: Date.now(),
    error: null
  },
  realTime: {
    messages: [],
    agents: [],
    systemStats: null,
    notifications: []
  },
  ui: {
    sidebarCollapsed: false,
    theme: 'system',
    activeTab: 'dashboard',
    selectedMessageId: null
  },
  settings: {
    autoRefresh: true,
    refreshInterval: 30000, // 30秒
    notificationsEnabled: true,
    soundEnabled: true
  }
}

// Reducer函数
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    // 用户相关
    case 'SET_USER':
      return { ...state, user: action.payload }
    case 'LOGOUT':
      return { ...state, user: null }
    
    // 系统状态
    case 'SET_LOADING':
      return { ...state, system: { ...state.system, isLoading: action.payload } }
    case 'SET_CONNECTED':
      return { ...state, system: { ...state.system, isConnected: action.payload } }
    case 'SET_ERROR':
      return { ...state, system: { ...state.system, error: action.payload } }
    case 'UPDATE_LAST_UPDATE':
      return { ...state, system: { ...state.system, lastUpdate: Date.now() } }
    
    // 实时数据
    case 'SET_MESSAGES':
      return { ...state, realTime: { ...state.realTime, messages: action.payload } }
    case 'ADD_MESSAGE':
      return {
        ...state,
        realTime: {
          ...state.realTime,
          messages: [action.payload, ...state.realTime.messages]
        }
      }
    case 'UPDATE_MESSAGE':
      return {
        ...state,
        realTime: {
          ...state.realTime,
          messages: state.realTime.messages.map(msg =>
            msg.id === action.payload.id ? { ...msg, ...action.payload.updates } : msg
          )
        }
      }
    case 'SET_AGENTS':
      return { ...state, realTime: { ...state.realTime, agents: action.payload } }
    case 'UPDATE_AGENT':
      return {
        ...state,
        realTime: {
          ...state.realTime,
          agents: state.realTime.agents.map(agent =>
            agent.id === action.payload.id ? { ...agent, ...action.payload.updates } : agent
          )
        }
      }
    case 'SET_SYSTEM_STATS':
      return { ...state, realTime: { ...state.realTime, systemStats: action.payload } }
    case 'ADD_NOTIFICATION':
      return {
        ...state,
        realTime: {
          ...state.realTime,
          notifications: [action.payload, ...state.realTime.notifications]
        }
      }
    case 'REMOVE_NOTIFICATION':
      return {
        ...state,
        realTime: {
          ...state.realTime,
          notifications: state.realTime.notifications.filter(n => n.id !== action.payload)
        }
      }
    case 'CLEAR_NOTIFICATIONS':
      return { ...state, realTime: { ...state.realTime, notifications: [] } }
    
    // UI状态
    case 'TOGGLE_SIDEBAR':
      return {
        ...state,
        ui: { ...state.ui, sidebarCollapsed: !state.ui.sidebarCollapsed }
      }
    case 'SET_SIDEBAR_COLLAPSED':
      return { ...state, ui: { ...state.ui, sidebarCollapsed: action.payload } }
    case 'SET_THEME':
      return { ...state, ui: { ...state.ui, theme: action.payload } }
    case 'SET_ACTIVE_TAB':
      return { ...state, ui: { ...state.ui, activeTab: action.payload } }
    case 'SET_SELECTED_MESSAGE':
      return { ...state, ui: { ...state.ui, selectedMessageId: action.payload } }
    
    // 设置
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } }
    case 'RESET_SETTINGS':
      return { ...state, settings: initialState.settings }
    
    default:
      return state
  }
}

// Context接口
interface AppContextType {
  state: AppState
  dispatch: React.Dispatch<AppAction>
}

// 创建Context
const AppContext = createContext<AppContextType | undefined>(undefined)

// Provider组件
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState)

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  )
}

// Hook for using the context
export function useAppContext() {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider')
  }
  return context
}

// 便捷的选择器hooks
export function useAppState() {
  const { state } = useAppContext()
  return state
}

export function useAppDispatch() {
  const { dispatch } = useAppContext()
  return dispatch
}

// 特定状态的选择器
export function useUser() {
  const { state } = useAppContext()
  return state.user
}

export function useSystemStatus() {
  const { state } = useAppContext()
  return state.system
}

export function useRealTimeData() {
  const { state } = useAppContext()
  return state.realTime
}

export function useUIState() {
  const { state } = useAppContext()
  return state.ui
}

export function useSettings() {
  const { state } = useAppContext()
  return state.settings
}