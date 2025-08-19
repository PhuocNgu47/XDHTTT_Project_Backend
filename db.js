const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/fe_gr7';
const pool = new Pool({ connectionString });

async function initDb(){
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user'
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      price NUMERIC(12,2) NOT NULL DEFAULT 0,
      image TEXT,
      description TEXT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      total NUMERIC(12,2) NOT NULL DEFAULT 0
    );
  `);

  const { rows: userCountRows } = await pool.query('SELECT COUNT(*)::int AS count FROM users');
  if ((userCountRows[0]?.count ?? 0) === 0){
    const password = '123456';
    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO users (name,email,password,role) VALUES 
       ('Admin','admin@example.com',$1,'admin'),
       ('Staff','staff@example.com',$1,'staff'),
       ('User','user@example.com',$1,'user')`,
      [hashed]
    );
  }

  const { rows: productCountRows } = await pool.query('SELECT COUNT(*)::int AS count FROM products');
  if ((productCountRows[0]?.count ?? 0) === 0){
    await pool.query(
      `INSERT INTO products (name,price,image,description) VALUES 
       ('Laptop A',19990000,'/images/sample1.jpg','Core i5, 16GB RAM, 512GB SSD'),
       ('Laptop B',15990000,'/images/sample2.jpg','Ryzen 5, 8GB RAM, 512GB SSD')`
    );
  }

  const { rows: orderCountRows } = await pool.query('SELECT COUNT(*)::int AS count FROM orders');
  if ((orderCountRows[0]?.count ?? 0) === 0){
    await pool.query(
      `INSERT INTO orders (user_id,status,total) VALUES (1,'pending',35990000)`
    );
  }
}

function query(text, params){
  return pool.query(text, params);
}

module.exports = { pool, initDb, query };


