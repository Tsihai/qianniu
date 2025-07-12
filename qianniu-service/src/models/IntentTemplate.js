/**
 * 意图模板模型
 * 存储意图识别和回复模板数据
 */
import mongoose from 'mongoose';
const Schema = mongoose.Schema;

// 定义意图模板模式
const IntentTemplateSchema = new Schema({
  // 意图名称
  name: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // 意图类型
  type: {
    type: String,
    enum: ['question', 'request', 'greeting', 'farewell', 'complaint', 'praise', 'custom'],
    default: 'custom'
  },
  
  // 意图描述
  description: {
    type: String,
    default: ''
  },
  
  // 匹配模式
  patterns: [{
    text: {
      type: String,
      required: true
    },
    enabled: {
      type: Boolean,
      default: true
    }
  }],
  
  // 意图识别置信度阈值
  confidenceThreshold: {
    type: Number,
    default: 0.6,
    min: 0,
    max: 1
  },
  
  // 关键词
  keywords: [{
    word: {
      type: String,
      required: true
    },
    weight: {
      type: Number,
      default: 1
    }
  }],
  
  // 回复模板
  templates: [{
    text: {
      type: String,
      required: true
    },
    variables: [String],
    conditions: {
      type: Map,
      of: Schema.Types.Mixed
    },
    weight: {
      type: Number,
      default: 1
    },
    enabled: {
      type: Boolean,
      default: true
    }
  }],
  
  // 识别配置
  config: {
    useML: {
      type: Boolean,
      default: true
    },
    usePatterns: {
      type: Boolean,
      default: true
    },
    useKeywords: {
      type: Boolean,
      default: true
    },
    priority: {
      type: Number,
      default: 0
    }
  },
  
  // 使用统计
  stats: {
    matchCount: {
      type: Number,
      default: 0
    },
    usageCount: {
      type: Number,
      default: 0
    },
    successRate: {
      type: Number,
      default: 0
    },
    lastUsed: {
      type: Date
    }
  },
  
  // 系统字段
  isSystem: {
    type: Boolean,
    default: false
  },
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
  timestamps: true
});

// 添加索引
IntentTemplateSchema.index({ type: 1 });
IntentTemplateSchema.index({ isActive: 1 });
IntentTemplateSchema.index({ 'config.priority': -1 });

// 添加实例方法
IntentTemplateSchema.methods.incrementMatchCount = function() {
  this.stats.matchCount += 1;
  this.stats.lastUsed = Date.now();
  return this.save();
};

IntentTemplateSchema.methods.incrementUsageCount = function() {
  this.stats.usageCount += 1;
  
  // 更新成功率
  if (this.stats.matchCount > 0) {
    this.stats.successRate = this.stats.usageCount / this.stats.matchCount;
  }
  
  return this.save();
};

IntentTemplateSchema.methods.addPattern = function(pattern) {
  if (!this.patterns.find(p => p.text === pattern)) {
    this.patterns.push({ text: pattern });
    return this.save();
  }
  return Promise.resolve(this);
};

IntentTemplateSchema.methods.addKeyword = function(keyword, weight = 1) {
  if (!this.keywords.find(k => k.word === keyword)) {
    this.keywords.push({ word: keyword, weight });
    return this.save();
  }
  return Promise.resolve(this);
};

IntentTemplateSchema.methods.addTemplate = function(template, variables = []) {
  this.templates.push({
    text: template,
    variables,
    weight: 1,
    enabled: true
  });
  return this.save();
};

// 静态方法
IntentTemplateSchema.statics.findActive = function() {
  return this.find({ isActive: true });
};

IntentTemplateSchema.statics.findByType = function(type) {
  return this.find({ type, isActive: true });
};

IntentTemplateSchema.statics.updateFromFile = async function(data) {
  if (!data || !data.intents || !Array.isArray(data.intents)) {
    throw new Error('无效的意图数据格式');
  }
  
  const results = {
    created: 0,
    updated: 0,
    failed: 0
  };
  
  for (const intent of data.intents) {
    try {
      if (!intent.name) continue;
      
      const existingIntent = await this.findOne({ name: intent.name });
      
      if (existingIntent) {
        // 更新现有意图
        existingIntent.patterns = intent.patterns.map(p => ({ text: p, enabled: true }));
        existingIntent.keywords = intent.keywords?.map(k => ({ word: k, weight: 1 })) || [];
        existingIntent.description = intent.description || existingIntent.description;
        existingIntent.type = intent.type || existingIntent.type;
        
        if (intent.templates && Array.isArray(intent.templates)) {
          existingIntent.templates = intent.templates.map(t => ({
            text: t,
            variables: [],
            weight: 1,
            enabled: true
          }));
        }
        
        await existingIntent.save();
        results.updated++;
      } else {
        // 创建新意图
        await this.create({
          name: intent.name,
          description: intent.description || '',
          type: intent.type || 'custom',
          patterns: intent.patterns.map(p => ({ text: p, enabled: true })),
          keywords: intent.keywords?.map(k => ({ word: k, weight: 1 })) || [],
          templates: (intent.templates || []).map(t => ({
            text: t,
            variables: [],
            weight: 1,
            enabled: true
          }))
        });
        results.created++;
      }
    } catch (error) {
      console.error(`更新意图失败 [${intent.name}]:`, error);
      results.failed++;
    }
  }
  
  return results;
};

// 创建并导出模型
const IntentTemplate = mongoose.model('IntentTemplate', IntentTemplateSchema);

export default IntentTemplate;