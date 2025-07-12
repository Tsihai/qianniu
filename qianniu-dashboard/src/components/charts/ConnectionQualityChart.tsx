"use client"

import React, { useMemo, useCallback } from "react"
import { Chart, ChartProps } from "@/components/ui/chart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  Wifi, 
  WifiOff, 
  Signal, 
  SignalHigh, 
  SignalMedium, 
  SignalLow,
  Clock,
  Zap,
  AlertTriangle
} from "lucide-react"
import { cn } from "@/lib/utils"

// 连接质量数据接口
export interface ConnectionQualityDataPoint {
  timestamp: string | number
  latency: number // 延迟 (ms)
  packetLoss: number // 丢包率 (%)
  bandwidth: number // 带宽 (Mbps)
  jitter: number // 抖动 (ms)
  connectionStrength: number // 连接强度 (0-100)
  reconnectCount: number // 重连次数
  uptime: number // 在线时间 (%)
  [key: string]: string | number
}

// 连接质量等级
export type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'critical'

// ConnectionQualityChart属性接口
export interface ConnectionQualityChartProps extends Omit<ChartProps, 'data' | 'xKey' | 'yKey' | 'config'> {
  data: ConnectionQualityDataPoint[]
  showQualityScore?: boolean
  showDetailedMetrics?: boolean
  alertThresholds?: {
    latency: number
    packetLoss: number
    bandwidth: number
  }
  onQualityChange?: (quality: ConnectionQuality, score: number) => void
}

// 默认警告阈值
const DEFAULT_THRESHOLDS = {
  latency: 100, // ms
  packetLoss: 1, // %
  bandwidth: 10 // Mbps
}

// 连接质量评估函数
const assessConnectionQuality = (data: ConnectionQualityDataPoint): { quality: ConnectionQuality; score: number } => {
  const { latency, packetLoss, bandwidth, connectionStrength } = data
  
  // 计算各项指标得分 (0-100)
  const latencyScore = Math.max(0, 100 - (latency / 2)) // 200ms = 0分
  const packetLossScore = Math.max(0, 100 - (packetLoss * 20)) // 5% = 0分
  const bandwidthScore = Math.min(100, (bandwidth / 100) * 100) // 100Mbps = 100分
  const strengthScore = connectionStrength
  
  // 加权平均得分
  const totalScore = (
    latencyScore * 0.3 +
    packetLossScore * 0.3 +
    bandwidthScore * 0.2 +
    strengthScore * 0.2
  )
  
  // 确定质量等级
  let quality: ConnectionQuality
  if (totalScore >= 90) quality = 'excellent'
  else if (totalScore >= 75) quality = 'good'
  else if (totalScore >= 60) quality = 'fair'
  else if (totalScore >= 40) quality = 'poor'
  else quality = 'critical'
  
  return { quality, score: Math.round(totalScore) }
}

// 质量等级配置
const QUALITY_CONFIG = {
  excellent: {
    label: '优秀',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    icon: SignalHigh
  },
  good: {
    label: '良好',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    icon: Signal
  },
  fair: {
    label: '一般',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    icon: SignalMedium
  },
  poor: {
    label: '较差',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    icon: SignalLow
  },
  critical: {
    label: '严重',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    icon: WifiOff
  }
}

// 连接质量得分卡片
const QualityScoreCard = React.memo<{
  data: ConnectionQualityDataPoint
  onQualityChange?: (quality: ConnectionQuality, score: number) => void
}>(function QualityScoreCard({ data, onQualityChange }) {
  const { quality, score } = useMemo(() => assessConnectionQuality(data), [data])
  const config = QUALITY_CONFIG[quality]
  const IconComponent = config.icon
  
  React.useEffect(() => {
    onQualityChange?.(quality, score)
  }, [quality, score, onQualityChange])
  
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <IconComponent className={cn("h-5 w-5", config.color)} />
          <span className="font-medium">连接质量</span>
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
            <div className="text-muted-foreground">延迟</div>
            <div className="font-medium">{data.latency}ms</div>
          </div>
          <div className="text-center">
            <div className="text-muted-foreground">丢包率</div>
            <div className="font-medium">{data.packetLoss}%</div>
          </div>
        </div>
      </div>
    </Card>
  )
})

QualityScoreCard.displayName = "QualityScoreCard"

// 详细指标卡片
const DetailedMetricsCards = React.memo<{
  data: ConnectionQualityDataPoint
  thresholds: typeof DEFAULT_THRESHOLDS
}>(function DetailedMetricsCards({ data, thresholds }) {
  const metrics = [
    {
      key: 'latency',
      label: '延迟',
      value: data.latency,
      unit: 'ms',
      icon: Clock,
      threshold: thresholds.latency,
      isGood: data.latency <= thresholds.latency
    },
    {
      key: 'packetLoss',
      label: '丢包率',
      value: data.packetLoss,
      unit: '%',
      icon: AlertTriangle,
      threshold: thresholds.packetLoss,
      isGood: data.packetLoss <= thresholds.packetLoss
    },
    {
      key: 'bandwidth',
      label: '带宽',
      value: data.bandwidth,
      unit: 'Mbps',
      icon: Zap,
      threshold: thresholds.bandwidth,
      isGood: data.bandwidth >= thresholds.bandwidth
    },
    {
      key: 'uptime',
      label: '在线率',
      value: data.uptime,
      unit: '%',
      icon: Wifi,
      threshold: 99,
      isGood: data.uptime >= 99
    }
  ]
  
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {metrics.map(metric => {
        const IconComponent = metric.icon
        return (
          <Card key={metric.key} className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <IconComponent className={cn(
                "h-4 w-4",
                metric.isGood ? "text-green-600" : "text-red-600"
              )} />
              <span className="text-sm font-medium">{metric.label}</span>
            </div>
            <div className="text-lg font-bold">
              {metric.value.toFixed(metric.key === 'bandwidth' ? 1 : 0)}{metric.unit}
            </div>
            <div className="text-xs text-muted-foreground">
              阈值: {metric.threshold}{metric.unit}
            </div>
          </Card>
        )
      })}
    </div>
  )
})

DetailedMetricsCards.displayName = "DetailedMetricsCards"

// 主ConnectionQualityChart组件
export const ConnectionQualityChart = React.memo<ConnectionQualityChartProps>(function ConnectionQualityChart({
  data,
  showQualityScore = true,
  showDetailedMetrics = true,
  alertThresholds = DEFAULT_THRESHOLDS,
  onQualityChange,
  title = "连接质量监控",
  height = 300,
  realTime = true,
  autoUpdate = true,
  updateInterval = 5000,
  maxDataPoints = 100,
  ...chartProps
}) {
  // 图表配置
  const chartConfig = useMemo(() => ({
    latency: {
      label: "延迟",
      color: "hsl(var(--chart-1))",
      unit: "ms"
    },
    packetLoss: {
      label: "丢包率",
      color: "hsl(var(--chart-2))",
      unit: "%"
    },
    bandwidth: {
      label: "带宽",
      color: "hsl(var(--chart-3))",
      unit: "Mbps"
    },
    connectionStrength: {
      label: "连接强度",
      color: "hsl(var(--chart-4))",
      unit: "%"
    }
  }), [])
  
  // 获取最新数据
  const latestData = useMemo(() => {
    return data[data.length - 1] || {
      timestamp: Date.now(),
      latency: 0,
      packetLoss: 0,
      bandwidth: 0,
      jitter: 0,
      connectionStrength: 0,
      reconnectCount: 0,
      uptime: 0
    }
  }, [data])
  
  // 处理质量变化
  const handleQualityChange = useCallback((quality: ConnectionQuality, score: number) => {
    onQualityChange?.(quality, score)
  }, [onQualityChange])
  
  return (
    <div className="space-y-4">
      {/* 质量得分和详细指标 */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {showQualityScore && (
          <div className="lg:col-span-1">
            <QualityScoreCard 
              data={latestData} 
              onQualityChange={handleQualityChange}
            />
          </div>
        )}
        
        {showDetailedMetrics && (
          <div className={cn(
            showQualityScore ? "lg:col-span-3" : "lg:col-span-4"
          )}>
            <DetailedMetricsCards 
              data={latestData} 
              thresholds={alertThresholds}
            />
          </div>
        )}
      </div>
      
      {/* 延迟趋势图表 */}
      <Chart
        type="line"
        data={data}
        xKey="timestamp"
        yKey="latency"
        config={chartConfig}
        title="延迟趋势"
        height={height}
        realTime={realTime}
        autoUpdate={autoUpdate}
        updateInterval={updateInterval}
        maxDataPoints={maxDataPoints}
        showReferenceLine={true}
        referenceValue={alertThresholds.latency}
        variant="card"
        {...(({ type, ...rest }) => rest)(chartProps)}
      />
      
      {/* 多指标对比图表 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Chart
          type="area"
          data={data}
          xKey="timestamp"
          yKey={["packetLoss", "jitter"]}
          config={chartConfig}
          title="丢包率与抖动"
          height={250}
          realTime={realTime}
          autoUpdate={autoUpdate}
          updateInterval={updateInterval}
          maxDataPoints={maxDataPoints}

          variant="card"
        />
        
        <Chart
          type="line"
          data={data}
          xKey="timestamp"
          yKey={["bandwidth", "connectionStrength"]}
          config={chartConfig}
          title="带宽与连接强度"
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

ConnectionQualityChart.displayName = "ConnectionQualityChart"

export default ConnectionQualityChart