# 💾 Database Backup & Maintenance Playbook

This guide covers database backup strategies, disaster recovery procedures, and routine maintenance practices for the **KudoMatch** (PredictorPro) Supabase Postgres database.

---

## 🗄️ Backup Strategies

We employ a multi-layered backup strategy to ensure complete data protection and zero-loss durability.

### 1. High-Fidelity JSON Snapshots (`scripts/db-backup.ts`)

For quick, developer-controlled backups, localized environment migration, and offline snapshots, we use our built-in JSON backup script. It exports data across all primary transactional tables in correct relational order.

#### 📤 Take a Backup

To export the complete database to a local timestamped snapshot file:

```bash
npm run db:backup
```

_Outputs file to `./backups/backup_YYYYMMDD_HHMMSS.json`_

#### 📥 Restore from a Backup

To restore the complete database state from a saved snapshot file:

```bash
npm run db:restore -- --restore=backups/backup_20260820_120000.json
```

### 2. Point-in-Time Recovery (PITR)

For production environments, Supabase offers automated continuous backups via physical replication.

- **Scope**: Every database change is recorded (Write-Ahead Logging).
- **Recovery Point Objective (RPO)**: Under 2 minutes.
- **Configuration**: Managed directly in the **Supabase Dashboard** -> **Project Settings** -> **Database** -> **Backups**. Enabling PITR guarantees that you can restore your database to any individual second in the past 7-30 days.

### 3. Physical schema and data dumps (`pg_dump`)

For offline storage or manual imports of SQL schema and raw tables, utilize native Postgres commands.

#### SQL Export (Schema + Data)

```bash
pg_dump -h db.your-supabase-id.supabase.co -U postgres -d postgres -F p -f backups/db_dump.sql
```

#### SQL Import / Restoration

```bash
psql -h db.your-supabase-id.supabase.co -U postgres -d postgres -f backups/db_dump.sql
```

---

## 🔧 Database Maintenance & Diagnostics

Over time, heavy insert, update, and delete activities (such as active prediction matchdays) can lead to stale planner statistics or dead tuples (bloat). The following routines keep the database optimized.

### 1. Database Size & Index Bloat Diagnostics

You can query table size metrics directly via the administrative helper function created in migration `20260820000005_pg_cron_and_automation.sql`:

```sql
SELECT * FROM public.get_db_size_report();
```

_This reports the relative disk sizes of all tables and indexes, highlighting candidates for table reindexing or VACUUM cleaning._

### 2. Stats Analysis & Dead Tuple Vacuuming

The database query planner relies on up-to-date column statistics to build high-performance query execution plans. We've established an automatic maintenance routine:

```sql
SELECT public.maintain_database_stats();
```

_This updates the statistics profiles for core transactional tables (`profiles`, `predictions`, `matches`, `pools`, `pool_members`)._

We recommend running this helper as a weekly background operation or trigger after heavy fixture simulation cycles.

---

## 🚀 Disaster Recovery & Rollback Plan

In the event of database corruption, table drops, or invalid data ingestion:

1. **Lock Write Access**: Temporarily place the Next.js app in maintenance mode by updating the `NEXT_PUBLIC_MAINTENANCE_MODE=true` env parameter.
2. **Determine Point of Failure**: Identify the exact timestamp when the corruption occurred.
3. **Restore via PITR (Recommended)**:
   - Navigate to the Supabase Dashboard.
   - Choose the restore to a point in time option.
   - Enter the timestamp immediately prior to the corruption event and hit Restore.
4. **Fallback JSON Snapshot Restore**:
   - If PITR is unavailable, locate the latest stable `./backups/backup_*.json` backup file.
   - Run the restoration CLI tool: `npm run db:restore -- --restore=<file-path>`.
5. **Verify Points & Standings Consistency**:
   - Log into the database and call `SELECT public.recalculate_all_scores();` to guarantee that all profile point tallies and predictions scores match completed fixture outcomes.
6. **Re-Enable Services**: Re-deploy the frontend and verify system integrity.
