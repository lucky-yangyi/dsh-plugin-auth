/**
 * 员工白名单导入：staff.csv → users 表。
 *
 * 用法：
 *   1. 更新 ~/Desktop/员工账号.xlsx 后，先导出 CSV（列顺序：employee_id,display_name,phone,password）
 *   2. node scripts/import-staff.mjs            # 默认读同目录 staff.csv
 *      node scripts/import-staff.mjs 别的.csv   # 或指定其他 CSV
 *
 * 行为：
 * - 手机号（phone）作为登录账号写入 users.username；密码按服务端同款 scrypt 格式落哈希。
 * - 幂等：手机号已存在的行只刷新姓名/工号，**不重置密码**（保护员工后续可能修改过的密码）。
 * - 自动补 users.employee_id / users.display_name 两列（幂等迁移），可先于插件重启执行。
 * - 跳过手机号格式非法的行并在报告中列出。
 *
 * 密码格式必须与 src/index.ts 的 hashPassword 完全一致：`s2$<salt-hex>$<scrypt-hex>`。
 */
import { createRequire } from 'node:module'
import { randomBytes, scryptSync } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const mysql = require('mysql2/promise')

const here = dirname(fileURLToPath(import.meta.url))
const csvPath = process.argv[2] ?? join(here, 'staff.csv')

// ---- 配置（与服务端 ~/.dsh/profiles/web/cordis.patch.yml 的 mysql 段保持一致）----
const MYSQL = {
  host: process.env.MYSQL_HOST ?? '127.0.0.1',
  user: process.env.MYSQL_USER ?? 'root',
  password: process.env.MYSQL_PASSWORD ?? '123456',
  database: process.env.MYSQL_DATABASE ?? 'dsh_auth',
}

const PHONE_RE = /^1[3-9]\d{9}$/
const NAME_RE = /^[\u4e00-\u9fa5A-Za-z0-9·]{1,32}$/

/** 与服务端 hashPassword 完全一致的哈希格式。 */
function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64)
  return `s2$${salt}$${hash.toString('hex')}`
}

/** 解析 CSV（标准 csv 即可；本表无逗号/引号字段，简单实现足够，但保留引号剥离）。 */
function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim() !== '')
  const header = lines[0].split(',').map((s) => s.trim())
  const rows = []
  for (const line of lines.slice(1)) {
    const cells = line.split(',').map((s) => s.trim().replace(/^"(.*)"$/, '$1'))
    rows.push(Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ''])))
  }
  return rows
}

// ---- 读取与校验 ----
let rows
try {
  rows = parseCsv(readFileSync(csvPath, 'utf8'))
} catch (err) {
  console.error(`读取 ${csvPath} 失败:`, err.message)
  process.exit(1)
}

const valid = []
const skipped = []
const seenPhone = new Set()
for (const r of rows) {
  const phone = String(r.phone ?? '').trim()
  const name = String(r.display_name ?? '').trim()
  const empId = String(r.employee_id ?? '').trim()
  const password = String(r.password ?? '').trim() || '123456'
  if (!PHONE_RE.test(phone)) { skipped.push([name || '(无名)', phone, '手机号格式非法']); continue }
  if (!NAME_RE.test(name)) { skipped.push([name, phone, '姓名格式非法']); continue }
  if (seenPhone.has(phone)) { skipped.push([name, phone, 'CSV 内手机号重复']); continue }
  seenPhone.add(phone)
  valid.push({ phone, name, empId, password })
}

console.log(`CSV: ${csvPath}`)
console.log(`解析 ${rows.length} 行：可导入 ${valid.length}，跳过 ${skipped.length}`)

// ---- 建连接与列迁移 ----
const pool = mysql.createPool(MYSQL)

async function addColumnIfMissing(table, column, definition) {
  const [cols] = await pool.query(
    'SELECT 1 AS ok FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1',
    [table, column],
  )
  if (cols.length === 0) {
    await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`)
    console.log(`迁移: ${table}.${column} 已添加`)
  }
}
await addColumnIfMissing('users', 'employee_id', 'VARCHAR(32) NULL')
await addColumnIfMissing('users', 'display_name', 'VARCHAR(64) NULL')

// ---- 导入（事务内逐行 upsert）----
let inserted = 0
let updated = 0
const conn = await pool.getConnection()
try {
  await conn.beginTransaction()
  for (const v of valid) {
    // 先探存在性：存在则只刷新姓名/工号（不重置密码），不存在则插入含密码哈希的完整行
    const [found] = await conn.query('SELECT id FROM users WHERE username = ? LIMIT 1', [v.phone])
    if (found.length > 0) {
      await conn.query('UPDATE users SET display_name = ?, employee_id = ? WHERE username = ?', [v.name, v.empId, v.phone])
      updated++
    } else {
      await conn.query(
        'INSERT INTO users (username, password_hash, employee_id, display_name) VALUES (?, ?, ?, ?)',
        [v.phone, hashPassword(v.password), v.empId, v.name],
      )
      inserted++
    }
  }
  await conn.commit()
} catch (err) {
  await conn.rollback()
  console.error('导入失败，已整体回滚：', err.message)
  process.exitCode = 1
} finally {
  conn.release()
}

// ---- 报告 ----
const [total] = await pool.query('SELECT COUNT(*) AS n FROM users')
const [staff] = await pool.query('SELECT COUNT(*) AS n FROM users WHERE display_name IS NOT NULL')
console.log('')
console.log(`导入完成：新插入 ${inserted}，刷新已存在 ${updated}，跳过 ${skipped.length}`)
console.log(`users 表总计 ${total[0].n} 个账号（其中员工 ${staff[0].n} 个）`)
if (skipped.length > 0) {
  console.log('\n跳过明细（姓名, 手机号, 原因）：')
  for (const s of skipped) console.log(`  ${s.join(' | ')}`)
}
await pool.end()