const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const argon2 = require('argon2');

async function setup() {
  // First connect to default postgres db to create pastoral_care
  const rootClient = new Client({
    user: 'postgres',
    password: 'root',
    host: 'localhost',
    port: 5432,
    database: 'postgres'
  });

  try {
    await rootClient.connect();
    console.log('Connected to root database.');
    
    // Check if db exists
    const res = await rootClient.query(`SELECT datname FROM pg_database WHERE datname = 'pastoral_care'`);
    if (res.rows.length === 0) {
      console.log('Creating database pastoral_care...');
      await rootClient.query('CREATE DATABASE pastoral_care');
    } else {
      console.log('Database pastoral_care already exists.');
    }
  } catch (err) {
    console.error('Failed to create database:', err);
  } finally {
    await rootClient.end();
  }

  // Now connect to pastoral_care to run schema
  const dbClient = new Client({
    user: 'postgres',
    password: 'root',
    host: 'localhost',
    port: 5432,
    database: 'pastoral_care'
  });

  try {
    await dbClient.connect();
    console.log('Connected to pastoral_care database.');
    
    await dbClient.query('CREATE EXTENSION IF NOT EXISTS citext;');
    
    // Read and execute schema.sql
    const schemaSql = fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8');
    await dbClient.query(schemaSql);
    console.log('Schema executed successfully.');

    // Seed dummy users and members
    const hashedPassword = await argon2.hash('password123');
    
    await dbClient.query(`
      INSERT INTO users (email, password_hash, full_name, role)
      VALUES ('pastor@test.com', $1, 'Pastor Test', 'pastor')
      ON CONFLICT (email) DO NOTHING
    `, [hashedPassword]);
    
    console.log('Added dummy user (pastor@test.com / password123).');

    // Add some members
    await dbClient.query(`
      INSERT INTO members (full_name, membership_status, priority_score)
      VALUES 
        ('John Doe', 'active', 15),
        ('Jane Smith', 'active', 5),
        ('Alice Johnson', 'visitor', 0)
    `);
    
    console.log('Added dummy members.');

  } catch (err) {
    console.error('Failed to setup schema or data:', err);
  } finally {
    await dbClient.end();
  }
}

setup();
