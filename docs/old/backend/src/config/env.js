import { config as loadDotenv } from 'dotenv';

const ENV_PATH = 'C:/Morlan_Python/Explorar/.env';
loadDotenv({ path: ENV_PATH });

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name} (esperada em ${ENV_PATH})`);
  }
  return value;
}

export const db2Config = {
  database: required('DB2_DATABASE'),
  hostname: required('DB2_HOST'),
  port: required('DB2_PORT'),
  uid: required('DB2_USER'),
  pwd: required('DB2_PASS'),
};

export const serverConfig = {
  port: Number(process.env.PORT) || 4000,
};
