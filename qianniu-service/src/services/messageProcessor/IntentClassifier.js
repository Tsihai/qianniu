/**
 * 意图分类器
 * 负责识别消息的意图类型
 */
const fs = require('fs');
const path = require('path');
const natural = require('natural');

class IntentClassifier {
  constructor() {
    // 创建TF-IDF实例
    this.tfidf = new natural.TfIdf();
    
    // 加载意图数据
    this.loadIntents();
    
    // 初始化分类器
    this.initializeClassifier();
  }

  /**
   * 加载意图数据
   */
  loadIntents() {
    try {
      const intentsPath = path.join(__dirname, 'data', 'intents.json');
      const intentsData = fs.readFileSync(intentsPath, 'utf8');
      this.intents = JSON.parse(intentsData).intents || [];
      console.log(`意图数据加载成功，共${this.intents.length}种意图`);
    } catch (error) {
      console.error('加载意图数据失败:', error);
      this.intents = [];
    }
  }
  
  /**
   * 初始化分类器
   */
  initializeClassifier() {
    try {
      // 使用朴素贝叶斯分类器
      this.classifier = new natural.BayesClassifier();
      
      // 为分类器添加训练数据
      if (this.intents && this.intents.length > 0) {
        this.intents.forEach(intent => {
          intent.patterns.forEach(pattern => {
            this.classifier.addDocument(pattern, intent.name);
          });
        });
        
        // 训练分类器
        this.classifier.train();
        console.log('意图分类器训练完成');
      }
      
      // 初始化TF-IDF
      if (this.intents && this.intents.length > 0) {
        this.intents.forEach(intent => {
          intent.patterns.forEach((pattern, index) => {
            this.tfidf.addDocument(pattern);
          });
        });
      }
    } catch (error) {
      console.error('初始化分类器失败:', error);
      this.classifier = null;
    }
  }

  /**
   * 识别消息的意图
   * @param {Object} parsedMessage 解析后的消息对象
   * @returns {Array} 识别出的意图数组，按置信度排序
   */
  classify(parsedMessage) {
    if (!parsedMessage || !parsedMessage.cleanContent) {
      return [{
        intent: 'unknown',
        confidence: 0
      }];
    }

    const content = parsedMessage.cleanContent;
    
    // 首先使用模式匹配识别意图（更精确）
    const patternResult = this.classifyByPatterns(content);
    
    // 如果模式匹配有高置信度结果，直接返回
    const highConfidencePattern = patternResult.find(r => r.confidence > 0.7);
    if (highConfidencePattern) {
      return [highConfidencePattern];
    }
    
    // 使用关键词匹配增强识别
    let keywordResults = [];
    if (parsedMessage.keywords && parsedMessage.keywords.length > 0) {
      keywordResults = this.classifyByKeywords(parsedMessage.keywords);
    }
    
    // 使用分类器进行识别
    let classifierResult = [];
    if (this.classifier) {
      try {
        classifierResult = this.classifyByClassifier(content);
      } catch (error) {
        console.error('分类器识别失败:', error);
      }
    }
    
    // 合并结果并按置信度排序
    const results = [...patternResult, ...keywordResults, ...classifierResult];
    const uniqueResults = this.deduplicateResults(results);
    
    return uniqueResults.sort((a, b) => b.confidence - a.confidence);
  }
  
  /**
   * 根据关键词匹配意图
   * @param {Array} keywords 关键词数组
   * @returns {Array} 匹配的意图数组
   */
  classifyByKeywords(keywords) {
    const results = [];
    
    if (!this.intents || !keywords || keywords.length === 0) return results;
    
    this.intents.forEach(intent => {
      let matchCount = 0;
      let totalKeywords = keywords.length;
      
      // 检查每个模式是否包含关键词
      intent.patterns.forEach(pattern => {
        keywords.forEach(keyword => {
          if (pattern.includes(keyword)) {
            matchCount++;
          }
        });
      });
      
      // 计算匹配分数
      if (matchCount > 0) {
        const score = matchCount / totalKeywords;
        results.push({
          intent: intent.name,
          confidence: score * (intent.confidence || 0.7),
          method: 'keyword'
        });
      }
    });
    
    return results;
  }
  
  /**
   * 根据模式匹配识别意图
   * @param {string} content 消息内容
   * @returns {Array} 匹配的意图数组
   */
  classifyByPatterns(content) {
    const results = [];
    
    // 遍历所有意图，寻找匹配
    if (!this.intents) return results;
    
    this.intents.forEach(intent => {
      // 检查每个模式是否在内容中出现
      let maxScore = 0;
      let matchedPattern = '';
      
      intent.patterns.forEach(pattern => {
        if (content.includes(pattern)) {
          // 计算匹配分数 (模式长度 / 内容长度)
          const score = pattern.length / content.length;
          if (score > maxScore) {
            maxScore = score;
            matchedPattern = pattern;
          }
        }
      });
      
      // 如果有匹配，添加到结果
      if (maxScore > 0) {
        results.push({
          intent: intent.name,
          confidence: maxScore * (intent.confidence || 0.8),
          matchedPattern: matchedPattern,
          method: 'pattern'
        });
      }
    });
    
    return results;
  }
  
  /**
   * 使用分类器识别意图
   * @param {string} content 消息内容
   * @returns {Array} 分类结果数组
   */
  classifyByClassifier(content) {
    if (!this.classifier) {
      return [];
    }
    
    try {
      // 获取分类结果
      let classifications;
      
      try {
        classifications = this.classifier.getClassifications(content);
      } catch (error) {
        console.error('分类器获取分类失败:', error);
        return [];
      }
      
      // 转换为标准格式，调整置信度
      const results = classifications
        .filter(result => result.value > 0.1) // 过滤低置信度结果
        .map(result => ({
          intent: result.label,
          confidence: Math.min(result.value * 0.7, 0.7), // 降低分类器置信度，避免它总是主导结果
          method: 'classifier'
        }));
      
      // 如果没有任何结果，尝试使用TF-IDF进行匹配
      if (results.length === 0) {
        return this.classifyByTfIdf(content);
      }
      
      return results;
    } catch (error) {
      console.error('分类器识别意图出错:', error);
      return [];
    }
  }
  
  /**
   * 使用TF-IDF进行意图匹配
   * @param {string} content 消息内容
   * @returns {Array} 匹配结果数组
   */
  classifyByTfIdf(content) {
    try {
      const results = [];
      
      // 计算内容与各个意图模式的相似度
      this.tfidf.tfidfs(content, (i, measure) => {
        if (measure > 0 && i < this.intents.length) {
          const intent = this.intents[i];
          results.push({
            intent: intent.name,
            confidence: Math.min(measure / 10, 0.6), // 归一化置信度，降低TF-IDF的权重
            method: 'tfidf'
          });
        }
      });
      
      return results;
    } catch (error) {
      console.error('TF-IDF匹配失败:', error);
      return [];
    }
  }

  /**
   * 去重并合并结果
   * @param {Array} results 结果数组
   * @returns {Array} 去重后的结果
   */
  deduplicateResults(results) {
    const uniqueMap = new Map();
    
    results.forEach(result => {
      const existingResult = uniqueMap.get(result.intent);
      
      if (!existingResult || result.confidence > existingResult.confidence) {
        uniqueMap.set(result.intent, result);
      }
    });
    
    return Array.from(uniqueMap.values());
  }
  
  /**
   * 获取意图对应的置信度阈值
   * @param {string} intent 意图名称
   * @returns {number} 置信度阈值
   */
  getConfidenceThreshold(intent) {
    if (!this.intents) return 0.5;
    const intentData = this.intents.find(item => item.name === intent);
    return intentData ? (intentData.confidence || 0.5) : 0.5;
  }
  
  /**
   * 获取最佳意图匹配
   * @param {Object} parsedMessage 解析后的消息
   * @returns {Object|null} 最佳匹配意图
   */
  getBestIntent(parsedMessage) {
    const intents = this.classify(parsedMessage);
    
    if (intents.length === 0) {
      return null;
    }
    
    const bestIntent = intents[0];
    
    // 检查置信度是否达到阈值
    const threshold = this.getConfidenceThreshold(bestIntent.intent);
    
    return bestIntent.confidence >= threshold ? bestIntent : null;
  }
}

module.exports = IntentClassifier; 