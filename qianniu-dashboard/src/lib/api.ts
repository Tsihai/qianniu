/**
 * API 客户端工具类
 * 提供统一的HTTP请求接口和错误处理
 */

import { API_CONFIG } from './constants'
import type { ApiResponse, ApiError, RequestConfig } from '@/types'

/**
 * API客户端类
 */
class ApiClient {
  private baseURL: string
  private defaultTimeout: number
  private defaultRetries: number

  constructor() {
    this.baseURL = API_CONFIG.BASE_URL
    this.defaultTimeout = API_CONFIG.TIMEOUT
    this.defaultRetries = API_CONFIG.RETRY_ATTEMPTS
  }

  /**
   * 设置基础URL
   */
  setBaseURL(url: string) {
    this.baseURL = url
  }

  /**
   * 获取默认请求头
   */
  private getDefaultHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    // 添加认证token（如果存在）
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth-token')
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }
    }

    return headers
  }

  /**
   * 构建完整URL
   */
  private buildURL(endpoint: string): string {
    if (endpoint.startsWith('http')) {
      return endpoint
    }
    return `${this.baseURL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`
  }

  /**
   * 处理响应
   */
  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    const contentType = response.headers.get('content-type')
    const isJson = contentType?.includes('application/json')

    let data: any
    try {
      data = isJson ? await response.json() : await response.text()
    } catch (error) {
      throw new Error('响应解析失败')
    }

    if (!response.ok) {
      const error: ApiError = {
        message: data.message || `HTTP ${response.status}: ${response.statusText}`,
        code: response.status,
        details: data
      }
      throw error
    }

    return {
      success: true,
      data,
      code: response.status,
      timestamp: Date.now()
    }
  }

  /**
   * 执行HTTP请求
   */
  private async executeRequest<T>(
    endpoint: string,
    config: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const {
      method = 'GET',
      headers = {},
      body,
      timeout = this.defaultTimeout,
      retries = this.defaultRetries
    } = config

    const url = this.buildURL(endpoint)
    const requestHeaders = {
      ...this.getDefaultHeaders(),
      ...headers
    }

    const requestConfig: RequestInit = {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined
    }

    // 创建超时控制器
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)
    requestConfig.signal = controller.signal

    let lastError: any
    
    // 重试逻辑
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, requestConfig)
        clearTimeout(timeoutId)
        return await this.handleResponse<T>(response)
      } catch (error: any) {
        lastError = error
        
        // 如果是最后一次尝试或者是非网络错误，直接抛出
        if (attempt === retries || error.name === 'AbortError') {
          break
        }
        
        // 等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
      }
    }

    clearTimeout(timeoutId)
    
    // 处理不同类型的错误
    if (lastError.name === 'AbortError') {
      throw new Error('请求超时')
    }
    
    throw lastError
  }

  /**
   * GET 请求
   */
  async get<T = any>(
    endpoint: string,
    params?: Record<string, any>,
    config?: Omit<RequestConfig, 'method' | 'body'>
  ): Promise<ApiResponse<T>> {
    let url = endpoint
    
    if (params) {
      const searchParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value))
        }
      })
      url += `?${searchParams.toString()}`
    }

    return this.executeRequest<T>(url, { ...config, method: 'GET' })
  }

  /**
   * POST 请求
   */
  async post<T = any>(
    endpoint: string,
    data?: any,
    config?: Omit<RequestConfig, 'method'>
  ): Promise<ApiResponse<T>> {
    return this.executeRequest<T>(endpoint, {
      ...config,
      method: 'POST',
      body: data
    })
  }

  /**
   * PUT 请求
   */
  async put<T = any>(
    endpoint: string,
    data?: any,
    config?: Omit<RequestConfig, 'method'>
  ): Promise<ApiResponse<T>> {
    return this.executeRequest<T>(endpoint, {
      ...config,
      method: 'PUT',
      body: data
    })
  }

  /**
   * DELETE 请求
   */
  async delete<T = any>(
    endpoint: string,
    config?: Omit<RequestConfig, 'method' | 'body'>
  ): Promise<ApiResponse<T>> {
    return this.executeRequest<T>(endpoint, { ...config, method: 'DELETE' })
  }

  /**
   * PATCH 请求
   */
  async patch<T = any>(
    endpoint: string,
    data?: any,
    config?: Omit<RequestConfig, 'method'>
  ): Promise<ApiResponse<T>> {
    return this.executeRequest<T>(endpoint, {
      ...config,
      method: 'PATCH',
      body: data
    })
  }

  /**
   * 上传文件
   */
  async upload<T = any>(
    endpoint: string,
    file: File,
    additionalData?: Record<string, any>,
    config?: Omit<RequestConfig, 'method' | 'body'>
  ): Promise<ApiResponse<T>> {
    const formData = new FormData()
    formData.append('file', file)
    
    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, String(value))
      })
    }

    const headers = { ...config?.headers }
    // 删除 Content-Type，让浏览器自动设置
    delete headers['Content-Type']

    return this.executeRequest<T>(endpoint, {
      ...config,
      method: 'POST',
      headers,
      body: formData
    })
  }

  /**
   * 下载文件
   */
  async download(
    endpoint: string,
    filename?: string,
    config?: Omit<RequestConfig, 'method' | 'body'>
  ): Promise<void> {
    const url = this.buildURL(endpoint)
    const headers = {
      ...this.getDefaultHeaders(),
      ...config?.headers
    }

    const response = await fetch(url, {
      method: 'GET',
      headers
    })

    if (!response.ok) {
      throw new Error(`下载失败: ${response.statusText}`)
    }

    const blob = await response.blob()
    const downloadUrl = window.URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = filename || 'download'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    window.URL.revokeObjectURL(downloadUrl)
  }
}

// 创建默认API客户端实例
export const apiClient = new ApiClient()

// 导出便捷方法
export const api = {
  get: apiClient.get.bind(apiClient),
  post: apiClient.post.bind(apiClient),
  put: apiClient.put.bind(apiClient),
  delete: apiClient.delete.bind(apiClient),
  patch: apiClient.patch.bind(apiClient),
  upload: apiClient.upload.bind(apiClient),
  download: apiClient.download.bind(apiClient)
}

// 类型已从 @/types 导入，无需重复导出