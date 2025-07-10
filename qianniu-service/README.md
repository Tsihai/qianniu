# 千牛客服自动化系统

一个轻量级的千牛客服自动化系统，实现买家咨询消息的实时捕获与分类处理，提升客服效率。

## 项目概述

本项目旨在借鉴SaiNiuApi框架的设计理念，开发一个轻量级的千牛客服自动化系统，实现买家咨询消息的实时捕获与分类处理。系统主要包括通信模块和消息处理模块，通过WebSocket实现与千牛客户端的实时通信，并对消息进行智能分析和处理。

## 功能特性

- 实时捕获买家咨询消息
- 自动分析消息内容和意图
- 根据意图提供回复建议
- 会话状态管理
- REST API 接口支持

## 项目结构

```
qianniu-service/
├── docs/                    # 文档目录
│   ├── message-protocol.md  # 消息协议文档
│   └── message-processor.md # 消息处理模块文档
├── src/
│   ├── config/              # 配置文件
│   │   └── index.js         # 主配置
│   ├── controllers/         # 控制器 (预留)
│   ├── models/              # 数据模型 (预留)
│   ├── services/            # 服务层
│   │   ├── messageProcessor/  # 消息处理模块
│   │   │   ├── data/          # 数据文件
│   │   │   ├── index.js       # 消息处理主模块
│   │   │   ├── MessageParser.js     # 消息解析器
│   │   │   ├── IntentClassifier.js  # 意图分类器
│   │   │   └── ReplyRecommender.js  # 回复推荐器
│   │   └── websocketService.js # WebSocket服务
│   ├── utils/               # 工具函数
│   │   └── wsClient.js      # WebSocket客户端工具
│   ├── tests/               # 测试文件
│   │   ├── websocketService.test.js  # WebSocket服务测试
│   │   └── messageProcessor.test.js  # 消息处理模块测试
│   └── index.js             # 应用入口
└── package.json             # 项目依赖
```

## 已完成模块

### 1. 通信模块 (WebSocketService)

- WebSocket服务器创建与配置
- 客户端连接管理
- 消息接收与发送
- 心跳检测机制
- 错误处理与连接恢复

### 2. 消息处理模块 (MessageProcessor)

- 消息解析与清理
- 关键词提取
- 意图识别
- 回复推荐
- 会话状态管理

## 安装与运行

### 安装依赖

```bash
npm install
```

### 运行服务

```bash
node src/index.js
```

### 运行测试

```bash
# 测试WebSocket服务
node src/tests/websocketService.test.js

# 测试消息处理模块
node src/tests/messageProcessor.test.js
```

## REST API 接口

### 状态查询

```
GET /api/status
```

### 客户端列表

```
GET /api/clients
```

### 发送消息

```
POST /api/message
Content-Type: application/json

{
  "clientId": "client-001",
  "message": {
    "type": "chat",
    "content": "测试消息"
  }
}
```

### 广播消息

```
POST /api/broadcast
Content-Type: application/json

{
  "message": {
    "type": "system",
    "content": "系统公告"
  },
  "exclude": ["client-001"]
}
```

### 消息处理测试

```
POST /api/process-message
Content-Type: application/json

{
  "message": {
    "type": "chat",
    "clientId": "test-client",
    "content": "这个商品多少钱？"
  }
}
```

## WebSocket通信

### 连接地址

```
ws://localhost:8080/ws
```

### 消息格式

发送消息：
```json
{
  "type": "chat",
  "content": "这个商品多少钱？"
}
```

接收消息：
```json
{
  "type": "chat",
  "content": "这款产品的价格是XX元",
  "timestamp": 1625097600000
}
```

## 后续计划

- 优化消息处理模块的意图识别准确率
- 实现业务逻辑模块，处理具体业务场景
- 开发数据存储模块，保存历史消息和统计信息
- 开发用户界面，提供可视化操作

## 依赖库

- Express: Web服务框架
- ws: WebSocket实现
- natural: 自然语言处理
- nodejieba: 中文分词

## 参考文档

- [消息协议文档](docs/message-protocol.md)
- [消息处理模块文档](docs/message-processor.md)

## 版本记录

- v0.2.0: 实现消息处理模块 (2025/7/10)
- v0.1.0: 实现WebSocket通信模块 (2025/7/8) 