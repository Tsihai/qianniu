# 消息处理模块

## 1. 模块概述

消息处理模块是千牛客服自动化系统的核心组件之一，负责对通信模块接收到的消息进行解析、分类和意图识别，并提供合适的回复建议。该模块采用自然语言处理技术，能够理解买家的咨询内容，识别其意图，并生成相应的回复建议。

## 2. 功能特点

- **消息解析**：将原始消息转换为结构化数据，包括清理、规范化和分词处理
- **关键词提取**：识别消息中的重要词语，用于后续的意图识别和分类
- **意图识别**：基于模式匹配和分类器两种方法识别消息意图
- **回复推荐**：根据识别出的意图生成适合的回复建议
- **会话管理**：维护客户会话状态和历史记录，支持上下文相关的消息处理

## 3. 模块结构

消息处理模块由以下几个主要组件构成：

```
src/services/messageProcessor/
├── index.js              # 主模块，整合各个子模块功能
├── MessageParser.js      # 消息解析器，负责消息的解析和分词
├── IntentClassifier.js   # 意图分类器，识别消息的意图
├── ReplyRecommender.js   # 回复推荐器，生成回复建议
└── data/                 # 数据文件目录
    ├── stopwords.json    # 停用词列表
    ├── intents.json      # 意图定义和模式
    └── replies.json      # 回复模板集合
```

## 4. 使用方法

### 4.1 基本使用

```javascript
// 导入消息处理器
const MessageProcessor = require('./services/messageProcessor');

// 创建实例
const processor = new MessageProcessor({
  enableLogging: true
});

// 处理消息
const message = {
  type: 'chat',
  clientId: 'client-001',
  content: '这个商品多少钱？',
  timestamp: Date.now()
};

const result = processor.processMessage(message);

// 获取最佳回复
console.log(result.bestReply.text);
```

### 4.2 与WebSocket服务集成

```javascript
// 在WebSocketService中使用
const MessageProcessor = require('./messageProcessor');
const processor = new MessageProcessor();

// 在handleMessage方法中处理消息
handleMessage(data, clientId) {
  // 解析消息...
  const message = this.parseMessage(data);
  
  // 处理消息
  const processedResult = processor.processMessage(message);
  
  // 可以根据处理结果执行自动回复
  if (processedResult.bestReply) {
    this.sendTo(clientId, {
      type: 'chat',
      content: processedResult.bestReply.text,
      timestamp: Date.now()
    });
  }
}
```

## 5. 数据定义

### 5.1 消息格式

**输入消息格式**：
```json
{
  "type": "chat",
  "clientId": "client-001",
  "content": "这个商品多少钱？",
  "timestamp": 1625097600000
}
```

**输出结果格式**：
```json
{
  "originalMessage": { /* 原始消息对象 */ },
  "parsedMessage": {
    "type": "chat",
    "content": "这个商品多少钱？",
    "cleanContent": "这个商品多少钱？",
    "tokens": ["这个", "商品", "多少钱", "？"],
    "keywords": ["商品", "多少钱"]
  },
  "intents": [
    {
      "intent": "询问价格",
      "confidence": 0.85,
      "method": "pattern"
    }
  ],
  "bestIntent": {
    "intent": "询问价格",
    "confidence": 0.85,
    "method": "pattern"
  },
  "replies": [
    {
      "text": "这款产品的价格是[price]元，现在购买还有优惠活动哦！",
      "confidence": 0.85,
      "intent": "询问价格"
    }
  ],
  "bestReply": {
    "text": "这款产品的价格是[price]元，现在购买还有优惠活动哦！",
    "confidence": 0.85,
    "intent": "询问价格"
  },
  "context": { /* 会话上下文对象 */ },
  "timestamp": 1625097600100
}
```

### 5.2 意图定义

意图通过`data/intents.json`文件定义，格式如下：

```json
{
  "intents": [
    {
      "name": "询问价格",
      "patterns": [
        "多少钱", "价格", "价位", "售价", "报价"
      ],
      "confidence": 0.8
    },
    // 其他意图定义...
  ]
}
```

### 5.3 回复模板

回复模板通过`data/replies.json`文件定义，格式如下：

```json
{
  "replies": [
    {
      "intent": "询问价格",
      "templates": [
        "这款产品的价格是{price}元，现在购买还有优惠活动哦！",
        "目前该商品的售价是{price}元，正在进行限时优惠。"
      ],
      "variables": ["price"]
    },
    // 其他回复模板...
  ]
}
```

## 6. 后续优化方向

1. **解决分类器问题**：修复当前TF-IDF和分类器的初始化问题
2. **增强意图识别**：提高意图识别的准确率和召回率
3. **上下文处理**：实现基于上下文的意图和回复推荐
4. **中文分词优化**：提升中文分词的准确性
5. **多轮对话**：支持复杂的多轮对话场景
6. **性能优化**：提高大量消息处理时的性能
7. **机器学习优化**：引入更先进的NLP模型

## 7. 使用示例

### 7.1 简单测试

```javascript
// 运行测试脚本
node src/tests/messageProcessor.test.js
```

### 7.2 通过API测试

启动服务后，可以通过HTTP API测试消息处理：

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

响应：
```json
{
  "originalMessage": { /* 原始消息对象 */ },
  "parsedMessage": { /* 解析后的消息 */ },
  "intents": [ /* 识别的意图列表 */ ],
  "bestIntent": { /* 最佳意图 */ },
  "replies": [ /* 推荐回复列表 */ ],
  "bestReply": { /* 最佳回复 */ }
}
``` 