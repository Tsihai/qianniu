/**
 * 回复推荐器
 * 负责根据消息意图生成回复建议
 */
const fs = require('fs');
const path = require('path');

class ReplyRecommender {
  constructor() {
    // 默认回复模板
    this.defaultReplies = [
      {
        "intent": "default",
        "templates": [
          "感谢您的咨询，请问您具体是想了解什么呢？",
          "抱歉，我可能没有理解您的意思，能否更详细地描述一下您的问题？",
          "您好，请问您是想咨询哪方面的问题呢？",
          "很抱歉没能理解您的需求，请提供更多信息，我们会尽力帮助您解决问题。"
        ]
      }
    ];
    
    // 加载回复模板数据
    this.loadReplyTemplates();
  }

  /**
   * 加载回复模板数据
   */
  loadReplyTemplates() {
    try {
      const repliesPath = path.join(__dirname, 'data', 'replies.json');
      const repliesData = fs.readFileSync(repliesPath, 'utf8');
      this.replies = JSON.parse(repliesData).replies || [];
      console.log(`回复模板加载成功，共${this.replies.length}组模板`);
    } catch (error) {
      console.error('加载回复模板失败:', error);
      // 使用默认回复模板
      this.replies = this.defaultReplies;
      console.log('使用默认回复模板');
    }
  }

  /**
   * 根据意图获取回复模板组
   * @param {string} intent 意图名称
   * @returns {Object|null} 回复模板组
   */
  getTemplatesByIntent(intent) {
    return this.replies.find(reply => reply.intent === intent) || null;
  }

  /**
   * 获取默认回复模板
   * @returns {Object|null} 默认回复模板组
   */
  getDefaultTemplates() {
    const defaultTemplate = this.replies.find(reply => reply.intent === 'default');
    if (defaultTemplate) {
      return defaultTemplate;
    }
    
    // 如果没有找到默认模板，返回硬编码的默认回复
    return {
      intent: 'default',
      templates: [
        "抱歉，我无法理解您的问题。",
        "很抱歉，我没能理解您的意思，能否更详细地描述一下？",
        "请提供更多信息，我会尽力帮助您解决问题。"
      ]
    };
  }

  /**
   * 随机选择一个模板
   * @param {Array} templates 模板数组
   * @returns {string} 选中的模板
   */
  selectRandomTemplate(templates) {
    if (!templates || templates.length === 0) {
      return '抱歉，我无法回答这个问题。';
    }
    
    const randomIndex = Math.floor(Math.random() * templates.length);
    return templates[randomIndex];
  }

  /**
   * 生成回复建议
   * @param {Object} parsedMessage 解析后的消息
   * @param {Object} intentResult 意图识别结果
   * @param {Object} context 上下文信息
   * @returns {Object} 回复建议
   */
  generateReply(parsedMessage, intentResult, context = {}) {
    // 如果没有有效的意图识别结果，使用默认回复
    if (!intentResult || !intentResult.intent) {
      const defaultTemplates = this.getDefaultTemplates();
      return {
        text: this.selectRandomTemplate(defaultTemplates.templates),
        confidence: 0,
        intent: 'unknown'
      };
    }
    
    // 根据意图获取回复模板组
    const templateGroup = this.getTemplatesByIntent(intentResult.intent);
    
    // 如果没有找到对应的模板组，使用默认回复
    if (!templateGroup) {
      return {
        text: '抱歉，我无法回答这个问题。',
        confidence: 0.3,
        intent: intentResult.intent
      };
    }
    
    // 随机选择一个模板
    let template = this.selectRandomTemplate(templateGroup.templates);
    
    // 替换模板中的变量
    if (templateGroup.variables && templateGroup.variables.length > 0) {
      template = this.fillTemplateVariables(template, templateGroup.variables, context);
    }
    
    return {
      text: template,
      confidence: intentResult.confidence,
      intent: intentResult.intent,
      isTemplate: true
    };
  }
  
  /**
   * 填充模板变量
   * @param {string} template 模板字符串
   * @param {Array} variables 变量列表
   * @param {Object} context 上下文数据
   * @returns {string} 填充后的文本
   */
  fillTemplateVariables(template, variables, context) {
    let result = template;
    
    variables.forEach(variable => {
      const placeholder = `{${variable}}`;
      const value = context[variable] || `[${variable}]`;
      
      // 替换所有出现的变量
      result = result.split(placeholder).join(value);
    });
    
    return result;
  }

  /**
   * 生成多个回复建议
   * @param {Object} parsedMessage 解析后的消息
   * @param {Array} intents 意图数组
   * @param {Object} context 上下文信息
   * @param {number} maxCount 最大建议数量
   * @returns {Array} 回复建议数组
   */
  generateMultipleReplies(parsedMessage, intents, context = {}, maxCount = 3) {
    // 如果没有有效的意图，返回默认回复
    if (!intents || intents.length === 0) {
      const defaultReply = this.generateReply(parsedMessage, null, context);
      return [defaultReply];
    }
    
    // 为每个意图生成回复建议
    const replies = [];
    
    for (let i = 0; i < Math.min(intents.length, maxCount); i++) {
      const intent = intents[i];
      const reply = this.generateReply(parsedMessage, intent, context);
      
      // 只添加非空回复
      if (reply && reply.text) {
        replies.push(reply);
      }
      
      // 如果已达到最大数量，停止生成
      if (replies.length >= maxCount) {
        break;
      }
    }
    
    // 如果没有生成任何回复，返回默认回复
    if (replies.length === 0) {
      const defaultReply = this.generateReply(parsedMessage, null, context);
      return [defaultReply];
    }
    
    return replies;
  }
}

module.exports = ReplyRecommender; 