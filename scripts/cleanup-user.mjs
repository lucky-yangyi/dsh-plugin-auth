import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const mysql = require('/Users/shuaiyi/dsh-plugins/dsh-plugin-auth/node_modules/mysql2/promise')

const UID = Number(process.argv[2] ?? 76)
const pool = mysql.createPool({ host: '127.0.0.1', user: 'root', password: '123456', database: 'dsh_auth', connectionLimit: 5 })
const conn = await pool.getConnection()
try {
  const run = async (sql) => { const [r] = await conn.execute(sql); return r.affectedRows }
  console.log('session_uploads:', await run(`DELETE FROM session_uploads WHERE session_id IN (SELECT session_id FROM session_owners WHERE user_id=${UID})`))
  console.log('session_owners :', await run(`DELETE FROM session_owners WHERE user_id=${UID}`))
  console.log('users          :', await run(`DELETE FROM users WHERE id=${UID}`))
} catch (e) {
  console.error('DB ERROR:', String(e))
} finally {
  await pool.end()
}
