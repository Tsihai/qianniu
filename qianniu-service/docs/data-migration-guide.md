# 数据迁移指南

本指南详细介绍了千牛客服自动化系统的数据迁移工具使用方法和最佳实践。

## 概述

数据迁移工具支持在不同数据存储系统之间迁移数据，包括：

- **JSON文件** ↔ **SQLite数据库**
- **MongoDB** ↔ **SQLite数据库**
- **JSON文件** ↔ **MongoDB**

## 支持的数据类型

迁移工具支持以下数据类型的迁移：

1. **客户信息 (Customers)**
   - 客户ID、姓名、邮箱、电话
   - 标签、元数据
   - 创建和更新时间

2. **会话数据 (Sessions)**
   - 会话ID、客户ID
   - 会话状态、开始时间
   - 会话元数据

3. **意图模板 (Intent Templates)**
   - 意图名称、关键词
   - 回复模板、置信度
   - 分类和状态信息

## 基本用法

### 命令行语法

```bash
node src/scripts/migrate.js [选项]
```

### 必需参数

- `--source-type <type>`: 源数据类型 (json, mongodb, sqlite)
- `--target-type <type>`: 目标数据类型 (json, mongodb, sqlite)

### 源数据配置

#### JSON文件源
```bash
--source-type json --source-path ./data/source.json
```

#### MongoDB源
```bash
--source-type mongodb --source-uri mongodb://localhost:27017/source_db
```

#### SQLite源
```bash
--source-type sqlite --source-path ./data/source.db
```

### 目标数据配置

#### JSON文件目标
```bash
--target-type json --target-path ./data/target.json
```

#### MongoDB目标
```bash
--target-type mongodb --target-uri mongodb://localhost:27017/target_db
```

#### SQLite目标
```bash
--target-type sqlite --target-path ./data/target.db
```

## 迁移示例

### 1. JSON到SQLite迁移

```bash
# 基本迁移
node src/scripts/migrate.js \
  --source-type json \
  --source-path ./data/backup.json \
  --target-type sqlite \
  --target-path ./data/production.db

# 带验证的迁移
node src/scripts/migrate.js \
  --source-type json \
  --source-path ./data/backup.json \
  --target-type sqlite \
  --target-path ./data/production.db \
  --validate

# 批量迁移
node src/scripts/migrate.js \
  --source-type json \
  --source-path ./data/large_backup.json \
  --target-type sqlite \
  --target-path ./data/production.db \
  --batch-size 100
```

### 2. MongoDB到SQLite迁移

```bash
# 从MongoDB迁移到SQLite
node src/scripts/migrate.js \
  --source-type mongodb \
  --source-uri mongodb://localhost:27017/old_qianniu \
  --target-type sqlite \
  --target-path ./data/migrated.db

# 从远程MongoDB迁移
node src/scripts/migrate.js \
  --source-type mongodb \
  --source-uri mongodb://user:pass@remote-server:27017/qianniu \
  --target-type sqlite \
  --target-path ./data/migrated.db
```

### 3. SQLite到JSON迁移（备份）

```bash
# 导出SQLite数据到JSON
node src/scripts/migrate.js \
  --source-type sqlite \
  --source-path ./data/production.db \
  --target-type json \
  --target-path ./backup/$(date +%Y%m%d)_backup.json
```

## 高级选项

### 批处理大小

使用 `--batch-size` 参数控制批处理大小，优化内存使用和性能：

```bash
# 小批量处理（适合内存受限环境）
--batch-size 50

# 大批量处理（适合高性能环境）
--batch-size 500

# 默认批量大小
--batch-size 100
```

### 数据验证

使用 `--validate` 参数启用数据验证：

```bash
# 启用数据验证
node src/scripts/migrate.js \
  --source-type json \
  --source-path ./data/source.json \
  --target-type sqlite \
  --target-path ./data/target.db \
  --validate
```

验证包括：
- 必需字段检查
- 数据类型验证
- 邮箱格式验证
- 唯一性约束检查

### 进度监控

迁移过程中会显示实时进度：

```
迁移进度: [████████████████████] 100% | 1000/1000 记录
已处理: 1000 条记录
成功迁移: 995 条记录
失败: 5 条记录
耗时: 15.2 秒
```

### 错误处理

迁移工具具有强大的错误恢复能力：

- **继续处理**: 遇到单条记录错误时继续处理其他记录
- **错误记录**: 详细记录失败的记录和原因
- **部分成功**: 即使有错误也会保存成功迁移的数据

## JSON数据格式

### 标准JSON格式

```json
{
  "customers": [
    {
      "customerId": "customer_001",
      "name": "张三",
      "email": "zhangsan@example.com",
      "phone": "13800138000",
      "tags": ["VIP", "老客户"],
      "metadata": {
        "source": "官网",
        "level": "gold"
      },
      "createdAt": "2025-01-15T10:00:00.000Z",
      "updatedAt": "2025-01-15T10:00:00.000Z"
    }
  ],
  "sessions": [
    {
      "sessionId": "session_001",
      "customerId": "customer_001",
      "status": "active",
      "startTime": "2025-01-15T10:00:00.000Z",
      "metadata": {
        "channel": "web",
        "userAgent": "Mozilla/5.0..."
      }
    }
  ],
  "intentTemplates": [
    {
      "intent": "greeting",
      "keywords": ["你好", "hello", "hi"],
      "responses": ["您好！有什么可以帮助您的吗？"],
      "confidence": 0.95,
      "category": "common",
      "isActive": true,
      "createdAt": "2025-01-15T10:00:00.000Z",
      "updatedAt": "2025-01-15T10:00:00.000Z"
    }
  ]
}
```

## 最佳实践

### 1. 迁移前准备

```bash
# 1. 备份原始数据
cp ./data/production.db ./backup/production_$(date +%Y%m%d).db

# 2. 验证源数据完整性
node src/scripts/migrate.js --source-type sqlite --source-path ./data/production.db --validate-only

# 3. 测试迁移（使用小数据集）
node src/scripts/migrate.js \
  --source-type sqlite \
  --source-path ./data/test_sample.db \
  --target-type json \
  --target-path ./test/migration_test.json
```

### 2. 生产环境迁移

```bash
# 1. 停止应用服务
sudo systemctl stop qianniu-service

# 2. 执行迁移
node src/scripts/migrate.js \
  --source-type json \
  --source-path ./backup/legacy_data.json \
  --target-type sqlite \
  --target-path ./data/production.db \
  --batch-size 200 \
  --validate

# 3. 验证迁移结果
node src/scripts/migrate.js \
  --source-type sqlite \
  --source-path ./data/production.db \
  --validate-only

# 4. 启动应用服务
sudo systemctl start qianniu-service
```

### 3. 定期备份

创建定期备份脚本：

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backup"
SOURCE_DB="./data/production.db"
BACKUP_FILE="$BACKUP_DIR/backup_$DATE.json"

# 确保备份目录存在
mkdir -p $BACKUP_DIR

# 执行备份
node src/scripts/migrate.js \
  --source-type sqlite \
  --source-path $SOURCE_DB \
  --target-type json \
  --target-path $BACKUP_FILE

echo "备份完成: $BACKUP_FILE"

# 清理7天前的备份
find $BACKUP_DIR -name "backup_*.json" -mtime +7 -delete
```

### 4. 性能优化

#### 大数据集迁移

```bash
# 对于大数据集（>10万条记录）
node src/scripts/migrate.js \
  --source-type mongodb \
  --source-uri mongodb://localhost:27017/large_db \
  --target-type sqlite \
  --target-path ./data/large.db \
  --batch-size 1000 \
  --no-validate  # 跳过验证以提高性能
```

#### 内存优化

```bash
# 对于内存受限环境
node --max-old-space-size=2048 src/scripts/migrate.js \
  --source-type json \
  --source-path ./data/huge_data.json \
  --target-type sqlite \
  --target-path ./data/migrated.db \
  --batch-size 50
```

## 故障排除

### 常见错误

#### 1. 文件权限错误

```
错误: EACCES: permission denied, open './data/target.db'
```

**解决方案:**
```bash
# 检查目录权限
ls -la ./data/

# 修复权限
chmod 755 ./data/
chown $USER:$USER ./data/
```

#### 2. 数据格式错误

```
错误: 无效的JSON格式
```

**解决方案:**
```bash
# 验证JSON格式
node -e "JSON.parse(require('fs').readFileSync('./data/source.json', 'utf8'))"

# 使用JSON格式化工具
jq . ./data/source.json > ./data/source_formatted.json
```

#### 3. 数据库连接错误

```
错误: 无法连接到MongoDB
```

**解决方案:**
```bash
# 检查MongoDB服务状态
sudo systemctl status mongod

# 测试连接
mongo mongodb://localhost:27017/test --eval "db.runCommand('ping')"

# 检查网络连接
telnet localhost 27017
```

#### 4. 内存不足错误

```
错误: JavaScript heap out of memory
```

**解决方案:**
```bash
# 增加Node.js内存限制
node --max-old-space-size=4096 src/scripts/migrate.js [参数]

# 减少批处理大小
--batch-size 25
```

### 数据验证失败

当数据验证失败时，迁移工具会提供详细的错误报告：

```
验证错误报告:
- 记录 #123: customerId 不能为空
- 记录 #456: email 格式无效: "invalid-email"
- 记录 #789: phone 长度超出限制

建议:
1. 修复源数据中的错误
2. 使用 --no-validate 跳过验证（不推荐）
3. 手动处理失败的记录
```

## 监控和日志

### 启用详细日志

```bash
# 启用调试日志
DEBUG=migrate:* node src/scripts/migrate.js [参数]

# 保存日志到文件
node src/scripts/migrate.js [参数] 2>&1 | tee migration.log
```

### 迁移报告

迁移完成后会生成详细报告：

```
=== 迁移报告 ===
开始时间: 2025-01-15 10:00:00
结束时间: 2025-01-15 10:05:30
总耗时: 5分30秒

数据统计:
- 客户记录: 1,250 条 (成功: 1,248, 失败: 2)
- 会话记录: 3,456 条 (成功: 3,456, 失败: 0)
- 意图模板: 89 条 (成功: 89, 失败: 0)

性能指标:
- 平均处理速度: 15.2 记录/秒
- 内存峰值使用: 256 MB
- 磁盘I/O: 45.6 MB

错误详情:
- customer_001: email格式无效
- customer_789: customerId重复
```

## 自动化脚本

### 定时备份脚本

```bash
#!/bin/bash
# crontab: 0 2 * * * /path/to/auto_backup.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DATE=$(date +%Y%m%d)
BACKUP_DIR="$PROJECT_DIR/backup"

cd "$PROJECT_DIR"

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 执行备份
node src/scripts/migrate.js \
  --source-type sqlite \
  --source-path ./data/production.db \
  --target-type json \
  --target-path "$BACKUP_DIR/daily_backup_$DATE.json"

if [ $? -eq 0 ]; then
    echo "$(date): 备份成功 - $BACKUP_DIR/daily_backup_$DATE.json" >> "$BACKUP_DIR/backup.log"
else
    echo "$(date): 备份失败" >> "$BACKUP_DIR/backup.log"
    # 发送告警邮件
    echo "数据库备份失败，请检查系统状态" | mail -s "备份失败告警" admin@example.com
fi

# 清理30天前的备份
find "$BACKUP_DIR" -name "daily_backup_*.json" -mtime +30 -delete
```

### 迁移验证脚本

```bash
#!/bin/bash
# validate_migration.sh

SOURCE_DB="$1"
TARGET_DB="$2"

if [ -z "$SOURCE_DB" ] || [ -z "$TARGET_DB" ]; then
    echo "用法: $0 <源数据库> <目标数据库>"
    exit 1
fi

echo "验证迁移结果..."

# 比较记录数量
SOURCE_COUNT=$(sqlite3 "$SOURCE_DB" "SELECT COUNT(*) FROM customers;")
TARGET_COUNT=$(sqlite3 "$TARGET_DB" "SELECT COUNT(*) FROM customers;")

echo "源数据库客户数量: $SOURCE_COUNT"
echo "目标数据库客户数量: $TARGET_COUNT"

if [ "$SOURCE_COUNT" -eq "$TARGET_COUNT" ]; then
    echo "✅ 客户数据迁移完整"
else
    echo "❌ 客户数据迁移不完整"
    exit 1
fi

# 验证数据完整性
node -e "
  const sqlite3 = require('sqlite3');
  const db = new sqlite3.Database('$TARGET_DB');
  db.all('SELECT customerId FROM customers WHERE customerId IS NULL OR customerId = \"\"', (err, rows) => {
    if (err) {
      console.error('验证失败:', err);
      process.exit(1);
    }
    if (rows.length > 0) {
      console.error('❌ 发现无效的客户ID');
      process.exit(1);
    }
    console.log('✅ 数据完整性验证通过');
    db.close();
  });
"

echo "迁移验证完成"
```

## 总结

数据迁移工具提供了强大而灵活的数据迁移能力，支持多种数据源和目标，具有以下特点：

- **多格式支持**: JSON、SQLite、MongoDB
- **批量处理**: 优化内存使用和性能
- **数据验证**: 确保数据完整性和正确性
- **错误恢复**: 强大的错误处理和恢复机制
- **进度监控**: 实时显示迁移进度
- **详细日志**: 完整的操作记录和错误报告

通过遵循本指南的最佳实践，您可以安全、高效地完成数据迁移任务。