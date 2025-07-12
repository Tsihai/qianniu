"use client"

import React, { useMemo, useCallback } from "react"
import { Chart, ChartProps } from "@/components/ui/chart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  Activity, 
  Cpu, 
  HardDrive, 
  MemoryStick, 
  Thermometer,
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown
} from "lucide-react"
import { cn } from "@/lib/utils"

// 系统健康数据接口
export interface SystemHealthDataPoint {
  timestamp: string | number
  cpuUsage: number // CPU使用率 (%)
  memoryUsage: number // 内存使用率 (%)
  diskUsage: number // 磁盘使用率 (%)
  temperature: number // 温度 (°C)
  powerConsumption: number // 功耗 (W)
  networkIO: number // 网络IO (MB/s)
  diskIO: number // 磁盘IO (MB/s)
  processCount: number // 进程数
  threadCount: number // 线程数
  uptime: number // 运行时间 (hours)
  loadAverage: number // 负载平均值
  [key: string]: string | number
}

// 系统健康状态
export type SystemHealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown'

// SystemHealthChart属性接口
export interface SystemHealthChartProps extends Omit<ChartProps, 'data' | 'xKey' | 'yKey' | 'config'> {
  data: SystemHealthDataPoint[]
  showHealthScore?: boolean
  showResourceCards?: boolean
  showAlerts?: boolean
  thresholds?: {
    cpu: { warning: number; critical: number }
    memory: { warning: number; critical: number }
    disk: { warning: number; critical: number }
    temperature: { warning: number; critical: number }
  }
  onHealthChange?: (status: SystemHealthStatus, score: number) => void
  onAlert?: (alerts: SystemAlert[]) => void
}

// 系统警告接口
export interface SystemAlert {
  id: string
  type: 'cpu' | 'memory' | 'disk' | 'temperature' | 'load'
  level: 'warning' | 'critical'
  message: string
  value: number
  threshold: number
  timestamp: number
}

// 默认阈值
const DEFAULT_THRESHOLDS = {
  cpu: { warning: 70, critical: 90 },
  memory: { warning: 80, critical: 95 },
  disk: { warning: 85, critical: 95 },
  temperature: { warning: 70, critical: 85 }
}

// 系统健康评估函数
const assessSystemHealth = (
  data: SystemHealthDataPoint,
  thresholds: typeof DEFAULT_THRESHOLDS
): { status: SystemHealthStatus; score: number; alerts: SystemAlert[] } => {
  const { cpuUsage, memoryUsage, diskUsage, temperature, loadAverage } = data
  const alerts: SystemAlert[] = []
  const timestamp = Date.now()
  
  // 检查各项指标并生成警告
  const metrics = [
    { key: 'cpu', value: cpuUsage, thresholds: thresholds.cpu, label: 'CPU使用率' },
    { key: 'memory', value: memoryUsage, thresholds: thresholds.memory, label: '内存使用率' },
    { key: 'disk', value: diskUsage, thresholds: thresholds.disk, label: '磁盘使用率' },
    { key: 'temperature', value: temperature, thresholds: thresholds.temperature, label: '系统温度' }
  ]
  
  let criticalCount = 0
  let warningCount = 0
  
  metrics.forEach(metric => {
    if (metric.value >= metric.thresholds.critical) {
      criticalCount++
      alerts.push({
        id: `${metric.key}-critical-${timestamp}`,
        type: metric.key as 'cpu' | 'memory' | 'disk' | 'temperature',
        level: 'critical',
        message: `${metric.label}达到严重水平: ${metric.value.toFixed(1)}%`,
        value: metric.value,
        threshold: metric.thresholds.critical,
        timestamp
      })
    } else if (metric.value >= metric.thresholds.warning) {
      warningCount++
      alerts.push({
        id: `${metric.key}-warning-${timestamp}`,
        type: metric.key as 'cpu' | 'memory' | 'disk' | 'temperature',
        level: 'warning',
        message: `${metric.label}超过警告阈值: ${metric.value.toFixed(1)}%`,
        value: metric.value,
        threshold: metric.thresholds.warning,
        timestamp
      })
    }
  })
  
  // 检查负载平均值
  if (loadAverage > 2.0) {
    const level = loadAverage > 4.0 ? 'critical' : 'warning'
    if (level === 'critical') criticalCount++
    else warningCount++
    
    alerts.push({
      id: `load-${level}-${timestamp}`,
      type: 'load',
      level,
      message: `系统负载过高: ${loadAverage.toFixed(2)}`,
      value: loadAverage,
      threshold: level === 'critical' ? 4.0 : 2.0,
      timestamp
    })
  }
  
  // 计算健康得分
  const cpuScore = Math.max(0, 100 - cpuUsage)
  const memoryScore = Math.max(0, 100 - memoryUsage)
  const diskScore = Math.max(0, 100 - diskUsage)
  const tempScore = Math.max(0, 100 - (temperature / 100 * 100))
  const loadScore = Math.max(0, 100 - (loadAverage / 5 * 100))
  
  const totalScore = (cpuScore + memoryScore + diskScore + tempScore + loadScore) / 5
  
  // 确定健康状态
  let status: SystemHealthStatus
  if (criticalCount > 0) status = 'critical'
  else if (warningCount > 0) status = 'warning'
  else if (totalScore >= 80) status = 'healthy'
  else status = 'warning'
  
  return { status, score: Math.round(totalScore), alerts }
}

// 健康状态配置
const HEALTH_STATUS_CONFIG = {
  healthy: {
    label: '健康',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    icon: CheckCircle
  },
  warning: {
    label: '警告',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    icon: AlertTriangle
  },
  critical: {
    label: '严重',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    icon: XCircle
  },
  unknown: {
    label: '未知',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    icon: Activity
  }
}

// 健康得分卡片
const HealthScoreCard = React.memo<{
  data: SystemHealthDataPoint
  thresholds: typeof DEFAULT_THRESHOLDS
  onHealthChange?: (status: SystemHealthStatus, score: number) => void
  onAlert?: (alerts: SystemAlert[]) => void
}>(function HealthScoreCard({ data, thresholds, onHealthChange, onAlert }) {
  const { status, score, alerts } = useMemo(() => 
    assessSystemHealth(data, thresholds), [data, thresholds]
  )
  
  const config = HEALTH_STATUS_CONFIG[status]
  const IconComponent = config.icon
  
  React.useEffect(() => {
    onHealthChange?.(status, score)
    if (alerts.length > 0) {
      onAlert?.(alerts)
    }
  }, [status, score, alerts, onHealthChange, onAlert])
  
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <IconComponent className={cn("h-5 w-5", config.color)} />
          <span className="font-medium">系统健康</span>
        </div>
        <Badge className={cn(config.bgColor, config.color, "border-0")}>
          {config.label}
        </Badge>
      </div>
      
      <div className="space-y-3">
        <div className="text-center">
          <div className="text-3xl font-bold mb-1">{score}</div>
          <Progress value={score} className="h-2" />
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="text-center">
            <div className="text-muted-foreground">运行时间</div>
            <div className="font-medium">{data.uptime.toFixed(1)}h</div>
          </div>
          <div className="text-center">
            <div className="text-muted-foreground">负载</div>
            <div className="font-medium">{data.loadAverage.toFixed(2)}</div>
          </div>
        </div>
        
        {alerts.length > 0 && (
          <div className="text-xs text-red-600">
            {alerts.length} 个活跃警告
          </div>
        )}
      </div>
    </Card>
  )
})

HealthScoreCard.displayName = "HealthScoreCard"

// 资源使用卡片
const ResourceCards = React.memo<{
  data: SystemHealthDataPoint
  thresholds: typeof DEFAULT_THRESHOLDS
}>(function ResourceCards({ data, thresholds }) {
  const resources = [
    {
      key: 'cpu',
      label: 'CPU',
      value: data.cpuUsage,
      unit: '%',
      icon: Cpu,
      threshold: thresholds.cpu,
      trend: data.cpuUsage > 50 ? 'up' : 'down'
    },
    {
      key: 'memory',
      label: '内存',
      value: data.memoryUsage,
      unit: '%',
      icon: MemoryStick,
      threshold: thresholds.memory,
      trend: data.memoryUsage > 60 ? 'up' : 'down'
    },
    {
      key: 'disk',
      label: '磁盘',
      value: data.diskUsage,
      unit: '%',
      icon: HardDrive,
      threshold: thresholds.disk,
      trend: data.diskUsage > 70 ? 'up' : 'down'
    },
    {
      key: 'temperature',
      label: '温度',
      value: data.temperature,
      unit: '°C',
      icon: Thermometer,
      threshold: thresholds.temperature,
      trend: data.temperature > 60 ? 'up' : 'down'
    }
  ]
  
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {resources.map(resource => {
        const IconComponent = resource.icon
        const TrendIcon = resource.trend === 'up' ? TrendingUp : TrendingDown
        const isWarning = resource.value >= resource.threshold.warning
        const isCritical = resource.value >= resource.threshold.critical
        
        return (
          <Card key={resource.key} className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <IconComponent className={cn(
                  "h-4 w-4",
                  isCritical ? "text-red-600" : isWarning ? "text-yellow-600" : "text-green-600"
                )} />
                <span className="text-sm font-medium">{resource.label}</span>
              </div>
              <TrendIcon className={cn(
                "h-3 w-3",
                resource.trend === 'up' ? "text-red-500" : "text-green-500"
              )} />
            </div>
            
            <div className="space-y-2">
              <div className="text-lg font-bold">
                {resource.value.toFixed(1)}{resource.unit}
              </div>
              <Progress 
                value={resource.value} 
                className={cn(
                  "h-1",
                  isCritical ? "[&>div]:bg-red-500" : 
                  isWarning ? "[&>div]:bg-yellow-500" : "[&>div]:bg-green-500"
                )}
              />
              <div className="text-xs text-muted-foreground">
                警告: {resource.threshold.warning}{resource.unit}
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
})

ResourceCards.displayName = "ResourceCards"

// 警告列表
const AlertsList = React.memo<{
  alerts: SystemAlert[]
}>(function AlertsList({ alerts }) {
  if (alerts.length === 0) return null
  
  return (
    <Card className="p-4">
      <CardHeader className="p-0 pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          活跃警告 ({alerts.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="space-y-2 max-h-32 overflow-y-auto">
          {alerts.map(alert => (
            <div 
              key={alert.id}
              className={cn(
                "flex items-center justify-between p-2 rounded text-xs",
                alert.level === 'critical' ? "bg-red-50 text-red-800" : "bg-yellow-50 text-yellow-800"
              )}
            >
              <span className="flex-1">{alert.message}</span>
              <Badge 
                variant={alert.level === 'critical' ? 'destructive' : 'secondary'}
                className="text-xs"
              >
                {alert.level === 'critical' ? '严重' : '警告'}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
})

AlertsList.displayName = "AlertsList"

// 主SystemHealthChart组件
export const SystemHealthChart = React.memo<SystemHealthChartProps>(function SystemHealthChart({
  data,
  showHealthScore = true,
  showResourceCards = true,
  showAlerts = true,
  thresholds = DEFAULT_THRESHOLDS,
  onHealthChange,
  onAlert,
  title = "系统健康监控",
  height = 300,
  realTime = true,
  autoUpdate = true,
  updateInterval = 5000,
  maxDataPoints = 100,
  ...chartProps
}) {
  // 图表配置
  const chartConfig = useMemo(() => ({
    cpuUsage: {
      label: "CPU使用率",
      color: "hsl(var(--chart-1))",
      unit: "%"
    },
    memoryUsage: {
      label: "内存使用率",
      color: "hsl(var(--chart-2))",
      unit: "%"
    },
    diskUsage: {
      label: "磁盘使用率",
      color: "hsl(var(--chart-3))",
      unit: "%"
    },
    temperature: {
      label: "温度",
      color: "hsl(var(--chart-4))",
      unit: "°C"
    },
    networkIO: {
      label: "网络IO",
      color: "hsl(var(--chart-5))",
      unit: "MB/s"
    },
    diskIO: {
      label: "磁盘IO",
      color: "hsl(var(--chart-6))",
      unit: "MB/s"
    }
  }), [])
  
  // 获取最新数据
  const latestData = useMemo(() => {
    return data[data.length - 1] || {
      timestamp: Date.now(),
      cpuUsage: 0,
      memoryUsage: 0,
      diskUsage: 0,
      temperature: 0,
      powerConsumption: 0,
      networkIO: 0,
      diskIO: 0,
      processCount: 0,
      threadCount: 0,
      uptime: 0,
      loadAverage: 0
    }
  }, [data])
  
  // 获取当前警告
  const currentAlerts = useMemo(() => {
    const { alerts } = assessSystemHealth(latestData, thresholds)
    return alerts
  }, [latestData, thresholds])
  
  // 处理健康状态变化
  const handleHealthChange = useCallback((status: SystemHealthStatus, score: number) => {
    onHealthChange?.(status, score)
  }, [onHealthChange])
  
  // 处理警告
  const handleAlert = useCallback((alerts: SystemAlert[]) => {
    onAlert?.(alerts)
  }, [onAlert])
  
  return (
    <div className="space-y-4">
      {/* 健康得分和资源卡片 */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {showHealthScore && (
          <div className="lg:col-span-1">
            <HealthScoreCard 
              data={latestData} 
              thresholds={thresholds}
              onHealthChange={handleHealthChange}
              onAlert={handleAlert}
            />
          </div>
        )}
        
        {showResourceCards && (
          <div className={cn(
            showHealthScore ? "lg:col-span-4" : "lg:col-span-5"
          )}>
            <ResourceCards 
              data={latestData} 
              thresholds={thresholds}
            />
          </div>
        )}
      </div>
      
      {/* 警告列表 */}
      {showAlerts && currentAlerts.length > 0 && (
        <AlertsList alerts={currentAlerts} />
      )}
      
      {/* 系统资源使用趋势图表 */}
      <Chart
        type="area"
        data={data}
        xKey="timestamp"
        yKey={["cpuUsage", "memoryUsage", "diskUsage"]}
        config={chartConfig}
        title="系统资源使用趋势"
        height={height}
        realTime={realTime}
        autoUpdate={autoUpdate}
        updateInterval={updateInterval}
        maxDataPoints={maxDataPoints}
        variant="card"
        {...(({ type, ...rest }) => rest)(chartProps)}
      />
      
      {/* 温度和IO监控 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Chart
          type="line"
          data={data}
          xKey="timestamp"
          yKey="temperature"
          config={chartConfig}
          title="系统温度监控"
          height={250}
          realTime={realTime}
          autoUpdate={autoUpdate}
          updateInterval={updateInterval}
          maxDataPoints={maxDataPoints}
          showReferenceLine={true}
          referenceValue={thresholds.temperature.warning}
          variant="card"
        />
        
        <Chart
          type="bar"
          data={data}
          xKey="timestamp"
          yKey={["networkIO", "diskIO"]}
          config={chartConfig}
          title="网络与磁盘IO"
          height={250}
          realTime={realTime}
          autoUpdate={autoUpdate}
          updateInterval={updateInterval}
          maxDataPoints={maxDataPoints}

          variant="card"
        />
      </div>
    </div>
  )
})

SystemHealthChart.displayName = "SystemHealthChart"

export default SystemHealthChart