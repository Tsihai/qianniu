# 千牛数据架构项目

## 项目简介

千牛数据架构项目是一个基于淘宝生态的客服自动化系统，旨在实时捕获买家咨询消息并进行自动分类，提供智能客服解决方案。该项目采用前后端分离架构，使用Next.js构建前端，Node.js构建后端服务。

## 项目结构

项目由两个主要部分组成：

- **qianniu-dashboard**: 使用Next.js构建的前端仪表盘，用于展示数据分析和系统监控
- **qianniu-service**: Node.js后端服务，负责数据处理、消息分类和业务逻辑

## 技术栈

### 前端
- Next.js (App Router)
- React
- TypeScript
- Tailwind CSS
- Chart.js
- WebSocket

### 后端
- Node.js
- Express
- SQLite
- Jest (单元测试)
- WebSocket

## 核心功能

1. 实时捕获买家咨询消息
2. 自动分类消息内容
3. 智能回复推荐
4. 客户行为分析
5. 系统性能监控

## 开发指南

### 安装依赖

```bash
# 安装前端依赖
cd qianniu-dashboard
npm install

# 安装后端依赖
cd ../qianniu-service
npm install
```

### 运行开发环境

```bash
# 运行前端
cd qianniu-dashboard
npm run dev

# 运行后端
cd ../qianniu-service
npm run dev
```

## 贡献指南

1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交你的更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 开启一个 Pull Request

## 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件 