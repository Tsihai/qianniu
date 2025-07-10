/**
 * 自动回复策略处理器
 * 负责根据消息意图和内容生成适当的自动回复
 */
const fs = require('fs');
const path = require('path');

class AutoReplyStrategy {
  constructor(options = {}) {
    // 配置选项
    this.options = {
      confidenceThreshold: options?.confidenceThreshold || 0.6,
      maxRepliesPerIntent: options?.maxRepliesPerIntent || 3,
      enableCustomRules: options?.enableCustomRules || true,
      customRulesPath: options?.customRulesPath || path.join(__dirname, '../data/autoReplyRules.json'),
      ...options
    };
    
    // 自定义规则集
    this.rules = this.loadRules();
    
    // 回复模式：'auto' - 完全自动, 'suggest' - 仅建议, 'hybrid' - 混合模式
    this.replyMode = options?.replyMode || 'suggest';
    
    console.log('自动回复策略处理器初始化完成');
  }
  
  /**
   * 加载自定义回复规则
   * @returns {Array} 规则列表
   */
  loadRules() {
    try {
      if (fs.existsSync(this.options.customRulesPath)) {
        const rulesData = fs.readFileSync(this.options.customRulesPath, 'utf8');
        return JSON.parse(rulesData);
      }
    } catch (error) {
      console.error('加载自动回复规则失败:', error);
    }
    
    // 返回默认规则
    return [
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
  }
  
  /**
   * 保存自定义回复规则
   * @param {Array} rules 规则列表
   */
  saveRules(rules) {
    try {
      const dir = path.dirname(this.options.customRulesPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(
        this.options.customRulesPath, 
        JSON.stringify(rules, null, 2), 
        'utf8'
      );
      
      this.rules = rules;
      return true;
    } catch (error) {
      console.error('保存自动回复规则失败:', error);
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
    if (!processedResult || !processedResult.parsedMessage) {
      return { success: false, reason: '无效的消息处理结果' };
    }
    
    const content = processedResult.parsedMessage.cleanContent;
    const intents = processedResult.intents || [];
    
    // 如果没有识别出意图，或置信度低于阈值，则使用默认回复
    if (intents.length === 0 || intents[0].confidence < this.options.confidenceThreshold) {
      return this.generateDefaultReply(content, sessionContext);
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
      return this.generateDefaultReply(content, sessionContext);
    }
    
    // 根据回复模式处理
    const bestReply = replies[0];
    
    return {
      success: true,
      mode: this.replyMode,
      message: bestReply.message,
      confidence: bestReply.confidence,
      intent: bestReply.intent,
      alternatives: replies.slice(1),
      shouldAutoSend: this.replyMode === 'auto',
      timestamp: Date.now()
    };
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
        console.error(`规则正则表达式错误 [${rule.pattern}]:`, error);
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
  addRule(intent, pattern, reply) {
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
      }
      
      // 添加新规则
      intentRules.rules.push({ pattern, reply });
      
      // 保存规则
      return this.saveRules(this.rules);
    } catch (error) {
      console.error('添加规则失败:', error);
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

module.exports = AutoReplyStrategy; 