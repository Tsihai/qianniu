# 千牛客服自动化系统消息协议规范

本文档定义了千牛客服自动化系统中使用的WebSocket消息协议格式，作为通信模块与消息处理模块之间的接口规范。

## 1. 消息基本结构

所有消息均采用JSON格式，包含以下基本结构：

```json
{
  "type": "消息类型",
  "timestamp": 1625097600000,
  "...其他字段": "根据消息类型不同而变化"
}
```

### 1.1 基本字段说明

| 字段名 | 类型 | 必填 | 说明 |
|-------|------|-----|------|
| type | string | 是 | 消息类型标识符 |
| timestamp | number | 是 | 消息产生的时间戳(毫秒) |

## 2. 系统消息类型

### 2.1 连接控制消息

#### 2.1.1 欢迎消息 (系统→客户端)

```json
{
  "type": "system",
  "action": "welcome",
  "message": "连接成功",
  "clientId": "client_127_0_0_1_1625097600000_123",
  "timestamp": 1625097600000
}
```

#### 2.1.2 客户端注册 (客户端→系统)

```json
{
  "type": "register",
  "data": {
    "name": "客户端名称",
    "version": "1.0.0"
  },
  "timestamp": 1625097600000
}
```

#### 2.1.3 注册确认 (系统→客户端)

```json
{
  "type": "system",
  "action": "registered",
  "success": true,
  "timestamp": 1625097600000
}
```

### 2.2 心跳消息

#### 2.2.1 Ping消息 (客户端→系统)

```json
{
  "type": "ping",
  "timestamp": 1625097600000
}
```

#### 2.2.2 Pong响应 (系统→客户端)

```json
{
  "type": "pong",
  "timestamp": 1625097600000
}
```

### 2.3 错误消息 (系统→客户端)

```json
{
  "type": "error",
  "message": "错误描述",
  "error": "详细错误信息",
  "timestamp": 1625097600000
}
```

## 3. 业务消息类型

### 3.1 聊天消息

#### 3.1.1 发送聊天消息 (客户端→系统)

```json
{
  "type": "chat",
  "content": "消息内容",
  "timestamp": 1625097600000
}
```

#### 3.1.2 聊天响应 (系统→客户端)

```json
{
  "type": "chat",
  "message": "响应内容",
  "timestamp": 1625097600000
}
```

### 3.2 广播消息 (系统→所有客户端)

```json
{
  "type": "broadcast",
  "message": "广播内容",
  "timestamp": 1625097600000
}
```

## 4. 消息处理流程

1. 通信模块接收原始WebSocket消息
2. 解析JSON格式数据
3. 根据`type`字段路由到相应处理器
4. 系统消息由通信模块直接处理
5. 业务消息转发给消息处理模块
6. 消息处理模块处理后返回结果
7. 通信模块将结果发送回客户端

## 5. 消息处理模块接口

消息处理模块需要实现以下接口，用于接收通信模块转发的消息：

```javascript
/**
 * 处理收到的业务消息
 * @param {string} clientId - 发送消息的客户端ID
 * @param {Object} message - 解析后的消息对象
 * @return {Object|null} - 需要响应的消息，null表示不需要响应
 */
function processMessage(clientId, message) {
  // 消息处理逻辑
  return responseMessage; // 或 null
}
```

## 6. 消息扩展规范

当需要扩展新的消息类型时，应遵循以下规范：

1. 定义唯一的`type`值
2. 明确所有必要字段及其数据类型
3. 在本文档中添加相应的格式说明
4. 实现相应的处理逻辑

## 7. 版本控制

当消息协议发生变化时，应通过版本号进行管理：

```json
{
  "type": "register",
  "data": {
    "name": "客户端名称",
    "version": "1.0.0",
    "protocolVersion": "1.0"
  },
  "timestamp": 1625097600000
}
``` 