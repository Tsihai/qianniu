"use client"

import * as React from "react"
import { memo, useMemo, useCallback, useState } from "react"
import {
  ResponsiveContainer,
  LineChart,
  BarChart,
  AreaChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Cell,
  Brush
} from "recharts"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, AlertCircle, ZoomIn, ZoomOut, RotateCcw } from "lucide-react"

// 图表容器变体
const chartVariants = cva(
  "w-full",
  {
    variants: {
      variant: {
        default: "bg-background",
        card: "bg-card border rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

// 图表类型定义
export type ChartType = "line" | "bar" | "area"

// 图表数据点接口
export interface ChartDataPoint {
  [key: string]: string | number | undefined
}

// 图表配置接口
export interface ChartConfig {
  [key: string]: {
    label?: string
    color?: string
    icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>
    unit?: string
  }
}

// Chart组件的主要接口
export interface ChartProps extends React.HTMLAttributes<HTMLDivElement> {
  // 基础属性
  type: ChartType
  data: ChartDataPoint[]
  xKey: string
  yKey: string | string[]
  config?: ChartConfig
  
  // 样式属性
  width?: number
  height?: number
  colors?: string[]
  
  // 显示控制
  loading?: boolean
  error?: string | null
  showGrid?: boolean
  showTooltip?: boolean
  showLegend?: boolean
  showReferenceLine?: boolean
  referenceValue?: number
  
  // 交互功能
  onDataPointClick?: (data: ChartDataPoint, index: number) => void
  onZoomChange?: (domain?: { startIndex?: number; endIndex?: number }) => void
  
  // 实时数据功能
  realTime?: boolean
  autoUpdate?: boolean
  updateInterval?: number
  maxDataPoints?: number
  
  // 缩放功能
  enableZoom?: boolean
  enableBrush?: boolean
  zoomDomain?: { startIndex?: number; endIndex?: number }
  
  // 控制面板
  showControls?: boolean
  
  // 卡片样式
  variant?: 'default' | 'card'
  title?: string
  description?: string
  
  // 新增动画和交互功能
  realTimeAnimation?: boolean
  dataStreamInterval?: number
  interactiveTooltip?: boolean
  animationDuration?: number
  smoothTransition?: boolean
}

// 默认颜色配置
const DEFAULT_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
]

// 加载骨架屏组件
const ChartSkeleton = React.memo<{ height: number }>(({ height }) => (
  <div 
    className="w-full bg-muted rounded animate-pulse" 
    style={{ height: `${height}px` }}
  />
))

ChartSkeleton.displayName = "ChartSkeleton"

// 错误状态组件
const ChartError = React.memo<{ height: number }>(({ height }) => (
  <div 
    className="w-full flex items-center justify-center bg-muted/50 rounded border-2 border-dashed border-destructive/50"
    style={{ height: `${height}px` }}
  >
    <div className="text-center">
      <div className="text-destructive text-sm font-medium mb-1">
        图表加载失败
      </div>
      <div className="text-muted-foreground text-xs">
        请检查数据源或稍后重试
      </div>
    </div>
  </div>
))

ChartError.displayName = "ChartError"

// 图表控制按钮组件
const ChartControls = React.memo<{
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
  enableZoom?: boolean
}>(({ onZoomIn, onZoomOut, onReset, enableZoom = true }) => {
  if (!enableZoom) return null

  return (
    <div className="flex items-center gap-1 absolute top-2 right-2 z-10">
      <Button
        variant="outline"
        size="sm"
        onClick={onZoomIn}
        className="h-8 w-8 p-0"
      >
        <ZoomIn className="h-3 w-3" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onZoomOut}
        className="h-8 w-8 p-0"
      >
        <ZoomOut className="h-3 w-3" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onReset}
        className="h-8 w-8 p-0"
      >
        <RotateCcw className="h-3 w-3" />
      </Button>
    </div>
  )
})

ChartControls.displayName = "ChartControls"

// Tooltip payload item interface
interface TooltipPayloadItem {
  dataKey: string
  value: string | number
  color: string
  payload: ChartDataPoint
}

// 增强的自定义Tooltip组件
interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string
  config?: ChartConfig
}

const CustomTooltip = React.memo<CustomTooltipProps>(({ active, payload, label, config }) => {
  if (!active || !payload || !payload.length) {
    return null
  }

  return (
    <div className="bg-background border rounded-lg shadow-lg p-3 min-w-[120px]">
      <div className="mb-2">
        <span className="text-sm font-medium text-foreground">
          {label}
        </span>
      </div>
      <div className="space-y-1">
        {payload.map((entry, index) => {
          const configItem = config?.[entry.dataKey]
          return (
            <div key={index} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs text-muted-foreground">
                {configItem?.label || entry.dataKey}:
              </span>
              <span className="text-sm font-medium">
                {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
                {configItem?.unit && ` ${configItem.unit}`}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
})

CustomTooltip.displayName = "CustomTooltip"

// 图表内容组件属性接口
interface ChartContentProps {
  type: ChartType
  data: ChartDataPoint[]
  xKey: string
  yKey: string | string[]
  config?: ChartConfig
  colors: string[]
  height?: number
  showGrid: boolean
  showTooltip: boolean
  showLegend: boolean
  showReferenceLine: boolean
  referenceValue?: number
  onDataPointClick?: (data: ChartDataPoint, index: number) => void
  zoomDomain?: { startIndex?: number; endIndex?: number }
  // 新增动画和交互功能
  realTimeAnimation?: boolean
  interactiveTooltip?: boolean
  animationDuration?: number
  smoothTransition?: boolean
  animationKey?: number
  isAnimating?: boolean
}

const ChartContent = React.memo<ChartContentProps>(({ 
  type, 
  data, 
  xKey, 
  yKey, 
  config, 
  colors, 
  showGrid, 
  showTooltip, 
  showLegend, 
  showReferenceLine, 
  referenceValue,
  onDataPointClick,
  zoomDomain,
  realTimeAnimation = false,
  interactiveTooltip = false,
  animationDuration = 300,
  smoothTransition = true,
  animationKey = 0,
  isAnimating = false
}) => {
  // Apply zoom domain if specified
  const displayData = useMemo(() => {
    if (!zoomDomain || !zoomDomain.startIndex || !zoomDomain.endIndex) {
      return data
    }
    return data.slice(zoomDomain.startIndex, zoomDomain.endIndex + 1)
  }, [data, zoomDomain])
  const yKeys = Array.isArray(yKey) ? yKey : [yKey]
  
  // 动画配置
  const animationProps = realTimeAnimation ? {
    animationBegin: 0,
    animationDuration: smoothTransition ? animationDuration : 0,
    isAnimationActive: true,
    animationEasing: 'ease-out' as const
  } : {
    isAnimationActive: false
  }
  
  const renderChart = () => {
    const commonProps = {
      data: displayData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 },
      onClick: onDataPointClick ? (nextState: any, event: any) => {
        // Extract payload from the event or nextState
        const payload = nextState?.activePayload?.[0]?.payload || event?.activePayload?.[0]?.payload
        const index = nextState?.activeIndex ?? event?.activeIndex ?? 0
        if (payload) {
          onDataPointClick(payload, index)
        }
      } : undefined,
      key: realTimeAnimation ? animationKey : undefined,
      ...animationProps
    }

    const commonChildren = (
      <>
        <XAxis 
          dataKey={xKey}
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => typeof value === 'number' ? value.toLocaleString() : value}
        />
        {showGrid && (
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="hsl(var(--border))" 
          />
        )}
        {showTooltip && (
          <Tooltip 
            content={<CustomTooltip config={config} />}
            cursor={{ fill: "hsl(var(--muted))" }}
          />
        )}
        {showLegend && yKeys.length > 1 && (
          <Legend 
            wrapperStyle={{ 
              fontSize: "12px", 
              color: "hsl(var(--foreground))" 
            }}
          />
        )}
        {showReferenceLine && referenceValue !== undefined && (
          <ReferenceLine 
            y={referenceValue} 
            stroke="hsl(var(--destructive))" 
            strokeDasharray="5 5"
          />
        )}
      </>
    )

    switch (type) {
      case "line":
        return (
          <LineChart {...commonProps}>
            {commonChildren}
            {yKeys.map((key, index) => {
              const configItem = config?.[key]
              return (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={configItem?.color || colors[index % colors.length]}
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 2 }}
                  activeDot={{ r: 5, strokeWidth: 2 }}
                  connectNulls={false}
                  {...animationProps}
                  strokeDasharray={isAnimating ? "5,5" : "0"}
                  strokeDashoffset={isAnimating ? "10" : "0"}
                />
              )
            })}
          </LineChart>
        )
      
      case "bar":
        return (
          <BarChart {...commonProps}>
            {commonChildren}
            {yKeys.map((key, index) => {
              const configItem = config?.[key]
              return (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={configItem?.color || colors[index % colors.length]}
                  radius={[4, 4, 0, 0]}
                  opacity={0.8}
                  {...animationProps}
                />
              )
            })}
          </BarChart>
        )
      
      case "area":
        return (
          <AreaChart {...commonProps}>
            {commonChildren}
            {yKeys.map((key, index) => {
              const configItem = config?.[key]
              const color = configItem?.color || colors[index % colors.length]
              return (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={color}
                  fill={color}
                  fillOpacity={0.2}
                  strokeWidth={2}
                  connectNulls={false}
                  animationBegin={0}
                  animationDuration={animationDuration}
                  isAnimationActive={realTimeAnimation && isAnimating}
                  animationEasing={("ease" as const)}
                />
              )
            })}
          </AreaChart>
        )
      
      default:
        return null
    }
  }

  return renderChart()
})

ChartContent.displayName = "ChartContent"

// 主Chart组件
const Chart = React.memo(
  React.forwardRef<HTMLDivElement, ChartProps>((
    {
      type,
      data,
      xKey,
      yKey,
      title,
      description,
      loading = false,
      error = null,
      height = 300,
      config,
      showGrid = true,
      showTooltip = true,
      showLegend = true,
      showReferenceLine = false,
      referenceValue,
      variant = "default",
      colors = DEFAULT_COLORS,
      className,
      realTime = false,
      autoUpdate = false,
      updateInterval = 1000,
      maxDataPoints = 100,
      enableZoom = false,
      showControls = false,
      onDataPointClick,
      onZoomChange,
      realTimeAnimation = false,
      animationDuration = 300,
      smoothTransition = true,
      interactiveTooltip = true,
      zoomDomain,
      dataStreamInterval,
      ...props
    },
    ref
  ) => {
      // Real-time data management
      const [chartData, setChartData] = useState(data)
      const [internalZoomDomain, setInternalZoomDomain] = useState<{ startIndex?: number; endIndex?: number }>()
      const [isZoomed, setIsZoomed] = useState(false)
      const updateTimerRef = React.useRef<NodeJS.Timeout | undefined>(undefined)
      
      // Process and limit data points for performance
      const processedData = useMemo(() => {
        if (!chartData || !Array.isArray(chartData)) return []
        
        // Limit data points for performance
        const limitedData = chartData.slice(-maxDataPoints)
        
        // Sort by timestamp if available
        if (limitedData.length > 0 && 'timestamp' in limitedData[0]) {
          return limitedData.sort((a: ChartDataPoint, b: ChartDataPoint) => {
            const aTime = 'timestamp' in a ? new Date(a.timestamp as string).getTime() : 0
            const bTime = 'timestamp' in b ? new Date(b.timestamp as string).getTime() : 0
            return aTime - bTime
          })
        }
        
        return limitedData
      }, [chartData, maxDataPoints])
      
      // Update chart data when prop changes
      React.useEffect(() => {
        setChartData(data)
      }, [data])
      
      // Auto-update mechanism for real-time charts
      React.useEffect(() => {
        if (realTime && autoUpdate && updateInterval > 0) {
          updateTimerRef.current = setInterval(() => {
            // Trigger data refresh - this would typically call a callback
            // For now, we'll just ensure the component re-renders with latest data
            setChartData(prevData => [...(prevData || [])])
          }, updateInterval)
          
          return () => {
            if (updateTimerRef.current) {
              clearInterval(updateTimerRef.current)
            }
          }
        }
      }, [realTime, autoUpdate, updateInterval])
      
      // Zoom handlers
      const handleZoom = useCallback((domain: { startIndex?: number; endIndex?: number }) => {
        setInternalZoomDomain(domain)
        setIsZoomed(true)
        onZoomChange?.(domain)
      }, [onZoomChange])
      
      const handleResetZoom = useCallback(() => {
        setInternalZoomDomain(undefined)
        setIsZoomed(false)
        onZoomChange?.(undefined)
      }, [onZoomChange])
      
      const handleZoomIn = useCallback(() => {
        if (processedData.length > 0) {
          const dataLength = processedData.length
          const start = Math.floor(dataLength * 0.25)
          const end = Math.floor(dataLength * 0.75)
          handleZoom({ startIndex: start, endIndex: end })
        }
      }, [processedData, handleZoom])
      
      const handleZoomOut = useCallback(() => {
        if (isZoomed) {
          handleResetZoom()
        }
      }, [isZoomed, handleResetZoom])
      
      // Handle data point clicks
      const handleDataPointClick = useCallback((data: ChartDataPoint, index: number) => {
        onDataPointClick?.(data, index)
      }, [onDataPointClick])
      
      // 实时动画状态
      const [animationKey, setAnimationKey] = useState(0)
      const [isAnimating, setIsAnimating] = useState(false)
      
      // 实时动画效果
      React.useEffect(() => {
        if (realTimeAnimation && realTime && processedData.length > 0) {
          setIsAnimating(true)
          setAnimationKey(prev => prev + 1)
          
          const timer = setTimeout(() => {
            setIsAnimating(false)
          }, animationDuration)
          
          return () => clearTimeout(timer)
        }
      }, [processedData.length, realTimeAnimation, realTime, animationDuration])
      
      // 删除有问题的数据流动画间隔useEffect
      
      const chartContent = React.useMemo(() => {
        if (loading) {
          return <ChartSkeleton height={height} />
        }
        
        if (error || !processedData || processedData.length === 0) {
          return <ChartError height={height} />
        }

        return (
          <div className="relative">
            {showControls && (
              <ChartControls
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onReset={handleResetZoom}
                enableZoom={enableZoom}
              />
            )}
            <ResponsiveContainer width="100%" height={height}>
              <ChartContent
              data={processedData}
              type={type}
              xKey={xKey}
              yKey={yKey}
              config={config}
              height={height}
              showGrid={showGrid}
              showTooltip={showTooltip}
              showLegend={showLegend}
              showReferenceLine={showReferenceLine}
              referenceValue={referenceValue}
              onDataPointClick={handleDataPointClick}
              zoomDomain={internalZoomDomain || zoomDomain}
              realTimeAnimation={realTimeAnimation}
              interactiveTooltip={interactiveTooltip}
              animationDuration={animationDuration}
              smoothTransition={smoothTransition}
              animationKey={animationKey}
              isAnimating={isAnimating}
              colors={colors}
            />
            </ResponsiveContainer>
            {enableZoom && processedData.length > 10 && (
              <div className="mt-2">
                <ResponsiveContainer width="100%" height={60}>
                  <LineChart data={processedData}>
                    <XAxis dataKey={xKey} hide />
                    <YAxis hide />
                    <Line
                      type="monotone"
                      dataKey={Array.isArray(yKey) ? yKey[0] : yKey}
                      stroke={colors[0]}
                      strokeWidth={1}
                      dot={false}
                    />
                    <Brush
                      dataKey={xKey}
                      height={30}
                      stroke={colors[0]}
                      onChange={(brushData) => {
                        if (brushData) {
                          handleZoom({
                            startIndex: brushData.startIndex,
                            endIndex: brushData.endIndex
                          })
                        }
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )
      }, [type, processedData, xKey, yKey, config, colors, showGrid, showTooltip, showLegend, showReferenceLine, referenceValue, loading, error, height, showControls, enableZoom, handleZoomIn, handleZoomOut, handleResetZoom, handleZoom])

      if (variant === "card") {
        return (
          <Card ref={ref} className={cn(chartVariants({ variant }), className)} {...props}>
            {(title || description) && (
              <CardHeader>
                {title && <CardTitle className="text-base">{title}</CardTitle>}
                {description && (
                  <p className="text-sm text-muted-foreground">{description}</p>
                )}
              </CardHeader>
            )}
            <CardContent>
              {chartContent}
            </CardContent>
          </Card>
        )
      }

      return (
        <div ref={ref} className={cn(chartVariants({ variant }), className)} {...props}>
          {(title || description) && (
            <div className="mb-4">
              {title && <h3 className="text-base font-semibold">{title}</h3>}
              {description && (
                <p className="text-sm text-muted-foreground mt-1">{description}</p>
              )}
            </div>
          )}
          {chartContent}
        </div>
      )
    }
  )
)

Chart.displayName = "Chart"

export { Chart, ChartSkeleton, ChartError, CustomTooltip, chartVariants }