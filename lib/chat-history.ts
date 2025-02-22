import sql from 'mssql';

// 确保环境变量存在，否则抛出错误
const getEnvVar = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Environment variable ${name} is missing`);
  return value;
};

const config = {
  user: getEnvVar('SQL_SERVER_USER'),
  password: getEnvVar('SQL_SERVER_PASSWORD'),
  server: getEnvVar('SQL_SERVER_HOST'),
  database: getEnvVar('SQL_SERVER_DATABASE'),
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
};

// 保存会话记录
export async function saveChatHistory(sessionId: string, messages: any) {
  let pool;
  try {
    pool = await sql.connect(config);
    const request = pool.request();
    request.input('SessionID', sql.NVarChar, sessionId);
    request.input('Messages', sql.NVarChar, JSON.stringify(messages));
    await request.query(`
      IF EXISTS (SELECT 1 FROM ChatHistory WHERE SessionID = @SessionID)
        UPDATE ChatHistory
        SET Messages = @Messages, Timestamp = GETDATE()
        WHERE SessionID = @SessionID
      ELSE
        INSERT INTO ChatHistory (SessionID, Messages, Timestamp)
        VALUES (@SessionID, @Messages, GETDATE())
    `);
  } catch (error) {
    console.error('Error saving chat history:', error);
    throw error;
  } finally {
    if (pool) await pool.close();
  }
}

// 获取会话记录
export async function getChatHistory(sessionId: string) {
  let pool;
  try {
    pool = await sql.connect(config);
    const request = pool.request();
    request.input('SessionID', sql.NVarChar, sessionId);
    const result = await request.query('SELECT Messages FROM ChatHistory WHERE SessionID = @SessionID');
    return result.recordset.length > 0 ? JSON.parse(result.recordset[0].Messages) : [];
  } catch (error) {
    console.error('Error getting chat history:', error);
    throw error;
  } finally {
    if (pool) await pool.close();
  }
}