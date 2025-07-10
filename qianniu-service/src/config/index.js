require('dotenv').config();

module.exports = {
  port: process.env.PORT || 8080,
  wsPort: process.env.WS_PORT || 8081,
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV !== 'production',
}; 