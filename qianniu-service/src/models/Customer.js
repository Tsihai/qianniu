/**
 * 客户模型
 * 存储客户相关信息和行为数据
 */
import mongoose from 'mongoose';
const Schema = mongoose.Schema;

// 定义客户模式
const CustomerSchema = new Schema({
  // 客户ID（通常是WebSocket连接ID）
  clientId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // 基本信息
  nickname: {
    type: String,
    default: ''
  },
  
  avatar: {
    type: String,
    default: ''
  },
  
  // 联系信息
  contact: {
    phone: String,
    email: String,
    wechat: String,
    address: String
  },
  
  // 标签
  tags: [{
    type: String
  }],
  
  // 购买意向
  purchaseIntention: {
    type: Number,
    default: 0, // 0-100表示购买意向强度
    min: 0,
    max: 100
  },
  
  // 互动历史统计
  stats: {
    messageCount: {
      type: Number,
      default: 0
    },
    responseTime: {
      type: Number, // 平均响应时间（毫秒）
      default: 0
    },
    lastActiveTime: {
      type: Date,
      default: Date.now
    },
    visitCount: {
      type: Number,
      default: 1
    },
    firstVisitTime: {
      type: Date,
      default: Date.now
    }
  },
  
  // 首选意图（最常询问的意图）
  preferredIntents: [{
    intent: String,
    count: Number
  }],
  
  // 备注
  notes: [{
    content: String,
    createdAt: {
      type: Date,
      default: Date.now
    },
    createdBy: String
  }],
  
  // 元数据
  metadata: {
    type: Map,
    of: Schema.Types.Mixed
  },
  
  // 系统字段
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true // 自动添加和维护createdAt和updatedAt字段
});

// 添加索引
CustomerSchema.index({ 'stats.lastActiveTime': -1 });
CustomerSchema.index({ 'tags': 1 });
CustomerSchema.index({ 'purchaseIntention': -1 });

// 添加实例方法
CustomerSchema.methods.updateStats = function(messageCount = 1) {
  this.stats.messageCount += messageCount;
  this.stats.lastActiveTime = Date.now();
  return this.save();
};

CustomerSchema.methods.addTag = function(tag) {
  if (!this.tags.includes(tag)) {
    this.tags.push(tag);
    return this.save();
  }
  return Promise.resolve(this);
};

CustomerSchema.methods.updateIntentStats = function(intent) {
  const intentRecord = this.preferredIntents.find(item => item.intent === intent);
  if (intentRecord) {
    intentRecord.count += 1;
  } else {
    this.preferredIntents.push({ intent, count: 1 });
  }
  return this.save();
};

// 添加静态方法
CustomerSchema.statics.findByClientId = function(clientId) {
  return this.findOne({ clientId });
};

CustomerSchema.statics.findMostActive = function(limit = 10) {
  return this.find({ isActive: true })
    .sort({ 'stats.messageCount': -1 })
    .limit(limit);
};

CustomerSchema.statics.findByTag = function(tag) {
  return this.find({ tags: tag });
};

// 创建并导出模型
const Customer = mongoose.model('Customer', CustomerSchema);

export default Customer;