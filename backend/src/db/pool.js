import ibmdb from 'ibm_db';
import { db2Config } from '../config/env.js';

function buildConnectionString() {
  return (
    `DATABASE=${db2Config.database};` +
    `HOSTNAME=${db2Config.hostname};` +
    `PORT=${db2Config.port};` +
    'PROTOCOL=TCPIP;' +
    `UID=${db2Config.uid};` +
    `PWD=${db2Config.pwd};`
  );
}

function openConnection() {
  return new Promise((resolve, reject) => {
    ibmdb.open(buildConnectionString(), (err, conn) => {
      if (err) return reject(err);
      resolve(conn);
    });
  });
}

function closeConnection(conn) {
  return new Promise((resolve) => {
    conn.close(() => resolve());
  });
}

export async function query(sql, params = []) {
  // Defensive guard: reject non-SELECT/WITH statements before opening connection
  const trimmedSql = sql.trim();
  const upperSql = trimmedSql.toUpperCase();

  if (!upperSql.startsWith('SELECT') && !upperSql.startsWith('WITH')) {
    const firstWords = trimmedSql.split(/\s+/).slice(0, 3).join(' ');
    throw new Error(
      `Somente consultas SELECT são permitidas (query bloqueada por segurança de leitura): ${firstWords}`
    );
  }

  const conn = await openConnection();
  try {
    const rows = await new Promise((resolve, reject) => {
      conn.query(sql, params, (err, data) => {
        if (err) return reject(err);
        resolve(data);
      });
    });
    return rows;
  } finally {
    await closeConnection(conn);
  }
}
