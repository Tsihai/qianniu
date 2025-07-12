/**
 * 数据模型导出
 * 集中导出所有模型，方便其他模块引用
 */
import Customer from './Customer.js';
import Session from './Session.js';
import IntentTemplate from './IntentTemplate.js';
import db from '../config/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 导出所有模型
export default {
  db,
  Customer,
  Session,
  IntentTemplate,
  
  /**
   * 初始化数据库连接
   */
  async init() {
    try {
      await db.connect();
      console.log('数据库初始化成功');
      return true;
    } catch (error) {
      console.error('数据库初始化失败:', error);
      return false;
    }
  },
  
  /**
   * 导入默认数据
   */
  async importDefaultData() {
    try {
      // 尝试从文件导入默认意图数据
      
      // 导入意图数据
      const intentsPath = path.join(__dirname, '..', 'services', 'messageProcessor', 'data', 'intents.json');
      if (fs.existsSync(intentsPath)) {
        const intentsData = fs.readFileSync(intentsPath, 'utf8');
        const intentsJson = JSON.parse(intentsData);
        
        console.log(`开始导入意图数据，共 ${intentsJson.intents?.length || 0} 条`);
        const intentResults = await IntentTemplate.updateFromFile(intentsJson);
        console.log('意图数据导入结果:', intentResults);
      }
      
      // 导入回复数据
      const repliesPath = path.join(__dirname, '..', 'services', 'messageProcessor', 'data', 'replies.json');
      if (fs.existsSync(repliesPath)) {
        const repliesData = fs.readFileSync(repliesPath, 'utf8');
        const repliesJson = JSON.parse(repliesData);
        
        console.log(`开始导入回复模板，共 ${repliesJson.replies?.length || 0} 组`);
        
        // 处理回复数据
        let createdCount = 0;
        let updatedCount = 0;
        
        if (repliesJson.replies && Array.isArray(repliesJson.replies)) {
          for (const reply of repliesJson.replies) {
            if (!reply.intent) continue;
            
            try {
              // 查找对应意图
              const intent = await IntentTemplate.findOne({ name: reply.intent });
              
              if (intent) {
                // 如果意图存在，则更新其模板
                intent.templates = reply.templates.map(template => ({
                  text: template,
                  variables: reply.variables || [],
                  weight: 1,
                  enabled: true
                }));
                
                await intent.save();
                updatedCount++;
              } else {
                // 如果意图不存在，则创建新意图
                await IntentTemplate.create({
                  name: reply.intent,
                  description: `自动导入的回复模板: ${reply.intent}`,
                  type: 'custom',
                  patterns: [],
                  templates: reply.templates.map(template => ({
                    text: template,
                    variables: reply.variables || [],
                    weight: 1,
                    enabled: true
                  }))
                });
                createdCount++;
              }
            } catch (error) {
              console.error(`导入回复模板失败 [${reply.intent}]:`, error);
            }
          }
        }
        
        console.log(`回复模板导入结果: 更新=${updatedCount}, 新建=${createdCount}`);
      }
      
      return true;
    } catch (error) {
      console.error('导入默认数据失败:', error);
      return false;
    }
  }
};