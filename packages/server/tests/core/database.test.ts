import "reflect-metadata";
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseConnection } from '../../src/core/database/connection.js';
import { BaseRepository } from '../../src/core/database/base.repository.js';
import { resetConfig } from '../../src/core/config.js';
import path from 'path';
import fs from 'fs';

const TEST_DB_PATH = path.join(process.cwd(), 'test-db-phase1.db');

describe('DatabaseConnection', () => {
  let db: DatabaseConnection;

  beforeEach(() => {
    resetConfig();
    process.env.DB_PATH = TEST_DB_PATH;
    process.env.JWT_SECRET = 'test-secret-key-must-be-32-characters!';
    db = new DatabaseConnection(TEST_DB_PATH);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    if (fs.existsSync(`${TEST_DB_PATH}-wal`)) {
      fs.unlinkSync(`${TEST_DB_PATH}-wal`);
    }
    if (fs.existsSync(`${TEST_DB_PATH}-shm`)) {
      fs.unlinkSync(`${TEST_DB_PATH}-shm`);
    }
  });

  it('should create database connection', () => {
    expect(db).toBeDefined();
    expect(db.getDb()).toBeDefined();
  });

  it('should support transactions', () => {
    const sqlite = db.getSqlite();
    sqlite.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');

    db.transaction(() => {
      sqlite.exec("INSERT INTO test (name) VALUES ('test1')");
      sqlite.exec("INSERT INTO test (name) VALUES ('test2')");
    });

    const result = sqlite.prepare('SELECT * FROM test').all();
    expect(result).toHaveLength(2);
  });

  it('should rollback on error in transaction', () => {
    const sqlite = db.getSqlite();
    sqlite.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');

    try {
      db.transaction(() => {
        sqlite.exec("INSERT INTO test (name) VALUES ('test1')");
        throw new Error('rollback test');
      });
    } catch (e) {
      // expected
    }

    const result = sqlite.prepare('SELECT * FROM test').all();
    expect(result).toHaveLength(0);
  });
});

describe('BaseRepository', () => {
  let db: DatabaseConnection;

  beforeEach(() => {
    resetConfig();
    process.env.DB_PATH = TEST_DB_PATH;
    process.env.JWT_SECRET = 'test-secret-key-must-be-32-characters!';
    db = new DatabaseConnection(TEST_DB_PATH);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  it('should provide access to query builder', () => {
    class TestRepo extends BaseRepository {
      test() {
        return this.db;
      }
    }

    const repo = new TestRepo(db);
    expect(repo.test()).toBeDefined();
  });
});
