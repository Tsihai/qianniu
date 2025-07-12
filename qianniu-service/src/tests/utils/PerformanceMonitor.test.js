const {
    PerformanceMonitor,
    Metric,
    Statistics,
    CircularBuffer,
    AlertManager,
    MetricType,
    AlertLevel,
    performanceMonitor,
    createPerformanceMiddleware
} = require('../../utils/PerformanceMonitor');

describe('PerformanceMonitor', () => {
    let monitor;
    
    beforeEach(() => {
        monitor = new PerformanceMonitor({
            enabled: true,
            bufferSize: 100,
            collectInterval: 1000,
            cleanupInterval: 5000
        });
    });
    
    afterEach(() => {
        if (monitor) {
            monitor.destroy();
        }
    });

    describe('Metric类', () => {
        test('应该正确创建指标实例', () => {
            const metric = new Metric(MetricType.RESPONSE_TIME, 100, Date.now(), { test: true });
            
            expect(metric.type).toBe(MetricType.RESPONSE_TIME);
            expect(metric.value).toBe(100);
            expect(metric.metadata.test).toBe(true);
            expect(metric.id).toBeDefined();
        });
        
        test('应该支持序列化和反序列化', () => {
            const original = new Metric(MetricType.MEMORY_USAGE, 50, Date.now(), { source: 'test' });
            const json = original.toJSON();
            const restored = Metric.fromJSON(json);
            
            expect(restored.type).toBe(original.type);
            expect(restored.value).toBe(original.value);
            expect(restored.timestamp).toBe(original.timestamp);
            expect(restored.metadata).toEqual(original.metadata);
            expect(restored.id).toBe(original.id);
        });
    });

    describe('Statistics类', () => {
        let stats;
        
        beforeEach(() => {
            stats = new Statistics();
        });
        
        test('应该正确计算基本统计信息', () => {
            const values = [10, 20, 30, 40, 50];
            
            values.forEach(value => stats.addValue(value));
            
            expect(stats.count).toBe(5);
            expect(stats.sum).toBe(150);
            expect(stats.min).toBe(10);
            expect(stats.max).toBe(50);
            expect(stats.avg).toBe(30);
        });
        
        test('应该正确计算百分位数', () => {
            const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
            
            values.forEach(value => stats.addValue(value));
            stats.calculatePercentiles(values);
            
            expect(stats.p50).toBe(5);
            expect(stats.p95).toBe(10);
            expect(stats.p99).toBe(10);
        });
        
        test('应该支持重置统计信息', () => {
            stats.addValue(100);
            stats.reset();
            
            expect(stats.count).toBe(0);
            expect(stats.sum).toBe(0);
            expect(stats.min).toBe(Infinity);
            expect(stats.max).toBe(-Infinity);
            expect(stats.avg).toBe(0);
        });
    });

    describe('CircularBuffer类', () => {
        let buffer;
        
        beforeEach(() => {
            buffer = new CircularBuffer(3);
        });
        
        test('应该正确添加和获取元素', () => {
            buffer.push(1);
            buffer.push(2);
            buffer.push(3);
            
            const all = buffer.getAll();
            expect(all).toEqual([1, 2, 3]);
        });
        
        test('应该在超出容量时覆盖旧元素', () => {
            buffer.push(1);
            buffer.push(2);
            buffer.push(3);
            buffer.push(4);
            
            const all = buffer.getAll();
            expect(all).toEqual([2, 3, 4]);
        });
        
        test('应该正确获取最近的元素', () => {
            buffer.push(1);
            buffer.push(2);
            buffer.push(3);
            buffer.push(4);
            buffer.push(5);
            
            const recent = buffer.getRecent(2);
            expect(recent).toEqual([4, 5]);
        });
        
        test('应该支持清空缓冲区', () => {
            buffer.push(1);
            buffer.push(2);
            buffer.clear();
            
            const all = buffer.getAll();
            expect(all).toEqual([]);
        });
    });

    describe('AlertManager类', () => {
        let alertManager;
        
        beforeEach(() => {
            alertManager = new AlertManager({
                cooldownPeriod: 100
            });
        });
        
        test('应该正确添加告警规则', () => {
            alertManager.addRule(
                'test_rule',
                (metrics) => metrics.length > 0,
                AlertLevel.WARNING,
                'Test alert'
            );
            
            expect(alertManager.rules.has('test_rule')).toBe(true);
        });
        
        test('应该在条件满足时触发告警', (done) => {
            alertManager.addRule(
                'test_rule',
                (metrics) => metrics.length > 0,
                AlertLevel.WARNING,
                'Test alert'
            );
            
            alertManager.on('alert', (alert) => {
                expect(alert.name).toBe('test_rule');
                expect(alert.level).toBe(AlertLevel.WARNING);
                expect(alert.message).toBe('Test alert');
                done();
            });
            
            const metrics = [new Metric(MetricType.RESPONSE_TIME, 100)];
            alertManager.checkAlerts(metrics);
        });
        
        test('应该遵守冷却期限制', (done) => {
            let alertCount = 0;
            
            alertManager.addRule(
                'test_rule',
                () => true,
                AlertLevel.WARNING,
                'Test alert'
            );
            
            alertManager.on('alert', () => {
                alertCount++;
            });
            
            const metrics = [new Metric(MetricType.RESPONSE_TIME, 100)];
            
            // 第一次触发
            alertManager.checkAlerts(metrics);
            
            // 立即再次检查，应该被冷却期阻止
            alertManager.checkAlerts(metrics);
            
            expect(alertCount).toBe(1);
            
            // 等待冷却期结束
            setTimeout(() => {
                alertManager.checkAlerts(metrics);
                expect(alertCount).toBe(2);
                done();
            }, 150);
        });
        
        test('应该支持启用/禁用告警规则', () => {
            alertManager.addRule('test_rule', () => true);
            alertManager.toggleRule('test_rule', false);
            
            const rule = alertManager.rules.get('test_rule');
            expect(rule.enabled).toBe(false);
        });
    });

    describe('PerformanceMonitor主类', () => {
        test('应该正确初始化', () => {
            expect(monitor.config.enabled).toBe(true);
            expect(monitor.metrics).toBeDefined();
            expect(monitor.statistics).toBeDefined();
            expect(monitor.alertManager).toBeDefined();
        });
        
        test('应该支持启动和停止监控', () => {
            monitor.stop();
            expect(monitor.collectTimer).toBeNull();
            
            monitor.start();
            expect(monitor.collectTimer).toBeDefined();
        });
        
        test('应该正确记录响应时间指标', () => {
            const duration = 100;
            const metadata = { method: 'test' };
            
            monitor.recordResponseTime(duration, metadata);
            
            const metrics = monitor.getMetrics(MetricType.RESPONSE_TIME);
            expect(metrics.length).toBe(1);
            expect(metrics[0].value).toBe(duration);
            expect(metrics[0].metadata.method).toBe('test');
        });
        
        test('应该正确记录连接数指标', () => {
            const count = 50;
            
            monitor.recordConnectionCount(count);
            
            const metrics = monitor.getMetrics(MetricType.CONNECTION_COUNT);
            expect(metrics.length).toBe(1);
            expect(metrics[0].value).toBe(count);
        });
        
        test('应该正确记录错误率指标', () => {
            const rate = 5.5;
            
            monitor.recordErrorRate(rate);
            
            const metrics = monitor.getMetrics(MetricType.ERROR_RATE);
            expect(metrics.length).toBe(1);
            expect(metrics[0].value).toBe(rate);
        });
        
        test('应该正确记录吞吐量指标', () => {
            const count = 1000;
            
            monitor.recordThroughput(count);
            
            const metrics = monitor.getMetrics(MetricType.THROUGHPUT);
            expect(metrics.length).toBe(1);
            expect(metrics[0].value).toBe(count);
        });
        
        test('应该正确记录自定义指标', () => {
            const name = 'custom_metric';
            const value = 42;
            const metadata = { source: 'test' };
            
            monitor.recordCustomMetric(name, value, metadata);
            
            const metrics = monitor.getMetrics(MetricType.CUSTOM);
            expect(metrics.length).toBe(1);
            expect(metrics[0].value).toBe(value);
            expect(metrics[0].metadata.name).toBe(name);
            expect(metrics[0].metadata.source).toBe('test');
        });
        
        test('应该正确管理计数器', () => {
            const counterName = 'test_counter';
            
            monitor.incrementCounter(counterName, 5);
            expect(monitor.getCounter(counterName)).toBe(5);
            
            monitor.incrementCounter(counterName, 3);
            expect(monitor.getCounter(counterName)).toBe(8);
            
            monitor.resetCounter(counterName);
            expect(monitor.getCounter(counterName)).toBe(0);
        });
        
        test('应该正确获取统计信息', () => {
            // 添加一些测试数据
            for (let i = 1; i <= 10; i++) {
                monitor.recordResponseTime(i * 100);
            }
            
            const stats = monitor.getStatistics(MetricType.RESPONSE_TIME);
            
            expect(stats).toBeDefined();
            expect(stats.count).toBe(10);
            expect(stats.min).toBe(100);
            expect(stats.max).toBe(1000);
            expect(stats.avg).toBe(550);
        });
        
        test('应该支持按时间范围查询指标', () => {
            const now = Date.now();
            const oneHourAgo = now - 3600000;
            
            // 添加一些测试数据
            monitor.addMetric(new Metric(MetricType.RESPONSE_TIME, 100, oneHourAgo + 1000));
            monitor.addMetric(new Metric(MetricType.RESPONSE_TIME, 200, now - 1000));
            
            const metrics = monitor.getMetricsByTimeRange(oneHourAgo, now);
            expect(metrics.length).toBe(2);
            
            const recentMetrics = monitor.getMetricsByTimeRange(now - 2000, now);
            expect(recentMetrics.length).toBe(1);
        });
        
        test('应该正确生成监控摘要', () => {
            monitor.recordResponseTime(100);
            monitor.recordConnectionCount(50);
            monitor.incrementCounter('test_counter', 10);
            
            const summary = monitor.getSummary();
            
            expect(summary.timestamp).toBeDefined();
            expect(summary.totalMetrics).toBeGreaterThan(0);
            expect(summary.metricTypes).toBeDefined();
            expect(summary.counters.test_counter).toBe(10);
            expect(summary.systemInfo).toBeDefined();
        });
        
        test('应该支持导出JSON格式数据', () => {
            monitor.recordResponseTime(100);
            monitor.recordResponseTime(200);
            
            const exported = monitor.exportMetrics('json');
            const data = JSON.parse(exported);
            
            expect(Array.isArray(data)).toBe(true);
            expect(data.length).toBeGreaterThan(0);
        });
        
        test('应该支持导出CSV格式数据', () => {
            monitor.recordResponseTime(100, { method: 'test' });
            
            const exported = monitor.exportMetrics('csv');
            
            expect(typeof exported).toBe('string');
            expect(exported).toContain('timestamp,type,value,metadata');
            expect(exported).toContain('response_time');
        });
        
        test('应该支持导出Prometheus格式数据', () => {
            monitor.recordResponseTime(100, { method: 'test' });
            
            const exported = monitor.exportMetrics('prometheus');
            
            expect(typeof exported).toBe('string');
            expect(exported).toContain('# TYPE response_time gauge');
            expect(exported).toContain('response_time{');
        });
        
        test('应该支持配置更新', () => {
            const newConfig = {
                bufferSize: 200,
                collectInterval: 2000
            };
            
            monitor.updateConfig(newConfig);
            
            expect(monitor.config.bufferSize).toBe(200);
            expect(monitor.config.collectInterval).toBe(2000);
        });
        
        test('应该支持重置数据', () => {
            monitor.recordResponseTime(100);
            monitor.incrementCounter('test', 5);
            
            monitor.reset();
            
            expect(monitor.getMetrics().length).toBe(0);
            expect(monitor.getCounter('test')).toBe(0);
        });
        
        test('应该在禁用时不收集指标', () => {
            monitor.updateConfig({ enabled: false });
            
            monitor.recordResponseTime(100);
            
            const metrics = monitor.getMetrics();
            expect(metrics.length).toBe(0);
        });
    });

    describe('装饰器功能', () => {
        test('performanceMonitor装饰器应该正确工作', async () => {
            class TestClass {
                @performanceMonitor(monitor, 'test_method')
                async testMethod(delay = 10) {
                    return new Promise(resolve => {
                        setTimeout(() => resolve('success'), delay);
                    });
                }
                
                @performanceMonitor(monitor, 'error_method')
                async errorMethod() {
                    throw new Error('Test error');
                }
            }
            
            const instance = new TestClass();
            
            // 测试成功情况
            const result = await instance.testMethod(50);
            expect(result).toBe('success');
            
            // 测试错误情况
            try {
                await instance.errorMethod();
            } catch (error) {
                expect(error.message).toBe('Test error');
            }
            
            // 检查指标是否被记录
            const metrics = monitor.getMetrics(MetricType.RESPONSE_TIME);
            expect(metrics.length).toBe(2);
            
            const successMetric = metrics.find(m => m.metadata.method === 'test_method');
            const errorMetric = metrics.find(m => m.metadata.method === 'error_method');
            
            expect(successMetric.metadata.success).toBe(true);
            expect(errorMetric.metadata.success).toBe(false);
            expect(errorMetric.metadata.error).toBe('Test error');
        });
    });

    describe('中间件功能', () => {
        test('createPerformanceMiddleware应该正确工作', (done) => {
            const middleware = createPerformanceMiddleware(monitor);
            
            // 模拟Express请求和响应对象
            const req = {
                method: 'GET',
                path: '/test'
            };
            
            const res = {
                statusCode: 200,
                on: jest.fn((event, callback) => {
                    if (event === 'finish') {
                        // 模拟响应完成
                        setTimeout(callback, 10);
                    }
                })
            };
            
            const next = jest.fn();
            
            middleware(req, res, next);
            
            expect(next).toHaveBeenCalled();
            
            // 等待响应完成事件
            setTimeout(() => {
                const metrics = monitor.getMetrics(MetricType.RESPONSE_TIME);
                expect(metrics.length).toBeGreaterThan(0);
                
                const metric = metrics[0];
                expect(metric.metadata.method).toBe('GET');
                expect(metric.metadata.path).toBe('/test');
                expect(metric.metadata.statusCode).toBe(200);
                expect(metric.metadata.success).toBe(true);
                
                expect(monitor.getCounter('http_requests')).toBe(1);
                expect(monitor.getCounter('http_errors')).toBe(0);
                
                done();
            }, 50);
        });
        
        test('中间件应该正确处理错误响应', (done) => {
            const middleware = createPerformanceMiddleware(monitor);
            
            const req = {
                method: 'POST',
                path: '/error'
            };
            
            const res = {
                statusCode: 500,
                on: jest.fn((event, callback) => {
                    if (event === 'finish') {
                        setTimeout(callback, 10);
                    }
                })
            };
            
            const next = jest.fn();
            
            middleware(req, res, next);
            
            setTimeout(() => {
                const metrics = monitor.getMetrics(MetricType.RESPONSE_TIME);
                const metric = metrics[metrics.length - 1];
                
                expect(metric.metadata.success).toBe(false);
                expect(monitor.getCounter('http_errors')).toBe(1);
                
                done();
            }, 50);
        });
    });

    describe('集成测试', () => {
        test('应该正确集成所有组件', (done) => {
            // 设置告警监听
            monitor.alertManager.on('alert', (alert) => {
                expect(alert.name).toBe('slow_response');
                done();
            });
            
            // 记录一个慢响应，触发告警
            monitor.recordResponseTime(6000); // 6秒，超过默认阈值
            
            // 等待告警检查
            setTimeout(() => {
                const recentMetrics = monitor.getMetrics(MetricType.RESPONSE_TIME, null, 10);
                monitor.alertManager.checkAlerts(recentMetrics);
            }, 10);
        });
        
        test('应该正确处理大量数据', () => {
            const startTime = Date.now();
            
            // 添加大量指标数据
            for (let i = 0; i < 1000; i++) {
                monitor.recordResponseTime(Math.random() * 1000);
                monitor.recordConnectionCount(Math.floor(Math.random() * 100));
                monitor.incrementCounter('test_counter');
            }
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            // 验证性能
            expect(duration).toBeLessThan(1000); // 应该在1秒内完成
            
            // 验证数据完整性
            expect(monitor.getCounter('test_counter')).toBe(1000);
            
            const summary = monitor.getSummary();
            expect(summary.totalMetrics).toBeGreaterThan(0);
        });
    });

    describe('错误处理', () => {
        test('应该正确处理无效的导出格式', () => {
            expect(() => {
                monitor.exportMetrics('invalid_format');
            }).toThrow('不支持的导出格式: invalid_format');
        });
        
        test('应该正确处理空数据导出', () => {
            const csvExport = monitor.exportMetrics('csv');
            expect(csvExport).toBe('');
            
            const jsonExport = monitor.exportMetrics('json');
            expect(JSON.parse(jsonExport)).toEqual([]);
        });
        
        test('应该正确处理告警规则异常', () => {
            // 添加一个会抛出异常的告警规则
            monitor.alertManager.addRule(
                'error_rule',
                () => {
                    throw new Error('Rule error');
                }
            );
            
            // 检查告警不应该抛出异常
            expect(() => {
                monitor.alertManager.checkAlerts([]);
            }).not.toThrow();
        });
    });

    describe('内存管理', () => {
        test('应该正确限制缓冲区大小', () => {
            const smallMonitor = new PerformanceMonitor({
                enabled: true,
                bufferSize: 5
            });
            
            // 添加超过缓冲区大小的数据
            for (let i = 0; i < 10; i++) {
                smallMonitor.recordResponseTime(i * 100);
            }
            
            const metrics = smallMonitor.getMetrics();
            expect(metrics.length).toBeLessThanOrEqual(5);
            
            smallMonitor.destroy();
        });
        
        test('应该正确清理过期数据', () => {
            monitor.cleanup();
            
            // 验证清理操作不会抛出异常
            expect(() => monitor.cleanup()).not.toThrow();
        });
    });
});

// 性能基准测试
describe('性能基准测试', () => {
    let monitor;
    
    beforeEach(() => {
        monitor = new PerformanceMonitor({
            enabled: true,
            bufferSize: 10000
        });
    });
    
    afterEach(() => {
        monitor.destroy();
    });
    
    test('大量指标添加性能测试', () => {
        const startTime = process.hrtime.bigint();
        
        for (let i = 0; i < 10000; i++) {
            monitor.recordResponseTime(Math.random() * 1000);
        }
        
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000; // 转换为毫秒
        
        console.log(`添加10000个指标耗时: ${duration.toFixed(2)}ms`);
        
        // 性能要求：10000个指标添加应该在1000ms内完成
        expect(duration).toBeLessThan(1000);
    });
    
    test('统计计算性能测试', () => {
        // 先添加数据
        for (let i = 0; i < 1000; i++) {
            monitor.recordResponseTime(Math.random() * 1000);
        }
        
        const startTime = process.hrtime.bigint();
        
        for (let i = 0; i < 100; i++) {
            monitor.getStatistics(MetricType.RESPONSE_TIME);
        }
        
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000;
        
        console.log(`100次统计计算耗时: ${duration.toFixed(2)}ms`);
        
        // 性能要求：100次统计计算应该在50ms内完成
        expect(duration).toBeLessThan(50);
    });
    
    test('数据导出性能测试', () => {
        // 先添加数据
        for (let i = 0; i < 1000; i++) {
            monitor.recordResponseTime(Math.random() * 1000, {
                method: `method_${i % 10}`,
                path: `/path/${i % 5}`
            });
        }
        
        const startTime = process.hrtime.bigint();
        
        const jsonExport = monitor.exportMetrics('json');
        const csvExport = monitor.exportMetrics('csv');
        const prometheusExport = monitor.exportMetrics('prometheus');
        
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000;
        
        console.log(`导出1000个指标(3种格式)耗时: ${duration.toFixed(2)}ms`);
        
        // 验证导出结果不为空
        expect(jsonExport.length).toBeGreaterThan(0);
        expect(csvExport.length).toBeGreaterThan(0);
        expect(prometheusExport.length).toBeGreaterThan(0);
        
        // 性能要求：导出操作应该在200ms内完成
        expect(duration).toBeLessThan(200);
    });
});