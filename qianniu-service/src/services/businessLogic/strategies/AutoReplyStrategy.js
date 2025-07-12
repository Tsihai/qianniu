/**
 * 自动回复策略处理器
 * 负责根据消息意图和内容生成适当的自动回复
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class AutoReplyStrategy {
  constructor(options = {}) {
    // 集成统一工具类
    this.logger = options.logger || console;
    this.errorHandler = options.errorHandler;
    this.performanceMonitor = options.performanceMonitor;
    this.sessionManager = options.sessionManager;
    
    // 数据服务依赖注入
    this.dataService = options.dataService;
    if (!this.dataService) {
      throw new Error('AutoReplyStrategy requires dataService dependency');
    }
    
    // 配置选项
    this.options = {
      confidenceThreshold: options?.confidenceThreshold || 0.6,
      maxRepliesPerIntent: options?.maxRepliesPerIntent || 3,
      enableCustomRules: options?.enableCustomRules || true,
      customRulesPath: options?.customRulesPath || path.join(__dirname, '../data/autoReplyRules.json'),
      ...options
    };
    
    // 自定义规则集 - 初始化为空数组，需要显式调用loadRules()进行异步加载
    this.rules = [];
    
    // 回复模式：'auto' - 完全自动, 'suggest' - 仅建议, 'hybrid' - 混合模式
    this.replyMode = options?.replyMode || 'suggest';
    
    this.logger.info('自动回复策略处理器初始化完成', {
      confidenceThreshold: this.options.confidenceThreshold,
      maxRepliesPerIntent: this.options.maxRepliesPerIntent,
      replyMode: this.replyMode,
      rulesCount: this.rules.length,
      note: '规则需要通过loadRules()方法异步加载'
    });
  }
  
  /**
   * 加载自定义回复规则
   * @returns {Array} 规则列表
   */
  async loadRules() {
    const timer = this.performanceMonitor?.startTimer('auto_reply_load_rules');
    
    try {
      // 从数据服务获取自动回复规则（使用IntentTemplate存储）
      const autoReplyTemplates = await this.dataService.getAllIntentTemplates();
      
      // 过滤出自动回复类型的模板
      const autoReplyRules = autoReplyTemplates
        .filter(template => template.category === 'auto_reply')
        .map(template => ({
          intent: template.name,
          rules: template.patterns?.map(pattern => ({
            pattern: pattern,
            reply: template.responses?.[0] || '感谢您的咨询，我们会尽快回复您。'
          })) || [],
          defaultReply: template.defaultReply || template.responses?.[0] || '感谢您的咨询，我们会尽快回复您。'
        }));
      
      // 更新实例的规则集
      this.rules = autoReplyRules;
      
      this.logger.info('自动回复规则加载成功', {
        rulesCount: autoReplyRules.length,
        source: 'dataService'
      });
      
      timer?.end({ success: true, rulesCount: autoReplyRules.length });
      return autoReplyRules;
      
    } catch (error) {
      const errorInfo = {
        message: '加载自动回复规则失败',
        error: error.message,
        source: 'dataService'
      };
      
      if (this.errorHandler) {
        this.errorHandler.handleError(error, 'AutoReplyStrategy.loadRules', errorInfo);
      } else {
        this.logger.error('加载自动回复规则失败', errorInfo);
      }
      
      timer?.end({ success: false, error: error.message });
    }
    
    // 返回默认规则
    const defaultRules = [
      {
        intent: 'greeting',
        rules: [
          { pattern: '.*', reply: '您好！很高兴为您服务。有什么可以帮到您？' }
        ]
      },
      {
        intent: 'farewell',
        rules: [
          { pattern: '.*', reply: '感谢您的咨询，祝您购物愉快！如有其他问题随时联系我。' }
        ]
      },
      {
        intent: 'price_inquiry',
        rules: [
          { pattern: '.*多少钱.*', reply: '您好，该商品的具体价格请查看商品详情页面，如需了解更多优惠信息可以告诉我。' },
          { pattern: '.*优惠.*', reply: '目前我们有多种促销活动，具体可以参考商品详情页的活动说明。' }
        ]
      }
    ];
    
    // 更新实例的规则集
    this.rules = defaultRules;
    
    this.logger.info('使用默认回复规则', { rulesCount: defaultRules.length });
    timer?.end({ success: true, rulesCount: defaultRules.length, isDefault: true });
    
    return defaultRules;
  }
  
  /**
   * 保存自定义回复规则
   * @param {Array} rules 规则列表
   */
  async saveRules(rules) {
    const timer = this.performanceMonitor?.startTimer('auto_reply_save_rules');
    
    try {
      // 将自定义规则保存为IntentTemplate
      let savedCount = 0;
      
      for (const rule of rules) {
        const templateData = {
          name: rule.intent || `auto_reply_${Date.now()}_${savedCount}`,
          category: 'auto_reply',
          keywords: rule.keywords || [],
          patterns: rule.rules?.map(r => r.pattern) || [],
          responses: rule.rules?.map(r => r.reply) || [rule.defaultReply],
          priority: rule.priority || 0,
          isActive: rule.isActive !== false,
          description: `自动回复规则: ${rule.intent || 'custom'}`
        };
        
        // 检查是否已存在
        const existing = await this.dataService.getIntentTemplate(templateData.name);
        if (existing) {
          await this.dataService.updateIntentTemplate(templateData.name, templateData);
        } else {
          await this.dataService.createIntentTemplate(templateData);
        }
        
        savedCount++;
      }
      
      this.rules = rules;
      
      this.logger.info('自动回复规则保存成功', {
        rulesCount: savedCount,
        source: 'dataService'
      });
      
      timer?.end({ success: true, rulesCount: savedCount });
      return true;
    } catch (error) {
      const errorInfo = {
        message: '保存自动回复规则失败',
        error: error.message,
        rulesCount: rules?.length
      };
      
      if (this.errorHandler) {
        this.errorHandler.handleError(error, 'AutoReplyStrategy.saveRules', errorInfo);
      } else {
        this.logger.error('保存自动回复规则失败', errorInfo);
      }
      
      timer?.end({ success: false, error: error.message });
      return false;
    }
  }
  
  /**
   * 处理消息，生成自动回复
   * @param {Object} processedResult 消息处理结果
   * @param {Object} sessionContext 会话上下文
   * @returns {Object} 处理结果
   */
  process(processedResult, sessionContext) {
    const timer = this.performanceMonitor?.startTimer('auto_reply_process');
    
    try {
      if (!processedResult || !processedResult.parsedMessage) {
        const error = new Error('无效的消息处理结果');
        
        if (this.errorHandler) {
          this.errorHandler.handleError(error, 'AutoReplyStrategy.process', {
            processedResult: !!processedResult,
            parsedMessage: !!processedResult?.parsedMessage
          });
        } else {
          this.logger.error('处理消息失败', { reason: '无效的消息处理结果' });
        }
        
        timer?.end({ success: false, error: error.message });
        return { success: false, reason: '无效的消息处理结果' };
      }
      
      const content = processedResult.parsedMessage.cleanContent;
      const intents = processedResult.intents || [];
      
      this.logger.debug('开始处理自动回复', {
        contentLength: content?.length,
        intentsCount: intents.length,
        topIntent: intents[0]?.intent,
        topConfidence: intents[0]?.confidence
      });
      
      // 如果没有识别出意图，或置信度低于阈值，则使用默认回复
      if (intents.length === 0 || intents[0].confidence < this.options.confidenceThreshold) {
        this.logger.debug('使用默认回复', {
          reason: intents.length === 0 ? '无意图识别' : '置信度过低',
          confidence: intents[0]?.confidence,
          threshold: this.options.confidenceThreshold
        });
        
        const result = this.generateDefaultReply(content, sessionContext);
        timer?.end({ success: true, replyType: 'default' });
        return result;
      }
      
      // 尝试为每个意图生成回复
      const replies = [];
      
      for (let i = 0; i < Math.min(intents.length, this.options.maxRepliesPerIntent); i++) {
        const intent = intents[i];
        const reply = this.generateReplyByIntent(intent.intent, content, sessionContext);
        
        if (reply) {
          replies.push({
            message: reply,
            confidence: intent.confidence,
            intent: intent.intent,
            isAutomatic: true
          });
        }
      }
      
      // 如果没有生成任何回复，使用默认回复
      if (replies.length === 0) {
        this.logger.debug('未生成意图回复，使用默认回复');
        const result = this.generateDefaultReply(content, sessionContext);
        timer?.end({ success: true, replyType: 'default_fallback' });
        return result;
      }
      
      // 根据回复模式处理
      const bestReply = replies[0];
      
      this.logger.info('自动回复生成成功', {
        intent: bestReply.intent,
        confidence: bestReply.confidence,
        mode: this.replyMode,
        alternativesCount: replies.length - 1
      });
      
      const result = {
        success: true,
        mode: this.replyMode,
        message: bestReply.message,
        confidence: bestReply.confidence,
        intent: bestReply.intent,
        alternatives: replies.slice(1),
        shouldAutoSend: this.replyMode === 'auto',
        timestamp: Date.now()
      };
      
      timer?.end({ success: true, replyType: 'intent_based', intent: bestReply.intent });
      return result;
      
    } catch (error) {
      const errorInfo = {
        message: '自动回复处理异常',
        error: error.message,
        processedResult: !!processedResult,
        sessionContext: !!sessionContext
      };
      
      if (this.errorHandler) {
        this.errorHandler.handleError(error, 'AutoReplyStrategy.process', errorInfo);
      } else {
        this.logger.error('自动回复处理异常', errorInfo);
      }
      
      timer?.end({ success: false, error: error.message });
      return { success: false, reason: '处理异常', error: error.message };
    }
  }
  
  /**
   * 根据意图生成回复
   * @param {string} intent 意图
   * @param {string} content 消息内容
   * @param {Object} context 会话上下文
   * @returns {string|null} 回复内容或null
   */
  generateReplyByIntent(intent, content, context) {
    // 查找匹配的意图规则
    const intentRules = this.rules.find(r => r.intent === intent);
    
    if (!intentRules) {
      return null;
    }
    
    // 检查是否匹配任何规则模式
    for (const rule of intentRules.rules) {
      try {
        const pattern = new RegExp(rule.pattern, 'i');
        if (pattern.test(content)) {
          // 替换回复中的变量
          return this.replaceTemplateVariables(rule.reply, context);
        }
      } catch (error) {
        const errorInfo = {
          message: '规则正则表达式错误',
          pattern: rule.pattern,
          error: error.message,
          intent
        };
        
        if (this.errorHandler) {
          this.errorHandler.handleError(error, 'AutoReplyStrategy.generateReplyByIntent', errorInfo);
        } else {
          this.logger.error('规则正则表达式错误', errorInfo);
        }
      }
    }
    
    // 如果有默认回复，则使用默认回复
    if (intentRules.defaultReply) {
      return this.replaceTemplateVariables(intentRules.defaultReply, context);
    }
    
    return null;
  }
  
  /**
   * 生成默认回复
   * @param {string} content 消息内容
   * @param {Object} context 会话上下文
   * @returns {Object} 回复结果
   */
  generateDefaultReply(content, context) {
    const defaultReplies = [
      '您好，感谢您的咨询。请问还有什么可以帮到您的吗？',
      '您的问题我们已经收到，稍后会给您回复。',
      '抱歉，我可能没有完全理解您的问题，能否请您重新描述一下？'
    ];
    
    const index = Math.floor(Math.random() * defaultReplies.length);
    const reply = this.replaceTemplateVariables(defaultReplies[index], context);
    
    return {
      success: true,
      mode: this.replyMode,
      message: reply,
      confidence: 0.3,
      intent: 'default',
      shouldAutoSend: false,
      timestamp: Date.now()
    };
  }
  
  /**
   * 替换模板变量
   * @param {string} template 模板字符串
   * @param {Object} context 上下文数据
   * @returns {string} 替换后的字符串
   */
  replaceTemplateVariables(template, context) {
    if (!template || typeof template !== 'string') {
      return template;
    }
    
    // 替换常用变量，如 {customerName}, {time} 等
    const customerName = context.customerInfo?.name || '亲';
    const now = new Date();
    const hour = now.getHours();
    
    let timeGreeting = '您好';
    if (hour < 12) {
      timeGreeting = '上午好';
    } else if (hour < 18) {
      timeGreeting = '下午好';
    } else {
      timeGreeting = '晚上好';
    }
    
    // 执行替换
    return template
      .replace(/\{customerName\}/g, customerName)
      .replace(/\{timeGreeting\}/g, timeGreeting)
      .replace(/\{messageCount\}/g, context.messageCount || 0);
  }
  
  /**
   * 添加新的自定义规则
   * @param {string} intent 意图名称
   * @param {string} pattern 匹配模式(正则表达式)
   * @param {string} reply 回复内容
   * @returns {boolean} 是否添加成功
   */
  async addRule(intent, pattern, reply) {
    const timer = this.performanceMonitor?.startTimer('auto_reply_add_rule');
    
    try {
      // 验证正则表达式
      new RegExp(pattern);
      
      // 查找对应意图
      let intentRules = this.rules.find(r => r.intent === intent);
      
      if (!intentRules) {
        // 创建新意图规则
        intentRules = {
          intent,
          rules: []
        };
        this.rules.push(intentRules);
        this.logger.debug('创建新意图规则', { intent });
      }
      
      // 添加新规则
      intentRules.rules.push({ pattern, reply });
      
      this.logger.info('添加自动回复规则', {
        intent,
        pattern,
        replyLength: reply?.length
      });
      
      // 保存规则
      const success = await this.saveRules(this.rules);
      timer?.end({ success, intent, rulesCount: this.rules.length });
      return success;
    } catch (error) {
      const errorInfo = {
        message: '添加规则失败',
        intent,
        pattern,
        error: error.message
      };
      
      if (this.errorHandler) {
        this.errorHandler.handleError(error, 'AutoReplyStrategy.addRule', errorInfo);
      } else {
        this.logger.error('添加规则失败', errorInfo);
      }
      
      timer?.end({ success: false, error: error.message });
      return false;
    }
  }
  
  /**
   * 设置回复模式
   * @param {string} mode 回复模式: 'auto', 'suggest', 'hybrid'
   */
  setReplyMode(mode) {
    if (['auto', 'suggest', 'hybrid'].includes(mode)) {
      this.replyMode = mode;
      return true;
    }
    return false;
  }
}

export default AutoReplyStrategy;