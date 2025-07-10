/**
 * 消息解析器
 * 负责对原始消息进行解析、清理和分词
 */
const nodejieba = require('nodejieba');
const fs = require('fs');
const path = require('path');

class MessageParser {
  constructor() {
    // 加载停用词
    try {
      const stopwordsPath = path.join(__dirname, 'data', 'stopwords.json');
      const stopwordsData = fs.readFileSync(stopwordsPath, 'utf8');
      this.stopwords = JSON.parse(stopwordsData).stopwords || [];
      console.log(`停用词加载成功，共${this.stopwords.length}个`);
    } catch (error) {
      console.error('加载停用词失败:', error);
      this.stopwords = [];
    }
  }

  /**
   * 解析消息对象
   * @param {Object} message 原始消息对象
   * @returns {Object} 解析后的消息对象
   */
  parse(message) {
    if (!message) {
      throw new Error('消息对象不能为空');
    }

    // 创建解析结果对象
    const result = {
      originalMessage: message,
      type: message.type || 'unknown',
      timestamp: message.timestamp || Date.now(),
      clientId: message.clientId || '',
      content: '',
      cleanContent: '',
      tokens: [],
      keywords: [],
      metadata: {}
    };

    // 提取消息内容
    if (message.type === 'chat') {
      result.content = message.content || '';
    } else {
      // 尝试从其他字段提取文本内容
      result.content = message.content || message.message || message.text || '';
    }

    // 文本清理和规范化
    result.cleanContent = this.cleanText(result.content);
    
    // 分词处理
    result.tokens = this.tokenize(result.cleanContent);
    
    // 提取关键词
    result.keywords = this.extractKeywords(result.cleanContent);

    return result;
  }

  /**
   * 清理文本内容
   * @param {string} text 原始文本
   * @returns {string} 清理后的文本
   */
  cleanText(text) {
    if (!text) return '';
    
    // 转换为字符串
    let cleanText = String(text);
    
    // 去除HTML标签
    cleanText = cleanText.replace(/<[^>]*>/g, ' ');
    
    // 去除多余空白字符
    cleanText = cleanText.replace(/\s+/g, ' ').trim();
    
    // 去除特殊字符但保留中文标点
    cleanText = cleanText.replace(/[^\u4e00-\u9fa5\u3000-\u303f\uff00-\uff60a-zA-Z0-9，。？！：；""''（）【】《》、]+/g, ' ');
    
    return cleanText;
  }

  /**
   * 对文本进行分词
   * @param {string} text 文本内容
   * @returns {Array} 分词结果
   */
  tokenize(text) {
    if (!text) return [];
    
    // 使用结巴分词
    const tokens = nodejieba.cut(text);
    
    // 过滤停用词
    return tokens.filter(token => {
      // 过滤空字符和停用词
      return token.trim() && !this.stopwords.includes(token);
    });
  }

  /**
   * 提取关键词
   * @param {string} text 文本内容
   * @param {number} topN 提取前N个关键词
   * @returns {Array} 关键词数组
   */
  extractKeywords(text, topN = 5) {
    if (!text) return [];
    
    try {
      // 使用结巴分词的关键词提取功能
      const keywords = nodejieba.extract(text, topN);
      return keywords.map(item => item.word);
    } catch (error) {
      console.error('提取关键词失败:', error);
      return [];
    }
  }
  
  /**
   * 解析特定类型的消息
   * @param {string} type 消息类型
   * @param {Object} data 消息数据
   * @returns {Object} 解析结果
   */
  parseByType(type, data) {
    switch (type) {
      case 'chat':
        return this.parseChatMessage(data);
      case 'system':
        return this.parseSystemMessage(data);
      default:
        return this.parse(data);
    }
  }
  
  /**
   * 解析聊天消息
   * @param {Object} message 聊天消息
   * @returns {Object} 解析结果
   */
  parseChatMessage(message) {
    const result = this.parse(message);
    result.metadata.messageType = 'chat';
    return result;
  }
  
  /**
   * 解析系统消息
   * @param {Object} message 系统消息
   * @returns {Object} 解析结果
   */
  parseSystemMessage(message) {
    const result = this.parse(message);
    result.metadata.messageType = 'system';
    result.metadata.action = message.action || '';
    return result;
  }
}

module.exports = MessageParser; 