#!/usr/bin/env node

/**
 * TypeScript 重置脚本
 * 用于解决 IDE TypeScript 语言服务器缓存问题
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const projectRoot = path.resolve(__dirname, '..')
const tsconfigPath = path.join(projectRoot, 'tsconfig.json')
const nextTypesPath = path.join(projectRoot, '.next', 'types')
const nodeModulesTypesPath = path.join(projectRoot, 'node_modules', '.cache')

console.log('🔄 开始重置 TypeScript 缓存...')

// 1. 清理 .next/types 目录
if (fs.existsSync(nextTypesPath)) {
  console.log('🗑️  清理 .next/types 目录')
  fs.rmSync(nextTypesPath, { recursive: true, force: true })
}

// 2. 清理 node_modules 缓存
if (fs.existsSync(nodeModulesTypesPath)) {
  console.log('🗑️  清理 node_modules 缓存')
  fs.rmSync(nodeModulesTypesPath, { recursive: true, force: true })
}

// 3. 重新生成 TypeScript 类型
try {
  console.log('🔨 重新生成 TypeScript 类型')
  execSync('npx tsc --noEmit', { cwd: projectRoot, stdio: 'inherit' })
} catch (error) {
  console.log('⚠️  TypeScript 检查完成（可能有错误，这是正常的）')
}

// 4. 重启 Next.js 开发服务器（如果正在运行）
console.log('✅ TypeScript 缓存重置完成')
console.log('\n📝 请在 IDE 中执行以下操作：')
console.log('   1. 重启 TypeScript 语言服务器')
console.log('   2. 或者重新加载 VS Code/Cursor 窗口')
console.log('   3. 如果问题仍然存在，请重启开发服务器')