"use client"

import React, { useMemo, useCallback } from "react"
import { Chart, ChartProps } from "@/components/ui/chart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Minus, Activity } from "lucide-react"
import { cn } from "@/lib/utils"

// 性能指标数据接口
export interface MetricDataPoint {
  timestamp: string | number
  cpu: number
  memory: number
  network: number
  responseTime: number
  throughput: number
  errorRate: number
  [key: string]: string | number
}

// 指标配置接口
export interface MetricConfig {
  label: string
  color: string
  unit?: string
  threshold?: {
    warning: number
    critical: number
  }
  format?: (value: number) => string
}

// MetricsChart属性接口
export interface MetricsChartProps extends Omit<ChartProps, 'data' | 'xKey' | 'yKey' | 'config'> {
  data: MetricDataPoint[]
  metrics?: string[]
  showTrends?: boolean
  showThresholds?: boolean
  compactMode?: boolean
  alertOnThreshold?: boolean
  onThresholdExceeded?: (metric: string, value: number, threshold: number) => void
}

// 默认指标配置
const DEFAULT_METRICS_CONFIG: Record<string, MetricConfig> = {
  cpu: {
    label: "CPU使用率",
    color: "hsl(var(--chart-1))",
    unit: "%",
    threshold: { warning: 70, critical: 90 },
    format: (value) => `${value.toFixed(1)}%`
  },
  memory: {
    label: "内存使用率",
    color: "hsl(var(--chart-2))",
    unit: "%",
    threshold: { warning: 80, critical: 95 },
    format: (value) => `${value.toFixed(1)}%`
  },
  network: {
    label: "网络使用率",
    color: "hsl(var(--chart-3))",
    unit: "Mbps",
    threshold: { warning: 80, critical: 95 },
    format: (value) => `${value.toFixed(1)} Mbps`
  },
  responseTime: {
    label: "响应时间",
    color: "hsl(var(--chart-4))",
    unit: "ms",
    threshold: { warning: 500, critical: 1000 },
    format: (value) => `${value.toFixed(0)}ms`
  },
  throughput: {
    label: "吞吐量",
    color: "hsl(var(--chart-5))",
    unit: "req/s",
    format: (value) => `${value.toFixed(0)} req/s`
  },
  errorRate: {
    label: "错误率",
    color: "hsl(var(--destructive))",
    unit: "%",
    threshold: { warning: 1, critical: 5 },
    format: (value) => `${value.toFixed(2)}%`
  }
}

// 趋势指示器组件
const TrendIndicator = React.memo<{
  current: number
  previous: number
  className?: string
}>(function TrendIndicator({ current, previous, className }) {
  const trend = current - previous
  const percentage = previous !== 0 ? (trend / previous) * 100 : 0
  
  if (Math.abs(percentage) < 0.1) {
    return (
      <div className={cn("flex items-center gap-1 text-muted-foreground", className)}>
        <Minus className="h-3 w-3" />
        <span className="text-xs">0.0%</span>
      </div>
    )
  }
  
  const isPositive = trend > 0
  
  return (
    <div className={cn(
      "flex items-center gap-1",
      isPositive ? "text-green-600" : "text-red-600",
      className
    )}>
      {isPositive ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      <span className="text-xs">
        {Math.abs(percentage).toFixed(1)}%
      </span>
    </div>
  )
})

TrendIndicator.displayName = "TrendIndicator"

// 阈值状态徽章组件
const ThresholdBadge = React.memo<{
  value: number
  threshold?: { warning: number; critical: number }
}>(function ThresholdBadge({ value, threshold }) {
  if (!threshold) return null
  
  if (value >= threshold.critical) {
    return <Badge variant="destructive" className="text-xs">严重</Badge>
  }
  
  if (value >= threshold.warning) {
    return <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800">警告</Badge>
  }
  
  return <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">正常</Badge>
})

ThresholdBadge.displayName = "ThresholdBadge"

// 指标摘要卡片组件
const MetricSummaryCard = React.memo<{
  metric: string
  data: MetricDataPoint[]
  config: MetricConfig
  showTrends: boolean
  showThresholds: boolean
}>(function MetricSummaryCard({ metric, data, config, showTrends, showThresholds }) {
  const latestValue = data[data.length - 1]?.[metric] as number || 0
  const previousValue = data[data.length - 2]?.[metric] as number || 0
  
  return (
    <Card className="p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4" style={{ color: config.color }} />
          <span className="text-sm font-medium">{config.label}</span>
        </div>
        {showThresholds && (
          <ThresholdBadge value={latestValue} threshold={config.threshold} />
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-lg font-bold">
          {config.format ? config.format(latestValue) : latestValue.toLocaleString()}
        </span>
        {showTrends && data.length > 1 && (
          <TrendIndicator current={latestValue} previous={previousValue} />
        )}
      </div>
    </Card>
  )
})

MetricSummaryCard.displayName = "MetricSummaryCard"

// 主MetricsChart组件
export const MetricsChart = React.memo<MetricsChartProps>(function MetricsChart({
  data,
  metrics = ['cpu', 'memory', 'responseTime'],
  showTrends = true,
  showThresholds = true,
  compactMode = false,
  alertOnThreshold = false,
  onThresholdExceeded,
  title = "系统性能指标",
  height = 300,
  realTime = true,
  autoUpdate = true,
  updateInterval = 5000,
  maxDataPoints = 50,
  ...chartProps
}) {
  // 处理图表配置
  const chartConfig = useMemo(() => {
    const config: Record<string, { label: string; color: string; unit?: string }> = {}
    metrics.forEach(metric => {
      const metricConfig = DEFAULT_METRICS_CONFIG[metric]
      if (metricConfig) {
        config[metric] = {
          label: metricConfig.label,
          color: metricConfig.color,
          unit: metricConfig.unit
        }
      }
    })
    return config
  }, [metrics])
  
  // 处理阈值警告
  const handleThresholdCheck = useCallback(() => {
    if (!alertOnThreshold || !onThresholdExceeded || data.length === 0) return
    
    const latestData = data[data.length - 1]
    metrics.forEach(metric => {
      const value = latestData[metric] as number
      const config = DEFAULT_METRICS_CONFIG[metric]
      
      if (config?.threshold && value >= config.threshold.critical) {
        onThresholdExceeded(metric, value, config.threshold.critical)
      }
    })
  }, [data, metrics, alertOnThreshold, onThresholdExceeded])
  
  // 监听数据变化，检查阈值
  React.useEffect(() => {
    handleThresholdCheck()
  }, [handleThresholdCheck])
  
  // 添加参考线（阈值线）
  const referenceLines = useMemo(() => {
    if (!showThresholds || metrics.length !== 1) return undefined
    
    const metric = metrics[0]
    const config = DEFAULT_METRICS_CONFIG[metric]
    return config?.threshold?.warning
  }, [showThresholds, metrics])
  
  if (compactMode) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-5 w-5" />
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {metrics.map(metric => {
            const config = DEFAULT_METRICS_CONFIG[metric]
            if (!config) return null
            
            return (
              <MetricSummaryCard
                key={metric}
                metric={metric}
                data={data}
                config={config}
                showTrends={showTrends}
                showThresholds={showThresholds}
              />
            )
          })}
        </div>
      </div>
    )
  }
  
  return (
    <div className="space-y-4">
      {/* 指标摘要卡片 */}
      {(showTrends || showThresholds) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {metrics.slice(0, 4).map(metric => {
            const config = DEFAULT_METRICS_CONFIG[metric]
            if (!config) return null
            
            return (
              <MetricSummaryCard
                key={metric}
                metric={metric}
                data={data}
                config={config}
                showTrends={showTrends}
                showThresholds={showThresholds}
              />
            )
          })}
        </div>
      )}
      
      {/* 主图表 */}
      <Chart
        type="line"
        data={data}
        xKey="timestamp"
        yKey={metrics}
        config={chartConfig}
        title={title}
        height={height}
        realTime={realTime}
        autoUpdate={autoUpdate}
        updateInterval={updateInterval}
        maxDataPoints={maxDataPoints}
        showReferenceLine={showThresholds && metrics.length === 1}
        referenceValue={referenceLines}
        variant="card"
        {...(({ type, ...rest }) => rest)(chartProps)}
      />
    </div>
  )
})

MetricsChart.displayName = "MetricsChart"

export default MetricsChart