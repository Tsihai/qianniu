# 千牛客服自动化系统 - 通信模块

本项目是千牛客服自动化系统的通信模块，主要负责与千牛客户端的实时消息交互。

## 功能特性

- WebSocket服务器实现，支持实时双向通信
- 消息处理与路由机制
- 客户端连接管理
- 心跳检测确保连接稳定性
- REST API接口用于系统状态监控和控制
- 自动重连机制

## 技术栈

- Node.js
- Express (HTTP服务器)
- ws (WebSocket实现)
- dotenv (环境配置)
- cors (跨域支持)

## 安装与运行

### 安装依赖

```bash
npm install
```

### 配置环境变量

创建或编辑 `.env` 文件：

```
PORT=8080            # HTTP服务端口
NODE_ENV=development # 环境设置
WS_PORT=8081         # WebSocket服务端口
```

### 启动服务

开发模式（自动重启）:

```bash
npm run dev
```

生产模式:

```bash
npm start
```

### 测试客户端

启动内置的WebSocket客户端测试工具：

```bash
npm run test-client
```

## API接口

### 系统状态

```
GET /
```

返回系统基本状态信息。

### WebSocket连接状态

```
GET /ws/status
```

返回WebSocket服务状态和当前连接的客户端信息。

### 广播消息

```
POST /ws/broadcast
Content-Type: application/json

{
  "message": "广播消息内容"
}
```

向所有连接的客户端发送广播消息。

## WebSocket消息格式

客户端和服务器之间的消息采用JSON格式，包含以下基本结构：

```json
{
  "type": "消息类型",
  "content": "消息内容",
  "timestamp": 1625647897000
}
```

### 支持的消息类型

- `chat`: 聊天消息
- `ping`/`pong`: 心跳检测
- `system`: 系统消息
- `register`: 客户端注册信息

## 目录结构

```
├── src/
│   ├── config/        # 配置文件
│   ├── controllers/   # 控制器 (待实现)
│   ├── models/        # 数据模型 (待实现)
│   ├── services/      # 服务层
│   │   └── websocketService.js  # WebSocket服务实现
│   ├── utils/         # 工具函数
│   │   └── wsClient.js  # 测试客户端
│   └── index.js       # 主入口文件
├── .env               # 环境配置
├── package.json
└── README.md
```

## 后续开发计划

- 消息处理模块：实现消息的分析与分类
- 数据存储模块：保存消息历史和配置信息
- 业务逻辑模块：实现客服自动化的核心功能
- 用户界面模块：提供可视化操作界面 