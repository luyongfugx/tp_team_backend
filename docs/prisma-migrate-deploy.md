# Prisma Migrate Deploy 接入与使用

## 1. 当前状态

项目已建立 Prisma Migrate baseline：

```text
prisma/migrations/
├── migration_lock.toml
└── 20260813000000_baseline/
    └── migration.sql
```

Baseline SQL 表示“从空 MySQL 数据库建立当前完整结构”。对于已经存在的数据库，不能执行这份建表 SQL，只能使用 `migrate resolve` 将它登记为已执行。

生成 baseline 前，已经运行以下只读检查，当前 `DATABASE_URL` 数据库与 `schema.prisma` 没有检测到结构差异：

```bash
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --exit-code
```

## 2. 首次接入已有数据库

以下步骤需要对开发、测试、预发布和生产等每一个已有数据库分别执行一次。

### 2.1 备份数据库

在写入 Prisma migration 元数据前完成数据库备份，并确认备份可恢复。Baseline 不修改业务表，但会创建和写入 `_prisma_migrations`。

### 2.2 指向目标数据库

确认当前环境的 `DATABASE_URL` 指向正确数据库：

```bash
npx prisma validate
```

不要把生产数据库 URL 保存到 Git，也不要在本地终端历史中直接粘贴明文密码。

### 2.3 再次检查结构差异

```bash
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --exit-code
```

结果必须是：

```text
No difference detected.
```

如果退出码为 `2` 或显示差异，先停止接入。应通过 `prisma db pull` 的临时输出或 SQL 审计找出生产结构与 Schema 的差异，不能直接执行 baseline SQL。

### 2.4 标记 baseline 已执行

```bash
npm exec prisma migrate resolve -- \
  --applied 20260813000000_baseline
```

这条命令不会执行 baseline 中的 `CREATE TABLE`，只会在目标数据库的 `_prisma_migrations` 表登记该迁移已经存在。

### 2.5 验证状态

```bash
npm run db:migrate:status
```

预期结果：

```text
Database schema is up to date!
```

## 3. 新建空数据库

对于没有任何业务表的新 MySQL 数据库，不运行 `migrate resolve`，直接执行：

```bash
npm run db:migrate:deploy
```

Prisma 会执行 baseline SQL，建立全部表、索引、外键和 `_prisma_migrations`。

## 4. 后续开发流程

### 4.1 修改 Schema

编辑：

```text
prisma/schema.prisma
```

### 4.2 在本地开发数据库生成迁移

```bash
npm run db:migrate:dev -- --name add_team_context_indexes
```

该命令会：

1. 比较开发数据库与 migration 历史。
2. 在 `prisma/migrations/` 新建带时间戳的迁移目录。
3. 在开发数据库执行迁移。
4. 重新生成 Prisma Client。

`migrate dev` 只能针对本地或专用开发数据库运行，不能连接生产数据库。它需要创建和使用 shadow database 的权限；如果数据库账号权限受限，应配置独立的 `SHADOW_DATABASE_URL` 或使用有相应权限的开发账号。

### 4.3 审查生成的 SQL

提交代码前必须阅读新生成的 `migration.sql`，重点检查：

- 是否意外删除表、列或索引。
- 新增非空列是否为已有数据提供默认值或回填步骤。
- 唯一索引是否会被历史重复数据阻止。
- 大表建索引是否造成长时间锁表或高负载。
- 字段类型变化是否发生截断、精度变化或字符集变化。
- 外键删除策略是否符合业务逻辑。

复杂迁移可以先生成但暂不执行：

```bash
npx prisma migrate dev --name change_name --create-only
```

编辑 SQL 后，再在开发数据库运行：

```bash
npx prisma migrate dev
```

### 4.4 提交文件

每次 Schema 变更应一起提交：

```text
prisma/schema.prisma
prisma/migrations/<timestamp>_<name>/migration.sql
```

不得只提交 Schema 而漏掉 migration，也不得修改已经在共享环境执行过的 migration SQL；需要修正时创建下一份迁移。

## 5. 测试和预发布

部署应用代码前执行：

```bash
npm ci
npm run db:migrate:status
npm run db:migrate:deploy
npm run build
```

建议先在预发布数据库验证：

- Migration 执行时间。
- 应用构建和 Prisma Client 生成。
- 登录、团队、项目、照片和 Feed 核心接口。
- 旧版 iOS/Android API 兼容性。
- 新索引是否被查询计划使用。

## 6. Dokploy 生产部署

推荐顺序：

1. 备份生产数据库。
2. 运行一个且仅一个 migration job：`npm run db:migrate:deploy`。
3. Migration 成功后部署或滚动重启 Next.js 实例。
4. 执行健康检查和核心接口冒烟测试。
5. 运行 `npm run db:migrate:status` 确认没有待执行或失败迁移。

不要让每个水平扩展的 Next.js 实例在启动时同时执行 migration。`migrate deploy` 应作为 Dokploy 的单独 Release Command、一次性 Job，或由 CI/CD 单独运行。

当前推荐部署命令：

```bash
npm run db:migrate:deploy && npm run build
```

若 Dokploy 分离构建和发布阶段，则构建阶段只运行 `npm run build`，发布阶段单独运行 `npm run db:migrate:deploy`。

## 7. 向后兼容的发布顺序

生产数据库迁移应优先采用 Expand/Contract：

1. **Expand**：先增加可空列、新表或新索引，不删除旧结构。
2. 部署同时兼容新旧结构的服务端代码。
3. 回填历史数据并验证。
4. iOS/Android/Web 切换到新字段。
5. **Contract**：确认旧版本不再使用后，再通过新的 migration 删除旧字段。

数据库迁移通常不支持自动向下回滚。发布失败时优先回滚应用代码，因此数据库变更必须在一段时间内兼容旧应用版本。

## 8. 失败处理

先查看状态：

```bash
npm run db:migrate:status
```

若 migration 失败：

1. 立即停止后续应用部署。
2. 查看 `_prisma_migrations.logs` 和数据库错误日志。
3. 不要删除 migration 目录，也不要直接修改已经提交的 SQL。
4. 若数据库事务已经完整回滚，修复问题后可将失败 migration 标记为 rolled back：

```bash
npm exec prisma migrate resolve -- \
  --rolled-back <migration_name>
```

5. 若部分 SQL 已生效，先根据真实数据库状态制定前滚 SQL，再使用 `migrate resolve` 对齐历史。

生产环境不使用 `prisma migrate reset`，也不使用 `prisma db push` 修复失败迁移。

## 9. 命令速查

| 目的 | 命令 |
| --- | --- |
| 校验 Schema | `npx prisma validate` |
| 开发环境生成迁移 | `npm run db:migrate:dev -- --name <name>` |
| 只生成 SQL | `npx prisma migrate dev --name <name> --create-only` |
| 部署已有迁移 | `npm run db:migrate:deploy` |
| 查看迁移状态 | `npm run db:migrate:status` |
| 已有库登记 baseline | `npm exec prisma migrate resolve -- --applied 20260813000000_baseline` |
| 生成 Prisma Client | `npx prisma generate` |

`npm run db:push` 仅保留给可随时丢弃的临时本地数据库。开发、测试、预发布和生产的正式结构变更全部使用 Prisma Migrate。
