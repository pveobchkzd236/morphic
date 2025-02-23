'use server'

import { type Chat } from '@/lib/types'
import sql from 'mssql'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// 获取环境变量
const getEnvVar = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Environment variable ${name} is missing`);
  return value;
};

// SQL Server 配置
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

// 获取用户的所有聊天记录
export async function getChats(userId?: string | null) {
  if (!userId) return [];

  let pool;
  try {
    pool = await sql.connect(config);
    const request = pool.request();
    request.input('UserID', sql.NVarChar, userId);
    const result = await request.query(`
      SELECT c.*
      FROM ChatHistory c
      INNER JOIN UserChats uc ON c.ChatID = uc.ChatID
      WHERE uc.UserID = @UserID
      ORDER BY uc.CreatedAt DESC
    `);

    return result.recordset.map(chat => ({
      id: chat.ChatID,
      messages: chat.Messages ? JSON.parse(chat.Messages) : [],
      createdAt: chat.CreatedAt,
      userId: chat.UserID,
      path: chat.Path,
      title: chat.Title,
      sharePath: chat.SharePath
    }));
  } catch (error) {
    console.error('Error getting chats:', error);
    return [];
  } finally {
    if (pool) await pool.close();
  }
}

// 获取单个聊天记录
export async function getChat(id: string, userId: string = 'anonymous') {
  let pool;
  try {
    pool = await sql.connect(config);
    const request = pool.request();
    request.input('ChatID', sql.NVarChar, id);
    const result = await request.query('SELECT * FROM ChatHistory WHERE ChatID = @ChatID');

    if (result.recordset.length === 0) return null;

    const chat = result.recordset[0];
    return {
      id: chat.ChatID,
      messages: chat.Messages ? JSON.parse(chat.Messages) : [],
      createdAt: chat.CreatedAt,
      userId: chat.UserID,
      path: chat.Path,
      title: chat.Title,
      sharePath: chat.SharePath
    };
  } catch (error) {
    console.error('Error getting chat:', error);
    return null;
  } finally {
    if (pool) await pool.close();
  }
}

// 清除用户的所有聊天记录
export async function clearChats(userId: string = 'anonymous'): Promise<{ error?: string }> {
  let pool;
  try {
    pool = await sql.connect(config);
    const request = pool.request();
    request.input('UserID', sql.NVarChar, userId);
    const result = await request.query(`
      DELETE FROM ChatHistory WHERE ChatID IN (SELECT ChatID FROM UserChats WHERE UserID = @UserID);
      DELETE FROM UserChats WHERE UserID = @UserID;
    `);
    await pool.close();
    if (result.rowsAffected[0] === 0) {
      return { error: 'No chats to clear' };
    }
    revalidatePath('/');
    redirect('/');
  } catch (error) {
    console.error('Error clearing chats:', error);
    return { error: 'Failed to clear chats' };
  } finally {
    if (pool) await pool.close();
  }
  throw new Error('Unexpected execution after redirect');
}

// 保存聊天记录
export async function saveChat(chat: Chat, userId: string = 'anonymous'): Promise<{ success: boolean }> {
  let pool;
  try {
    pool = await sql.connect(config);
    const finalUserId = chat.userId || userId;

    const request1 = pool.request();
    request1.input('ChatID', sql.NVarChar, chat.id);
    request1.input('Messages', sql.NVarChar, JSON.stringify(chat.messages));
    request1.input('CreatedAt', sql.DateTime, chat.createdAt);
    request1.input('UserID', sql.NVarChar, finalUserId);
    request1.input('Path', sql.NVarChar, chat.path);
    request1.input('Title', sql.NVarChar, chat.title);
    request1.input('SharePath', sql.NVarChar, chat.sharePath || null);
    console.log('Executing ChatHistory query');
    await request1.query(`
      IF EXISTS (SELECT 1 FROM ChatHistory WHERE ChatID = @ChatID)
        UPDATE ChatHistory
        SET Messages = @Messages, CreatedAt = @CreatedAt, UserID = @UserID, Path = @Path, Title = @Title, SharePath = @SharePath
        WHERE ChatID = @ChatID
      ELSE
        INSERT INTO ChatHistory (ChatID, Messages, CreatedAt, UserID, Path, Title, SharePath)
        VALUES (@ChatID, @Messages, @CreatedAt, @UserID, @Path, @Title, @SharePath)
    `);

    const request2 = pool.request();
    request2.input('UserID', sql.NVarChar, finalUserId);
    request2.input('ChatID', sql.NVarChar, chat.id);
    request2.input('CreatedAt', sql.DateTime, chat.createdAt);
    await request2.query(`
      IF NOT EXISTS (SELECT 1 FROM UserChats WHERE UserID = @UserID AND ChatID = @ChatID)
        INSERT INTO UserChats (UserID, ChatID, CreatedAt)
        VALUES (@UserID, @ChatID, @CreatedAt)
    `);

    await pool.close();
    return { success: true };
  } catch (error) {
    console.error('Error saving chat:', error);
    throw error;
  } finally {
    if (pool) await pool.close();
  }
}

// 获取共享聊天记录
export async function getSharedChat(id: string) {
  const chat = await getChat(id);
  if (!chat || !chat.sharePath) return null;
  return chat;
}

// 分享聊天记录
export async function shareChat(id: string, userId: string = 'anonymous') {
  let pool;
  try {
    pool = await sql.connect(config);
    const request = pool.request();
    request.input('ChatID', sql.NVarChar, id);
    request.input('UserID', sql.NVarChar, userId);
    const result = await request.query('SELECT * FROM ChatHistory WHERE ChatID = @ChatID AND UserID = @UserID');

    if (result.recordset.length === 0) return null;

    const chat = result.recordset[0];
    const payload = {
      id: chat.ChatID,
      messages: chat.Messages ? JSON.parse(chat.Messages) : [],
      createdAt: chat.CreatedAt,
      userId: chat.UserID,
      path: chat.Path,
      title: chat.Title,
      sharePath: `/share/${id}`
    };

    await request
      .input('SharePath', sql.NVarChar, payload.sharePath)
      .query('UPDATE ChatHistory SET SharePath = @SharePath WHERE ChatID = @ChatID');

    return payload;
  } catch (error) {
    console.error('Error sharing chat:', error);
    return null;
  } finally {
    if (pool) await pool.close();
  }
}