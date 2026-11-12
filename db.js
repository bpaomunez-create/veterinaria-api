require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Este escudo evita que el servidor se apague de golpe y nos muestra el error
pool.on('error', (err) => {
  console.error('❌ ERROR CRÍTICO EN LA BASE DE DATOS:', err.message);
});

module.exports = pool;