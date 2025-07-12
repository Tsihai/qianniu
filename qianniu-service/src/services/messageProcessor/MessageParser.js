/**
 * 消息解析器
 * 负责对原始消息进行解析、清理和分词
 */
import nodejieba from 'nodejieba';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MessageParser {
  constructor(options = {}) {
    // 接收工具类实例
    this.logger = options.logger;
    this.errorHandler = options.errorHandler;
    this.performanceMonitor = options.performanceMonitor;
    
    // 配置选项
    this.options = {
      enablePerformanceMonitoring: options.enablePerformanceMonitoring || false,
      maxKeywords: options.maxKeywords || 5,
      ...options
    };
    
    // 加载停用词
    this.stopwords = this.loadStopWords();
    
    // 记录初始化
    if (this.logger) {
      this.logger.info('MessageParser初始化完成', {
        stopwordsCount: this.stopwords.length,
        options: this.options
      });
    }
  }

  /**
   * 加载停用词
   * @returns {Array} 停用词数组
   */
  loadStopWords() {
    const defaultStopwords = ['的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这'];
    
    try {
      const stopwordsPath = path.join(__dirname, 'data', 'stopwords.json');
      
      if (!fs.existsSync(stopwordsPath)) {
        if (this.logger) {
          this.logger.warn('停用词文件不存在，使用默认停用词', { path: stopwordsPath });
        }
        return defaultStopwords;
      }
      
      const stopwordsData = fs.readFileSync(stopwordsPath, 'utf8');
      const parsedData = JSON.parse(stopwordsData);
      const stopwords = Array.isArray(parsedData) ? parsedData : (parsedData.stopwords || defaultStopwords);
      
      if (this.logger) {
        this.logger.info('停用词加载成功', { count: stopwords.length, path: stopwordsPath });
      }
      
      return stopwords;
    } catch (error) {
      if (this.errorHandler) {
        const handledError = this.errorHandler.handleError(error, {
          context: 'loadStopWords',
          path: path.join(__dirname, 'data', 'stopwords.json')
        });
        
        if (this.logger) {
          this.logger.error('加载停用词失败', { error: handledError.message });
        }
      }
      
      return defaultStopwords;
    }
  }

  /**
   * 解析消息对象
   * @param {Object} message 原始消息对象
   * @returns {Object} 解析后的消息对象
   */
  parse(message) {
    const startTime = Date.now();
    
    try {
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
        originalContent: '',
        cleanContent: '',
        tokens: [],
        keywords: [],
        metadata: {
          parseTime: startTime
        }
      };

      // 提取消息内容
      if (message.type === 'chat') {
        result.content = message.content || '';
      } else {
        // 尝试从其他字段提取文本内容
        result.content = message.content || message.message || message.text || '';
      }
      
      // 保存原始内容
      result.originalContent = result.content;

      // 文本清理和规范化
      result.cleanContent = this.cleanText(result.content);
      
      // 分词处理
      result.tokens = this.tokenize(result.cleanContent);
      
      // 提取关键词
      result.keywords = this.extractKeywords(result.cleanContent, this.options.maxKeywords);

      // 记录性能指标
      const processingTime = Date.now() - startTime;
      result.metadata.processingTime = processingTime;
      
      if (this.performanceMonitor && this.options.enablePerformanceMonitoring) {
        this.performanceMonitor.recordCustomMetric('message_parse_time', processingTime);
      this.performanceMonitor.recordCustomMetric('message_parsed', 1);
      this.performanceMonitor.recordCustomMetric('tokens_extracted', result.tokens.length);
      this.performanceMonitor.recordCustomMetric('keywords_extracted', result.keywords.length);
      }
      
      if (this.logger) {
        this.logger.debug('消息解析完成', {
          type: result.type,
          contentLength: result.content.length,
          tokensCount: result.tokens.length,
          keywordsCount: result.keywords.length,
          processingTime
        });
      }

      return result;
    } catch (error) {
      if (this.errorHandler) {
        const handledError = this.errorHandler.handleError(error, {
          context: 'parse',
          message,
          processingTime: Date.now() - startTime
        });
        
        if (this.logger) {
          this.logger.error('消息解析失败', {
            error: handledError.message,
            messageType: message?.type,
            processingTime: Date.now() - startTime
          });
        }
        
        throw handledError;
      }
      
      throw error;
    }
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
    cleanText = cleanText.replace(/<[^>]*>/g, '');
    
    // 去除特殊字符，只保留中文、英文、数字和空格
    cleanText = cleanText.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, ' ');
    
    // 去除多余空白字符
    cleanText = cleanText.replace(/\s+/g, ' ').trim();
    
    return cleanText;
  }

  /**
   * 对文本进行分词
   * @param {string} text 文本内容
   * @returns {Array} 分词结果
   */
  tokenize(text) {
    if (!text) return [];
    
    const startTime = Date.now();
    
    try {
      // 使用结巴分词
      const tokens = nodejieba.cut(text);
      
      // 过滤停用词
      const filteredTokens = tokens.filter(token => {
        // 过滤空字符和停用词
        return token.trim() && !this.stopwords.includes(token);
      });
      
      // 记录性能指标
      if (this.performanceMonitor && this.options.enablePerformanceMonitoring) {
        this.performanceMonitor.recordCustomMetric('tokenization_time', Date.now() - startTime);
    this.performanceMonitor.recordCustomMetric('tokens_before_filter', tokens.length);
    this.performanceMonitor.recordCustomMetric('tokens_after_filter', filteredTokens.length);
      }
      
      return filteredTokens;
    } catch (error) {
      if (this.errorHandler) {
        const handledError = this.errorHandler.handleError(error, {
          context: 'tokenize',
          text: text.substring(0, 100), // 只记录前100个字符
          textLength: text.length
        });
        
        if (this.logger) {
          this.logger.error('分词处理失败', {
            error: handledError.message,
            textLength: text.length
          });
        }
      }
      
      return [];
    }
  }

  /**
   * 提取关键词
   * @param {string} text 文本内容
   * @param {number} topN 提取前N个关键词
   * @returns {Array} 关键词数组
   */
  extractKeywords(text, topN = 5) {
    if (!text) return [];
    
    const startTime = Date.now();
    
    try {
      // 使用结巴分词的关键词提取功能
      const keywords = nodejieba.extract(text, topN);
      const result = keywords.map(item => item.word);
      
      // 记录性能指标
      if (this.performanceMonitor && this.options.enablePerformanceMonitoring) {
        this.performanceMonitor.recordCustomMetric('keyword_extraction_time', Date.now() - startTime);
      }
      
      return result;
    } catch (error) {
      if (this.errorHandler) {
        const handledError = this.errorHandler.handleError(error, {
          context: 'extractKeywords',
          text: text.substring(0, 100), // 只记录前100个字符
          topN
        });
        
        if (this.logger) {
          this.logger.error('提取关键词失败', {
            error: handledError.message,
            textLength: text.length,
            topN
          });
        }
      }
      
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

export default MessageParser;