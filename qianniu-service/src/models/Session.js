/**
 * 会话模型
 * 存储会话相关信息和消息历史
 */
import mongoose from 'mongoose';
const Schema = mongoose.Schema;

// 消息子模式
const MessageSchema = new Schema({
  content: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['chat', 'system', 'image', 'file', 'unknown'],
    default: 'chat'
  },
  sender: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  processed: {
    isProcessed: {
      type: Boolean,
      default: false
    },
    intents: [{
      intent: String,
      confidence: Number
    }],
    keywords: [String],
    sentiment: {
      type: String,
      enum: ['positive', 'neutral', 'negative', 'unknown'],
      default: 'unknown'
    }
  },
  metadata: {
    type: Map,
    of: Schema.Types.Mixed
  }
}, {
  _id: true,
  timestamps: true
});

// 定义会话模式
const SessionSchema = new Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  clientId: {
    type: String,
    required: true,
    index: true,
    ref: 'Customer'
  },
  
  status: {
    type: String,
    enum: ['active', 'idle', 'closed'],
    default: 'active'
  },
  
  // 会话信息
  messages: [MessageSchema],
  
  // 会话统计
  stats: {
    messageCount: {
      type: Number,
      default: 0
    },
    clientMessageCount: {
      type: Number,
      default: 0
    },
    serverMessageCount: {
      type: Number,
      default: 0
    },
    startTime: {
      type: Date,
      default: Date.now
    },
    lastActivityTime: {
      type: Date,
      default: Date.now
    },
    avgResponseTime: {
      type: Number,
      default: 0
    }
  },
  
  // 会话上下文
  context: {
    lastIntent: String,
    lastKeywords: [String],
    lastMessageTime: Date,
    customData: {
      type: Map,
      of: Schema.Types.Mixed
    }
  },
  
  // 自动回复配置
  autoReply: {
    enabled: {
      type: Boolean,
      default: false
    },
    mode: {
      type: String,
      enum: ['auto', 'suggest', 'hybrid'],
      default: 'suggest'
    },
    confidenceThreshold: {
      type: Number,
      default: 0.7,
      min: 0,
      max: 1
    }
  },
  
  // 会话标签
  tags: [String],
  
  // 系统字段
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// 索引
SessionSchema.index({ 'stats.lastActivityTime': -1 });
SessionSchema.index({ status: 1 });
SessionSchema.index({ tags: 1 });

// 实例方法
SessionSchema.methods.addMessage = function(message) {
  const msgObj = {
    content: message.content,
    type: message.type || 'chat',
    sender: message.sender,
    timestamp: message.timestamp || Date.now(),
    metadata: message.metadata || {}
  };

  this.messages.push(msgObj);
  
  // 更新统计信息
  this.stats.messageCount += 1;
  if (message.sender === 'client' || message.sender === this.clientId) {
    this.stats.clientMessageCount += 1;
  } else {
    this.stats.serverMessageCount += 1;
  }
  
  this.stats.lastActivityTime = Date.now();
  
  return this.save();
};

SessionSchema.methods.updateContext = function(contextData) {
  this.context = {
    ...this.context,
    ...contextData,
    lastMessageTime: Date.now()
  };
  
  return this.save();
};

SessionSchema.methods.close = function() {
  this.status = 'closed';
  return this.save();
};

// 静态方法
SessionSchema.statics.findByClientId = function(clientId) {
  return this.find({ clientId }).sort({ 'stats.lastActivityTime': -1 });
};

SessionSchema.statics.findActive = function(hours = 24) {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - hours);
  
  return this.find({
    status: { $ne: 'closed' },
    'stats.lastActivityTime': { $gte: cutoff }
  }).sort({ 'stats.lastActivityTime': -1 });
};

SessionSchema.statics.findByTag = function(tag) {
  return this.find({ tags: tag });
};

SessionSchema.statics.getMessageStats = async function(startDate, endDate) {
  const match = {};
  
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) match.createdAt.$lte = new Date(endDate);
  }
  
  return this.aggregate([
    { $match: match },
    { $group: {
      _id: null,
      totalSessions: { $sum: 1 },
      totalMessages: { $sum: '$stats.messageCount' },
      clientMessages: { $sum: '$stats.clientMessageCount' },
      serverMessages: { $sum: '$stats.serverMessageCount' },
      avgSessionMessages: { $avg: '$stats.messageCount' }
    }}
  ]);
};

// 创建并导出模型
const Session = mongoose.model('Session', SessionSchema);

export default Session;