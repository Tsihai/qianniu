'use client';

import React, { useState, useEffect, Profiler } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Cpu,
  HardDrive,
  Network,
  Play,
  Square,
  Trash2,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { usePerformanceMetrics } from '@/hooks/usePerformanceMetrics';
import {
  PerformanceMetrics as IPerformanceMetrics,
  PerformanceAlert,
  PerformanceTrend,
  PerformanceMonitoringConfig,
} from '@/types/monitoring';
import { cn } from '@/lib/utils';

interface PerformanceMetricsProps {
  /** 初始配置 */
  config?: Partial<PerformanceMonitoringConfig>;
  /** 是否自动开始监控 */
  autoStart?: boolean;
  /** 自定义样式类名 */
  className?: string;
  /** 是否显示详细信息 */
  showDetails?: boolean;
  /** 是否显示趋势图表 */
  showCharts?: boolean;
  /** 是否显示警告 */
  showAlerts?: boolean;
  /** 自定义事件处理 */
  onAlert?: (alert: PerformanceAlert) => void;
  onMetricsUpdate?: (metrics: IPerformanceMetrics) => void;
}

/**
 * 性能监控组件
 * 显示实时性能指标、趋势图表和警告信息
 */
export function PerformanceMetrics({
  config,
  autoStart = false,
  className,
  showDetails = true,
  showCharts = true,
  showAlerts = true,
  onAlert,
  onMetricsUpdate,
}: PerformanceMetricsProps) {
  const {
    currentMetrics,
    metricsHistory,
    trends,
    alerts,
    stats,
    profilerData,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    clearHistory,
    markAlertAsRead,
    clearAlerts,
    getPerformanceReport,
    onRenderCallback,
  } = usePerformanceMetrics(
    config,
    {},
    {
      onAlert,
      onMetricsUpdate,
    }
  );

  const [selectedTab, setSelectedTab] = useState('overview');

  // 自动开始监控
  useEffect(() => {
    if (autoStart && !isMonitoring) {
      startMonitoring();
    }
  }, [autoStart, isMonitoring, startMonitoring]);

  // 格式化数值
  const formatValue = (value: number, unit: string) => {
    if (value === 0) return `0${unit}`;
    if (value < 1) return `${value.toFixed(2)}${unit}`;
    if (value < 10) return `${value.toFixed(1)}${unit}`;
    return `${Math.round(value)}${unit}`;
  };

  // 格式化时间
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  // 格式化持续时间
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
  };

  // 获取指标颜色
  const getMetricColor = (value: number, thresholds: { warning: number; critical: number }) => {
    if (value >= thresholds.critical) return 'text-red-500';
    if (value >= thresholds.warning) return 'text-yellow-500';
    return 'text-green-500';
  };

  // 获取趋势图标
  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-green-500" />;
      default:
        return <Activity className="h-4 w-4 text-blue-500" />;
    }
  };

  // 获取警告级别颜色
  const getAlertColor = (level: 'info' | 'warning' | 'critical') => {
    switch (level) {
      case 'critical':
        return 'border-red-500 bg-red-50';
      case 'warning':
        return 'border-yellow-500 bg-yellow-50';
      default:
        return 'border-blue-500 bg-blue-50';
    }
  };

  // 准备图表数据
  const chartData = metricsHistory.slice(-20).map(metric => ({
    time: formatTime(metric.timestamp),
    timestamp: metric.timestamp,
    CPU: metric.cpu,
    内存: metric.memory,
    API响应: metric.apiResponseTime,
    错误率: metric.errorRate,
    FPS: metric.fps || 0,
  }));

  // 渲染概览卡片
  const renderOverviewCard = (title: string, value: number, unit: string, icon: React.ReactNode, trend?: PerformanceTrend) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="flex items-center space-x-1">
          {icon}
          {trend && getTrendIcon(trend.trend)}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatValue(value, unit)}</div>
        {trend && (
          <p className="text-xs text-muted-foreground">
            平均: {formatValue(trend.average, unit)} | 范围: {formatValue(trend.min, unit)} - {formatValue(trend.max, unit)}
          </p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Profiler id="PerformanceMetrics" onRender={onRenderCallback}>
      <div className={cn('space-y-6', className)}>
        {/* 控制面板 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="h-5 w-5" />
                  <span>性能监控</span>
                  <Badge variant={isMonitoring ? 'default' : 'secondary'}>
                    {isMonitoring ? '运行中' : '已停止'}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  实时监控系统性能指标和趋势分析
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant={isMonitoring ? 'destructive' : 'default'}
                  size="sm"
                  onClick={isMonitoring ? stopMonitoring : startMonitoring}
                >
                  {isMonitoring ? (
                    <>
                      <Square className="h-4 w-4 mr-1" />
                      停止监控
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-1" />
                      开始监控
                    </>
                  )}
                </Button>
                <Button variant="outline" size="sm" onClick={clearHistory}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  清除数据
                </Button>
              </div>
            </div>
          </CardHeader>
          {stats.totalSamples > 0 && (
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">运行时间:</span>
                  <div className="font-medium">{formatDuration(stats.uptime)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">采样次数:</span>
                  <div className="font-medium">{stats.totalSamples}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">警告数量:</span>
                  <div className="font-medium">
                    <span className="text-red-500">{stats.alertCount.critical}</span> /
                    <span className="text-yellow-500 ml-1">{stats.alertCount.warning}</span> /
                    <span className="text-blue-500 ml-1">{stats.alertCount.info}</span>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">最后更新:</span>
                  <div className="font-medium">{formatTime(stats.lastUpdated)}</div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* 主要内容 */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">概览</TabsTrigger>
            <TabsTrigger value="charts">图表</TabsTrigger>
            <TabsTrigger value="alerts">警告</TabsTrigger>
            <TabsTrigger value="details">详情</TabsTrigger>
          </TabsList>

          {/* 概览标签页 */}
          <TabsContent value="overview" className="space-y-4">
            {currentMetrics && (
              <>
                {/* 主要指标卡片 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {renderOverviewCard(
                    'CPU使用率',
                    currentMetrics.cpu,
                    '%',
                    <Cpu className="h-4 w-4 text-blue-500" />,
                    trends.find(t => t.metric === 'cpu')
                  )}
                  {renderOverviewCard(
                    '内存使用',
                    currentMetrics.memory,
                    'MB',
                    <HardDrive className="h-4 w-4 text-green-500" />,
                    trends.find(t => t.metric === 'memory')
                  )}
                  {renderOverviewCard(
                    'API响应',
                    currentMetrics.apiResponseTime,
                    'ms',
                    <Network className="h-4 w-4 text-purple-500" />,
                    trends.find(t => t.metric === 'apiResponseTime')
                  )}
                  {renderOverviewCard(
                    '错误率',
                    currentMetrics.errorRate,
                    '%',
                    <AlertTriangle className="h-4 w-4 text-red-500" />,
                    trends.find(t => t.metric === 'errorRate')
                  )}
                </div>

                {/* 额外指标 */}
                {(currentMetrics.fps || currentMetrics.pageLoadTime || currentMetrics.domNodes) && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {currentMetrics.fps && renderOverviewCard(
                      '帧率',
                      currentMetrics.fps,
                      'FPS',
                      <Zap className="h-4 w-4 text-yellow-500" />
                    )}
                    {currentMetrics.pageLoadTime && renderOverviewCard(
                      '页面加载',
                      currentMetrics.pageLoadTime,
                      'ms',
                      <Clock className="h-4 w-4 text-indigo-500" />
                    )}
                    {currentMetrics.domNodes && renderOverviewCard(
                      'DOM节点',
                      currentMetrics.domNodes,
                      '',
                      <Activity className="h-4 w-4 text-gray-500" />
                    )}
                  </div>
                )}

                {/* 性能进度条 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">性能指标</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>CPU使用率</span>
                        <span className={getMetricColor(currentMetrics.cpu, { warning: 70, critical: 90 })}>
                          {currentMetrics.cpu}%
                        </span>
                      </div>
                      <Progress value={currentMetrics.cpu} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>内存使用</span>
                        <span className={getMetricColor(currentMetrics.memory, { warning: 512, critical: 1024 })}>
                          {currentMetrics.memory}MB
                        </span>
                      </div>
                      <Progress value={(currentMetrics.memory / 1024) * 100} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>API响应时间</span>
                        <span className={getMetricColor(currentMetrics.apiResponseTime, { warning: 1000, critical: 3000 })}>
                          {currentMetrics.apiResponseTime}ms
                        </span>
                      </div>
                      <Progress value={(currentMetrics.apiResponseTime / 3000) * 100} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>错误率</span>
                        <span className={getMetricColor(currentMetrics.errorRate, { warning: 5, critical: 10 })}>
                          {currentMetrics.errorRate}%
                        </span>
                      </div>
                      <Progress value={currentMetrics.errorRate * 10} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {!currentMetrics && (
              <Card>
                <CardContent className="flex items-center justify-center h-32">
                  <div className="text-center text-muted-foreground">
                    <Activity className="h-8 w-8 mx-auto mb-2" />
                    <p>暂无性能数据</p>
                    <p className="text-sm">点击"开始监控"开始收集数据</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* 图表标签页 */}
          <TabsContent value="charts" className="space-y-4">
            {showCharts && chartData.length > 0 && (
              <>
                {/* 主要指标趋势图 */}
                <Card>
                  <CardHeader>
                    <CardTitle>性能趋势</CardTitle>
                    <CardDescription>最近20次采样的性能指标变化</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="time" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="CPU" stroke="#3b82f6" strokeWidth={2} />
                        <Line type="monotone" dataKey="内存" stroke="#10b981" strokeWidth={2} />
                        <Line type="monotone" dataKey="错误率" stroke="#ef4444" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* API响应时间图 */}
                <Card>
                  <CardHeader>
                    <CardTitle>API响应时间</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="time" />
                        <YAxis />
                        <Tooltip />
                        <Area type="monotone" dataKey="API响应" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* FPS图表 */}
                {chartData.some(d => d.FPS > 0) && (
                  <Card>
                    <CardHeader>
                      <CardTitle>帧率 (FPS)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="time" />
                          <YAxis domain={[0, 60]} />
                          <Tooltip />
                          <Line type="monotone" dataKey="FPS" stroke="#f59e0b" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {chartData.length === 0 && (
              <Card>
                <CardContent className="flex items-center justify-center h-32">
                  <div className="text-center text-muted-foreground">
                    <Activity className="h-8 w-8 mx-auto mb-2" />
                    <p>暂无图表数据</p>
                    <p className="text-sm">需要更多数据点才能显示趋势图</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* 警告标签页 */}
          <TabsContent value="alerts" className="space-y-4">
            {showAlerts && (
              <>
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">性能警告</h3>
                  {alerts.length > 0 && (
                    <Button variant="outline" size="sm" onClick={clearAlerts}>
                      清除所有警告
                    </Button>
                  )}
                </div>

                {alerts.length > 0 ? (
                  <div className="space-y-2">
                    {alerts.slice().reverse().map((alert) => (
                      <Alert key={alert.id} className={getAlertColor(alert.level)}>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle className="flex items-center justify-between">
                          <span>{alert.message}</span>
                          <div className="flex items-center space-x-2">
                            <Badge variant={alert.level === 'critical' ? 'destructive' : alert.level === 'warning' ? 'secondary' : 'default'}>
                              {alert.level === 'critical' ? '严重' : alert.level === 'warning' ? '警告' : '信息'}
                            </Badge>
                            {!alert.read && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => markAlertAsRead(alert.id)}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </AlertTitle>
                        <AlertDescription>
                          <div className="flex justify-between text-sm">
                            <span>当前值: {alert.currentValue} | 阈值: {alert.threshold}</span>
                            <span>{formatTime(alert.timestamp)}</span>
                          </div>
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="flex items-center justify-center h-32">
                      <div className="text-center text-muted-foreground">
                        <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                        <p>暂无警告</p>
                        <p className="text-sm">系统运行正常</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* 详情标签页 */}
          <TabsContent value="details" className="space-y-4">
            {showDetails && (
              <>
                {/* React Profiler 数据 */}
                {profilerData.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>React 渲染性能</CardTitle>
                      <CardDescription>最近的组件渲染性能数据</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {profilerData.slice(-10).map((data, index) => (
                          <div key={index} className="flex justify-between items-center p-2 bg-muted rounded">
                            <div>
                              <span className="font-medium">{data.id}</span>
                              <Badge variant="outline" className="ml-2">
                                {data.phase === 'mount' ? '挂载' : data.phase === 'update' ? '更新' : '嵌套更新'}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              实际: {data.actualDuration.toFixed(2)}ms | 基础: {data.baseDuration.toFixed(2)}ms
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 性能统计详情 */}
                <Card>
                  <CardHeader>
                    <CardTitle>详细统计</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <h4 className="font-medium">平均性能指标</h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span>CPU使用率:</span>
                            <span>{formatValue(stats.averageMetrics.cpu, '%')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>内存使用:</span>
                            <span>{formatValue(stats.averageMetrics.memory, 'MB')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>API响应时间:</span>
                            <span>{formatValue(stats.averageMetrics.apiResponseTime, 'ms')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>错误率:</span>
                            <span>{formatValue(stats.averageMetrics.errorRate, '%')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>帧率:</span>
                            <span>{formatValue(stats.averageMetrics.fps || 0, 'FPS')}</span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-medium">监控信息</h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span>开始时间:</span>
                            <span>{stats.startTime ? formatTime(stats.startTime) : '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>运行时长:</span>
                            <span>{formatDuration(stats.uptime)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>采样总数:</span>
                            <span>{stats.totalSamples}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>最后更新:</span>
                            <span>{stats.lastUpdated ? formatTime(stats.lastUpdated) : '-'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 性能报告 */}
                <Card>
                  <CardHeader>
                    <CardTitle>性能建议</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const report = getPerformanceReport();
                      return (
                        <div className="space-y-2">
                          {report.recommendations.length > 0 ? (
                            report.recommendations.map((recommendation, index) => (
                              <Alert key={index}>
                                <AlertTriangle className="h-4 w-4" />
                                <AlertDescription>{recommendation}</AlertDescription>
                              </Alert>
                            ))
                          ) : (
                            <div className="text-center text-muted-foreground py-4">
                              <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                              <p>性能表现良好，暂无优化建议</p>
                            </div>
                          )}
                        </div>
                      );
                    })()
                    }
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Profiler>
  );
}

export default PerformanceMetrics;