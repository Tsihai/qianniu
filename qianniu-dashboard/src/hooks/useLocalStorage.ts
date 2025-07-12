"use client"

import { useState, useEffect, useCallback } from 'react'

/**
 * useLocalStorage Hook
 * 管理localStorage中的数据，提供类型安全的存储和读取功能
 * 
 * @param key - localStorage的键名
 * @param initialValue - 初始值
 * @returns [value, setValue, removeValue] - 当前值、设置值函数、删除值函数
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void, () => void] {
  // 获取初始值
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue
    }
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (_error) {
      console.warn(`Error reading localStorage key "${key}":`, _error)
      return initialValue
    }
  })

  // 设置值函数
  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        // 允许传入函数来更新值
        const valueToStore = value instanceof Function ? value(storedValue) : value
        setStoredValue(valueToStore)
        
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(valueToStore))
        }
      } catch (_error) {
        console.warn(`Error setting localStorage key "${key}":`, _error)
      }
    },
    [key, storedValue]
  )

  // 删除值函数
  const removeValue = useCallback(() => {
    try {
      setStoredValue(initialValue)
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key)
      }
    } catch (_error) {
      console.warn(`Error removing localStorage key "${key}":`, _error)
    }
  }, [key, initialValue])

  // 监听其他标签页的localStorage变化
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setStoredValue(JSON.parse(e.newValue))
        } catch (_error) {
          console.warn(`Error parsing localStorage value for key "${key}":`, _error)
        }
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange)
      return () => window.removeEventListener('storage', handleStorageChange)
    }
  }, [key])

  return [storedValue, setValue, removeValue]
}

/**
 * useSessionStorage Hook
 * 管理sessionStorage中的数据，提供类型安全的存储和读取功能
 * 
 * @param key - sessionStorage的键名
 * @param initialValue - 初始值
 * @returns [value, setValue, removeValue] - 当前值、设置值函数、删除值函数
 */
export function useSessionStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void, () => void] {
  // 获取初始值
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue
    }
    try {
      const item = window.sessionStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (_error) {
      console.warn(`Error reading sessionStorage key "${key}":`, _error)
      return initialValue
    }
  })

  // 设置值函数
  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        // 允许传入函数来更新值
        const valueToStore = value instanceof Function ? value(storedValue) : value
        setStoredValue(valueToStore)
        
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(key, JSON.stringify(valueToStore))
        }
      } catch (_error) {
        console.warn(`Error setting sessionStorage key "${key}":`, _error)
      }
    },
    [key, storedValue]
  )

  // 删除值函数
  const removeValue = useCallback(() => {
    try {
      setStoredValue(initialValue)
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(key)
      }
    } catch (_error) {
      console.warn(`Error removing sessionStorage key "${key}":`, _error)
    }
  }, [key, initialValue])

  return [storedValue, setValue, removeValue]
}

/**
 * 用户偏好设置类型
 */
export interface UserPreferences {
  theme: 'light' | 'dark' | 'system'
  language: 'zh-CN' | 'en-US'
  autoRefresh: boolean
  refreshInterval: number
  defaultPage: string
  sidebarCollapsed: boolean
}

/**
 * 默认用户偏好设置
 */
const defaultPreferences: UserPreferences = {
  theme: 'system',
  language: 'zh-CN',
  autoRefresh: true,
  refreshInterval: 30000, // 30秒
  defaultPage: '/dashboard',
  sidebarCollapsed: false
}

/**
 * useUserPreferences Hook
 * 管理用户偏好设置
 */
export function useUserPreferences() {
  return useLocalStorage<UserPreferences>('user-preferences', defaultPreferences)
}