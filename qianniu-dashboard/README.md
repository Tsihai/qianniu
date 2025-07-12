# 千牛客服自动化系统 - 实时监控仪表板

一个基于 Next.js 15 和 React 19 构建的现代化实时监控仪表板，提供全面的系统性能监控、WebSocket 连接监控和数据可视化功能。

## 🚀 特性

- **实时性能监控** - CPU、内存、API响应时间、错误率等关键指标
- **WebSocket 连接监控** - 连接质量、历史记录、实时状态展示
- **数据可视化** - 交互式图表、实时数据流动画
- **智能警告系统** - 可配置阈值、多级别警告
- **响应式设计** - 支持桌面和移动设备
- **TypeScript 支持** - 完整的类型定义和类型安全

## 📋 技术栈

- **框架**: Next.js 15 (App Router)
- **UI库**: React 19
- **样式**: Tailwind CSS
- **图表**: Recharts
- **状态管理**: React Hooks + useSyncExternalStore
- **类型检查**: TypeScript
- **WebSocket**: 原生 WebSocket API

## 🛠️ 安装和运行

### 环境要求

- Node.js 18.17 或更高版本
- npm 或 yarn 包管理器

### 安装依赖

```bash
npm install
# 或
yarn install
```

### 开发模式

```bash
npm run dev
# 或
yarn dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

### 生产构建

```bash
npm run build
npm start
# 或
yarn build
yarn start
```

## 📖 API 文档

### 性能监控 Hook

#### `usePerformanceMetrics`

用于监控系统性能指标的 React Hook。

```typescript
const {
  currentMetrics,
  metricsHistory,
  trends,
  alerts,
  stats,
  isMonitoring,
  startMonitoring,
  stopMonitoring,
  clearHistory,
  getPerformanceReport
} = usePerformanceMetrics(config, thresholds, events);
```

**参数:**

- `config` - 性能监控配置
  - `sampleInterval`: 采样间隔（毫秒），默认 1000
  - `maxDataPoints`: 最大数据点数量，默认 100
  - `enableCpuMonitoring`: 启用 CPU 监控，默认 true
  - `enableMemoryMonitoring`: 启用内存监控，默认 true
  - `enableApiMonitoring`: 启用 API 监控，默认 true
  - `enableErrorMonitoring`: 启用错误监控，默认 true
  - `enableFpsMonitoring`: 启用 FPS 监控，默认 false

- `thresholds` - 性能阈值配置
  - `cpu`: CPU 使用率阈值 `{ warning: 70, critical: 90 }`
  - `memory`: 内存使用量阈值 `{ warning: 512, critical: 1024 }`
  - `apiResponseTime`: API 响应时间阈值 `{ warning: 1000, critical: 3000 }`
  - `errorRate`: 错误率阈值 `{ warning: 5, critical: 10 }`
  - `fps`: 帧率阈值 `{ warning: 30, critical: 15 }`

- `events` - 事件回调函数
  - `onMetricsUpdate`: 指标更新回调
  - `onAlert`: 警告产生回调
  - `onThresholdExceeded`: 阈值超出回调
  - `onMonitoringStart`: 监控开始回调
  - `onMonitoringStop`: 监控停止回调
  - `onError`: 错误回调

**返回值:**

- `currentMetrics`: 当前性能指标
- `metricsHistory`: 历史性能数据
- `trends`: 性能趋势分析
- `alerts`: 警告列表
- `stats`: 统计信息
- `isMonitoring`: 是否正在监控
- `startMonitoring()`: 开始监控
- `stopMonitoring()`: 停止监控
- `clearHistory()`: 清除历史数据
- `getPerformanceReport()`: 获取性能报告

### WebSocket 监控 Hook

#### `useWebSocketMonitoring`

用于监控 WebSocket 连接质量和状态的 React Hook。

```typescript
const {
  connectionHistory,
  connectionQuality,
  realtimeStats,
  isConnected,
  sendMonitoredMessage,
  sendMonitoredJsonMessage,
  getQualityColor,
  getQualityDescription
} = useWebSocketMonitoring(url, options);
```

**参数:**

- `url`: WebSocket 连接地址
- `options`: 监控选项
  - `maxHistorySize`: 最大历史记录数量，默认 50
  - `qualityCheckInterval`: 质量检查间隔，默认 5000ms
  - `latencyCheckInterval`: 延迟检查间隔，默认 10000ms

**返回值:**

- `connectionHistory`: 连接历史记录
- `connectionQuality`: 连接质量信息
- `realtimeStats`: 实时统计数据
- `isConnected`: 连接状态
- `sendMonitoredMessage()`: 发送监控消息
- `sendMonitoredJsonMessage()`: 发送监控 JSON 消息
- `getQualityColor()`: 获取质量颜色
- `getQualityDescription()`: 获取质量描述

## 🎯 使用示例

### 基础性能监控

```tsx
import { usePerformanceMetrics } from '@/hooks/usePerformanceMetrics';

function PerformanceMonitor() {
  const {
    currentMetrics,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    alerts
  } = usePerformanceMetrics({
    sampleInterval: 2000,
    enableFpsMonitoring: true
  }, {
    cpu: { warning: 70, critical: 90 },
    memory: { warning: 512, critical: 1024 }
  }, {
    onAlert: (alert) => {
      console.log('Performance alert:', alert);
    }
  });

  useEffect(() => {
    startMonitoring();
    return () => stopMonitoring();
  }, []);

  return (
    <div>
      <h2>性能监控</h2>
      <p>监控状态: {isMonitoring ? '运行中' : '已停止'}</p>
      {currentMetrics && (
        <div>
          <p>CPU: {currentMetrics.cpu}%</p>
          <p>内存: {currentMetrics.memory}MB</p>
          <p>API响应时间: {currentMetrics.apiResponseTime}ms</p>
        </div>
      )}
      {alerts.length > 0 && (
        <div>
          <h3>警告</h3>
          {alerts.map(alert => (
            <div key={alert.id} className={`alert-${alert.level}`}>
              {alert.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### WebSocket 连接监控

```tsx
import { useWebSocketMonitoring } from '@/hooks/useWebSocketMonitoring';

function WebSocketMonitor() {
  const {
    connectionQuality,
    realtimeStats,
    isConnected,
    getQualityColor,
    getQualityDescription
  } = useWebSocketMonitoring('ws://localhost:8080', {
    maxHistorySize: 100,
    qualityCheckInterval: 3000
  });

  return (
    <div>
      <h2>WebSocket 监控</h2>
      <p>连接状态: {isConnected ? '已连接' : '未连接'}</p>
      <div>
        <p>连接质量: 
          <span style={{ color: getQualityColor(connectionQuality.score) }}>
            {getQualityDescription(connectionQuality.score)}
          </span>
        </p>
        <p>延迟: {connectionQuality.latency}ms</p>
        <p>稳定性: {connectionQuality.stability}%</p>
      </div>
      <div>
        <h3>实时统计</h3>
        <p>接收消息: {realtimeStats.messagesReceived}</p>
        <p>错误次数: {realtimeStats.errors}</p>
        <p>带宽使用: {realtimeStats.bandwidth} bytes/s</p>
      </div>
    </div>
  );
}
```

## 🏗️ 项目结构

```
src/
├── app/                    # Next.js App Router
│   ├── dashboard/         # 仪表板页面
│   │   ├── page.tsx      # 主仪表板页面
│   │   ├── layout.tsx    # 仪表板布局
│   │   ├── loading.tsx   # 加载页面
│   │   └── error.tsx     # 错误页面
│   ├── globals.css       # 全局样式
│   └── layout.tsx        # 根布局
├── components/            # React 组件
│   ├── ui/               # 基础 UI 组件
│   ├── charts/           # 图表组件
│   └── monitoring/       # 监控相关组件
├── hooks/                # 自定义 Hooks
│   ├── usePerformanceMetrics.ts
│   ├── useWebSocketMonitoring.ts
│   ├── useWebSocket.ts
│   └── useRealTimeData.ts
├── types/                # TypeScript 类型定义
│   └── monitoring.ts
└── lib/                  # 工具函数
    └── utils.ts
```

## 🔧 配置

### 环境变量

创建 `.env.local` 文件：

```env
# WebSocket 服务器地址
NEXT_PUBLIC_WS_URL=ws://localhost:8080

# API 基础地址
NEXT_PUBLIC_API_URL=http://localhost:3001

# 监控配置
NEXT_PUBLIC_MONITORING_INTERVAL=1000
NEXT_PUBLIC_MAX_DATA_POINTS=100
```

### 自定义主题

在 `tailwind.config.js` 中自定义主题：

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          900: '#1e3a8a',
        },
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
      },
    },
  },
};
```

## 🧪 测试

```bash
# 运行测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 运行 E2E 测试
npm run test:e2e
```

## 📝 开发指南

### 添加新的性能指标

1. 在 `types/monitoring.ts` 中扩展 `PerformanceMetrics` 接口
2. 在 `usePerformanceMetrics.ts` 中添加收集逻辑
3. 更新阈值配置和警告检查
4. 在仪表板中添加显示组件

### 创建自定义图表

1. 在 `components/charts/` 中创建新组件
2. 使用 Recharts 库构建图表
3. 集成实时数据更新
4. 添加交互功能

### 扩展 WebSocket 功能

1. 在 `useWebSocketMonitoring.ts` 中添加新的监控指标
2. 更新类型定义
3. 在 UI 中显示新指标

## 🤝 贡献

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🆘 支持

如果您遇到问题或有疑问，请：

1. 查看 [Issues](https://github.com/your-repo/issues) 页面
2. 创建新的 Issue
3. 联系开发团队

## 🔄 更新日志

### v1.0.0 (2025-01-12)

- ✨ 初始版本发布
- 🚀 实时性能监控功能
- 📊 WebSocket 连接监控
- 📈 数据可视化图表
- ⚠️ 智能警告系统
- 📱 响应式设计支持