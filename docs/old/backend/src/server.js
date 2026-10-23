import { createApp } from './app.js';
import { serverConfig } from './config/env.js';

const app = createApp();
app.listen(serverConfig.port, () => {
  console.log(`Portal de Governança - backend rodando em http://localhost:${serverConfig.port}`);
});
