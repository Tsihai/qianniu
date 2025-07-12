import { EventEmitter } from 'events';
import os from 'os';
import process from 'process';
import { getLogger } from './Logger.js';
import ErrorHandler from './ErrorHandler.js';

// 创建性能监控专用的日志器实例
const logger = getLogger('PerformanceMonitor');

/**
 * 性能指标类型枚举
 */
const MetricType = {
    RESPONSE_TIME: 'response_time',
    MEMORY_USAGE: 'memory_usage',
    CPU_USAGE: 'cpu_usage',
    CONNECTION_COUNT: 'connection_count',
    ERROR_RATE: 'error_rate',
    THROUGHPUT: 'throughput',
    CUSTOM: 'custom'
};

/**
 * 告警级别枚举
 */
const AlertLevel = {
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error',
    CRITICAL: 'critical'
};

/**
 * 性能指标数据结构
 */
class Metric {
    constructor(type, value, timestamp = Date.now(), metadata = {}) {
        this.type = type;
        this.value = value;
        this.timestamp = timestamp;
        this.metadata = metadata;
        this.id = `${type}_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 序列化指标数据
     */
    toJSON() {
        return {
            id: this.id,
            type: this.type,
            value: this.value,
            timestamp: this.timestamp,
            metadata: this.metadata
        };
    }

    /**
     * 从JSON数据创建指标实例
     */
    static fromJSON(data) {
        const metric = new Metric(data.type, data.value, data.timestamp, data.metadata);
        metric.id = data.id;
        return metric;
    }
}

/**
 * 统计信息类
 */
class Statistics {
    constructor() {
        this.count = 0;
        this.sum = 0;
        this.min = Infinity;
        this.max = -Infinity;
        this.avg = 0;
        this.p50 = 0;
        this.p95 = 0;
        this.p99 = 0;
    }

    /**
     * 添加数据点
     */
    addValue(value) {
        this.count++;
        this.sum += value;
        this.min = Math.min(this.min, value);
        this.max = Math.max(this.max, value);
        this.avg = this.sum / this.count;
    }

    /**
     * 计算百分位数
     */
    calculatePercentiles(values) {
        if (values.length === 0) return;
        
        const sorted = values.sort((a, b) => a - b);
        this.p50 = this.getPercentile(sorted, 50);
        this.p95 = this.getPercentile(sorted, 95);
        this.p99 = this.getPercentile(sorted, 99);
    }

    /**
     * 获取指定百分位数
     */
    getPercentile(sortedArray, percentile) {
        const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
        return sortedArray[Math.max(0, index)];
    }

    /**
     * 重置统计信息
     */
    reset() {
        this.count = 0;
        this.sum = 0;
        this.min = Infinity;
        this.max = -Infinity;
        this.avg = 0;
        this.p50 = 0;
        this.p95 = 0;
        this.p99 = 0;
    }
}

/**
 * 环形缓冲区类
 */
class CircularBuffer {
    constructor(size = 1000) {
        this.size = size;
        this.buffer = new Array(size);
        this.head = 0;
        this.count = 0;
    }

    /**
     * 添加元素
     */
    push(item) {
        this.buffer[this.head] = item;
        this.head = (this.head + 1) % this.size;
        if (this.count < this.size) {
            this.count++;
        }
    }

    /**
     * 获取所有元素
     */
    getAll() {
        if (this.count === 0) return [];
        
        const result = [];
        let index = this.count < this.size ? 0 : this.head;
        
        for (let i = 0; i < this.count; i++) {
            result.push(this.buffer[index]);
            index = (index + 1) % this.size;
        }
        
        return result;
    }

    /**
     * 获取最近N个元素
     */
    getRecent(n) {
        const all = this.getAll();
        return all.slice(-n);
    }

    /**
     * 清空缓冲区
     */
    clear() {
        this.head = 0;
        this.count = 0;
        this.buffer.fill(undefined);
    }
}

/**
 * 告警管理器
 */
class AlertManager extends EventEmitter {
    constructor(config = {}) {
        super();
        this.rules = new Map();
        this.alertHistory = new CircularBuffer(config.alertHistorySize || 100);
        this.cooldownPeriod = config.cooldownPeriod || 60000; // 1分钟冷却期
        this.lastAlerts = new Map();
    }

    /**
     * 添加告警规则
     */
    addRule(name, condition, level = AlertLevel.WARNING, message = '') {
        this.rules.set(name, {
            condition,
            level,
            message,
            enabled: true
        });
    }

    /**
     * 检查告警条件
     */
    checkAlerts(metrics) {
        const now = Date.now();
        
        for (const [name, rule] of this.rules) {
            if (!rule.enabled) continue;
            
            // 检查冷却期
            const lastAlert = this.lastAlerts.get(name);
            if (lastAlert && (now - lastAlert) < this.cooldownPeriod) {
                continue;
            }
            
            try {
                if (rule.condition(metrics)) {
                    this.triggerAlert(name, rule, metrics);
                    this.lastAlerts.set(name, now);
                }
            } catch (error) {
                logger.error('告警规则检查失败', { rule: name, error: error.message });
            }
        }
    }

    /**
     * 触发告警
     */
    triggerAlert(name, rule, metrics) {
        const alert = {
            name,
            level: rule.level,
            message: rule.message,
            timestamp: Date.now(),
            metrics: metrics
        };
        
        this.alertHistory.push(alert);
        this.emit('alert', alert);
        
        logger.warn('性能告警触发', alert);
    }

    /**
     * 获取告警历史
     */
    getAlertHistory(limit = 50) {
        return this.alertHistory.getRecent(limit);
    }

    /**
     * 启用/禁用告警规则
     */
    toggleRule(name, enabled) {
        const rule = this.rules.get(name);
        if (rule) {
            rule.enabled = enabled;
        }
    }
}

/**
 * 性能监控器主类
 */
class PerformanceMonitor extends EventEmitter {
    constructor(config = {}) {
        super();
        
        // 配置参数
        this.config = {
            enabled: config.enabled !== false,
            bufferSize: config.bufferSize || 1000,
            collectInterval: config.collectInterval || 5000, // 5秒
            cleanupInterval: config.cleanupInterval || 300000, // 5分钟
            maxDataAge: config.maxDataAge || 3600000, // 1小时
            enableSystemMetrics: config.enableSystemMetrics !== false,
            enableCustomMetrics: config.enableCustomMetrics !== false,
            ...config
        };
        
        // 数据存储
        this.metrics = new CircularBuffer(this.config.bufferSize);
        this.statistics = new Map();
        this.counters = new Map();
        
        // 告警管理
        this.alertManager = new AlertManager(this.config.alert || {});
        
        // 定时器
        this.collectTimer = null;
        this.cleanupTimer = null;
        
        // 系统指标收集器
        this.systemCollectors = new Map();
        
        // 初始化
        this.initialize();
    }

    /**
     * 初始化监控器
     */
    initialize() {
        if (!this.config.enabled) {
            logger.info('性能监控已禁用');
            return;
        }
        
        this.setupSystemCollectors();
        this.setupDefaultAlerts();
        this.start();
        
        logger.info('性能监控器初始化完成', {
            config: this.config,
            collectors: Array.from(this.systemCollectors.keys())
        });
    }

    /**
     * 设置系统指标收集器
     */
    setupSystemCollectors() {
        if (!this.config.enableSystemMetrics) return;
        
        // 内存使用率收集器
        this.systemCollectors.set('memory', () => {
            const usage = process.memoryUsage();
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            
            return {
                heapUsed: usage.heapUsed,
                heapTotal: usage.heapTotal,
                external: usage.external,
                rss: usage.rss,
                systemTotal: totalMem,
                systemFree: freeMem,
                systemUsed: totalMem - freeMem,
                systemUsagePercent: ((totalMem - freeMem) / totalMem) * 100
            };
        });
        
        // CPU使用率收集器
        this.systemCollectors.set('cpu', () => {
            const cpus = os.cpus();
            const usage = process.cpuUsage();
            
            return {
                userTime: usage.user,
                systemTime: usage.system,
                cpuCount: cpus.length,
                loadAverage: os.loadavg()
            };
        });
        
        // 进程信息收集器
        this.systemCollectors.set('process', () => {
            return {
                pid: process.pid,
                uptime: process.uptime(),
                version: process.version,
                platform: process.platform,
                arch: process.arch
            };
        });
    }

    /**
     * 设置默认告警规则
     */
    setupDefaultAlerts() {
        // 内存使用率告警
        this.alertManager.addRule(
            'high_memory_usage',
            (metrics) => {
                const memMetric = metrics.find(m => m.type === MetricType.MEMORY_USAGE);
                return memMetric && memMetric.value.systemUsagePercent > 90;
            },
            AlertLevel.WARNING,
            '系统内存使用率超过90%'
        );
        
        // 响应时间告警
        this.alertManager.addRule(
            'slow_response',
            (metrics) => {
                const responseMetrics = metrics.filter(m => m.type === MetricType.RESPONSE_TIME);
                if (responseMetrics.length === 0) return false;
                
                const avgResponse = responseMetrics.reduce((sum, m) => sum + m.value, 0) / responseMetrics.length;
                return avgResponse > 5000; // 5秒
            },
            AlertLevel.ERROR,
            '平均响应时间超过5秒'
        );
        
        // 错误率告警
        this.alertManager.addRule(
            'high_error_rate',
            (metrics) => {
                const errorMetric = metrics.find(m => m.type === MetricType.ERROR_RATE);
                return errorMetric && errorMetric.value > 10; // 10%
            },
            AlertLevel.CRITICAL,
            '错误率超过10%'
        );
    }

    /**
     * 启动监控
     */
    start() {
        if (!this.config.enabled || this.collectTimer) return;
        
        // 启动数据收集定时器
        this.collectTimer = setInterval(() => {
            this.collectSystemMetrics();
        }, this.config.collectInterval);
        
        // 启动清理定时器
        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, this.config.cleanupInterval);
        
        logger.info('性能监控已启动');
        this.emit('started');
    }

    /**
     * 停止监控
     */
    stop() {
        if (this.collectTimer) {
            clearInterval(this.collectTimer);
            this.collectTimer = null;
        }
        
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
        
        logger.info('性能监控已停止');
        this.emit('stopped');
    }

    /**
     * 收集系统指标
     */
    collectSystemMetrics() {
        try {
            for (const [name, collector] of this.systemCollectors) {
                const data = collector();
                const metric = new Metric(
                    name === 'memory' ? MetricType.MEMORY_USAGE : 
                    name === 'cpu' ? MetricType.CPU_USAGE : MetricType.CUSTOM,
                    data,
                    Date.now(),
                    { collector: name }
                );
                
                this.addMetric(metric);
            }
        } catch (error) {
            ErrorHandler.handle(error, { context: 'collectSystemMetrics' });
        }
    }

    /**
     * 添加指标数据
     */
    addMetric(metric) {
        if (!this.config.enabled) return;
        
        this.metrics.push(metric);
        this.updateStatistics(metric);
        
        // 检查告警
        const recentMetrics = this.metrics.getRecent(10);
        this.alertManager.checkAlerts(recentMetrics);
        
        this.emit('metric', metric);
    }

    /**
     * 记录响应时间
     */
    recordResponseTime(duration, metadata = {}) {
        const metric = new Metric(MetricType.RESPONSE_TIME, duration, Date.now(), metadata);
        this.addMetric(metric);
    }

    /**
     * 记录连接数
     */
    recordConnectionCount(count, metadata = {}) {
        const metric = new Metric(MetricType.CONNECTION_COUNT, count, Date.now(), metadata);
        this.addMetric(metric);
    }

    /**
     * 记录错误率
     */
    recordErrorRate(rate, metadata = {}) {
        const metric = new Metric(MetricType.ERROR_RATE, rate, Date.now(), metadata);
        this.addMetric(metric);
    }

    /**
     * 记录吞吐量
     */
    recordThroughput(count, metadata = {}) {
        const metric = new Metric(MetricType.THROUGHPUT, count, Date.now(), metadata);
        this.addMetric(metric);
    }

    /**
     * 记录自定义指标
     */
    recordCustomMetric(name, value, metadata = {}) {
        const metric = new Metric(MetricType.CUSTOM, value, Date.now(), { name, ...metadata });
        this.addMetric(metric);
    }

    /**
     * 增加计数器
     */
    incrementCounter(name, value = 1) {
        const current = this.counters.get(name) || 0;
        this.counters.set(name, current + value);
    }

    /**
     * 获取计数器值
     */
    getCounter(name) {
        return this.counters.get(name) || 0;
    }

    /**
     * 重置计数器
     */
    resetCounter(name) {
        this.counters.set(name, 0);
    }

    /**
     * 记录计数器（兼容方法）
     */
    recordCounter(name, value = 1) {
        this.incrementCounter(name, value);
    }

    /**
     * 启动计时器
     */
    startTimer(name) {
        const startTime = Date.now();
        return {
            end: (metadata = {}) => {
                const duration = Date.now() - startTime;
                this.recordResponseTime(duration, { name, ...metadata });
                return duration;
            }
        };
    }

    /**
     * 更新统计信息
     */
    updateStatistics(metric) {
        const key = `${metric.type}_${metric.metadata.name || 'default'}`;
        let stats = this.statistics.get(key);
        
        if (!stats) {
            stats = new Statistics();
            this.statistics.set(key, stats);
        }
        
        if (typeof metric.value === 'number') {
            stats.addValue(metric.value);
        }
    }

    /**
     * 获取指标统计信息
     */
    getStatistics(type, name = 'default') {
        const key = `${type}_${name}`;
        const stats = this.statistics.get(key);
        
        if (!stats) return null;
        
        // 计算百分位数
        const recentMetrics = this.getMetrics(type, name, 100);
        const values = recentMetrics.map(m => typeof m.value === 'number' ? m.value : 0);
        stats.calculatePercentiles(values);
        
        return { ...stats };
    }

    /**
     * 获取指标数据
     */
    getMetrics(type = null, name = null, limit = 100) {
        let metrics = this.metrics.getRecent(limit);
        
        if (type) {
            metrics = metrics.filter(m => m.type === type);
        }
        
        if (name) {
            metrics = metrics.filter(m => m.metadata.name === name);
        }
        
        return metrics;
    }

    /**
     * 获取时间范围内的指标
     */
    getMetricsByTimeRange(startTime, endTime, type = null) {
        let metrics = this.metrics.getAll();
        
        metrics = metrics.filter(m => 
            m.timestamp >= startTime && m.timestamp <= endTime
        );
        
        if (type) {
            metrics = metrics.filter(m => m.type === type);
        }
        
        return metrics;
    }

    /**
     * 获取监控摘要
     */
    getSummary() {
        const now = Date.now();
        const oneHourAgo = now - 3600000;
        
        const recentMetrics = this.getMetricsByTimeRange(oneHourAgo, now);
        
        const summary = {
            timestamp: now,
            totalMetrics: recentMetrics.length,
            metricTypes: {},
            counters: Object.fromEntries(this.counters),
            alerts: this.alertManager.getAlertHistory(10),
            systemInfo: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                cpu: process.cpuUsage()
            }
        };
        
        // 按类型统计指标
        for (const metric of recentMetrics) {
            if (!summary.metricTypes[metric.type]) {
                summary.metricTypes[metric.type] = {
                    count: 0,
                    latest: null
                };
            }
            
            summary.metricTypes[metric.type].count++;
            
            if (!summary.metricTypes[metric.type].latest || 
                metric.timestamp > summary.metricTypes[metric.type].latest.timestamp) {
                summary.metricTypes[metric.type].latest = metric;
            }
        }
        
        return summary;
    }

    /**
     * 导出指标数据
     */
    exportMetrics(format = 'json', options = {}) {
        const metrics = this.getMetrics(null, null, options.limit || 1000);
        
        switch (format.toLowerCase()) {
            case 'json':
                return JSON.stringify(metrics, null, 2);
            
            case 'csv':
                return this.exportToCSV(metrics);
            
            case 'prometheus':
                return this.exportToPrometheus(metrics);
            
            default:
                throw new Error(`不支持的导出格式: ${format}`);
        }
    }

    /**
     * 导出为CSV格式
     */
    exportToCSV(metrics) {
        if (metrics.length === 0) return '';
        
        const headers = ['timestamp', 'type', 'value', 'metadata'];
        const rows = metrics.map(m => [
            new Date(m.timestamp).toISOString(),
            m.type,
            typeof m.value === 'object' ? JSON.stringify(m.value) : m.value,
            JSON.stringify(m.metadata)
        ]);
        
        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    /**
     * 导出为Prometheus格式
     */
    exportToPrometheus(metrics) {
        const lines = [];
        const metricGroups = new Map();
        
        // 按类型分组
        for (const metric of metrics) {
            if (!metricGroups.has(metric.type)) {
                metricGroups.set(metric.type, []);
            }
            metricGroups.get(metric.type).push(metric);
        }
        
        // 生成Prometheus格式
        for (const [type, typeMetrics] of metricGroups) {
            lines.push(`# TYPE ${type} gauge`);
            
            for (const metric of typeMetrics) {
                const labels = Object.entries(metric.metadata)
                    .map(([k, v]) => `${k}="${v}"`)
                    .join(',');
                
                const value = typeof metric.value === 'number' ? metric.value : 0;
                lines.push(`${type}{${labels}} ${value} ${metric.timestamp}`);
            }
        }
        
        return lines.join('\n');
    }

    /**
     * 清理过期数据
     */
    cleanup() {
        const now = Date.now();
        const cutoff = now - this.config.maxDataAge;
        
        // 清理过期的统计信息
        for (const [key, stats] of this.statistics) {
            if (stats.count === 0) {
                this.statistics.delete(key);
            }
        }
        
        logger.debug('性能监控数据清理完成', {
            timestamp: now,
            cutoff: new Date(cutoff).toISOString()
        });
    }

    /**
     * 重置所有数据
     */
    reset() {
        this.metrics.clear();
        this.statistics.clear();
        this.counters.clear();
        
        logger.info('性能监控数据已重置');
        this.emit('reset');
    }

    /**
     * 获取配置信息
     */
    getConfig() {
        return { ...this.config };
    }

    /**
     * 更新配置
     */
    updateConfig(newConfig) {
        const oldConfig = { ...this.config };
        this.config = { ...this.config, ...newConfig };
        
        // 如果启用状态改变，重启监控
        if (oldConfig.enabled !== this.config.enabled) {
            if (this.config.enabled) {
                this.start();
            } else {
                this.stop();
            }
        }
        
        logger.info('性能监控配置已更新', {
            oldConfig,
            newConfig: this.config
        });
        
        this.emit('configUpdated', this.config);
    }

    /**
     * 销毁监控器
     */
    destroy() {
        this.stop();
        this.reset();
        this.removeAllListeners();
        
        logger.info('性能监控器已销毁');
    }
}

/**
 * 性能监控装饰器
 */
function performanceMonitor(monitor, metricName = '') {
    return function(target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        
        descriptor.value = async function(...args) {
            const startTime = Date.now();
            const name = metricName || `${target.constructor.name}.${propertyKey}`;
            
            try {
                const result = await originalMethod.apply(this, args);
                const duration = Date.now() - startTime;
                
                monitor.recordResponseTime(duration, {
                    method: name,
                    success: true
                });
                
                return result;
            } catch (error) {
                const duration = Date.now() - startTime;
                
                monitor.recordResponseTime(duration, {
                    method: name,
                    success: false,
                    error: error.message
                });
                
                throw error;
            }
        };
        
        return descriptor;
    };
}

/**
 * 创建性能监控中间件
 */
function createPerformanceMiddleware(monitor) {
    return (req, res, next) => {
        const startTime = Date.now();
        
        res.on('finish', () => {
            const duration = Date.now() - startTime;
            const success = res.statusCode < 400;
            
            monitor.recordResponseTime(duration, {
                method: req.method,
                path: req.path,
                statusCode: res.statusCode,
                success
            });
            
            if (!success) {
                monitor.incrementCounter('http_errors');
            }
            
            monitor.incrementCounter('http_requests');
        });
        
        next();
    };
}

// 导出
export {
    PerformanceMonitor,
    Metric,
    Statistics,
    CircularBuffer,
    AlertManager,
    MetricType,
    AlertLevel,
    performanceMonitor,
    createPerformanceMiddleware
};

export default PerformanceMonitor;