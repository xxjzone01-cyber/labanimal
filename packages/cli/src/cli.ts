/**
 * LabAnimal CLI 入口
 *
 * 命令：
 *   labanimal migrate --from <sqlite> --to <postgres>  迁移数据
 */

import { Command } from 'commander';
import { migrate } from './migrate.js';

const program = new Command();

program
  .name('labanimal')
  .description('LabAnimal CLI - 实验动物管理数据迁移工具')
  .version('0.1.0');

program
  .command('migrate')
  .description('将数据从 SQLite 迁移到 LabAnimal PostgreSQL 数据库')
  .requiredOption('--from <source>', '源 SQLite 数据库文件路径')
  .requiredOption('--to <target>', '目标 PostgreSQL 连接字符串 (postgresql://...)')
  .option('--lab-id <id>', '目标实验室 ID（不指定则自动生成）')
  .option('--lab-name <name>', '新实验室名称', 'Migrated Lab')
  .option('--dry-run', '试运行模式：只读取和统计，不写入数据', false)
  .option('--skip-audit-log', '跳过审计日志迁移', false)
  .action(async (opts) => {
    try {
      console.log('LabAnimal 数据迁移工具 v0.1.0\n');

      if (opts.dryRun) {
        console.log('=== 试运行模式 ===\n');
      }

      await migrate({
        source: opts.from,
        target: opts.to,
        labId: opts.labId,
        labName: opts.labName,
        dryRun: opts.dryRun,
        skipAuditLog: opts.skipAuditLog,
      });

      if (!opts.dryRun) {
        console.log('\n迁移完成！');
      }
    } catch (err) {
      console.error('\n错误:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program.parse();
