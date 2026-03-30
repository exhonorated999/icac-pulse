import { Database as SqlJsDatabase } from 'sql.js';
import { saveDatabase } from './database';

/**
 * Wrapper for sql.js to provide better-sqlite3-like API
 */
export class DBWrapper {
  constructor(private db: SqlJsDatabase) {}

  prepare(sql: string) {
    return {
      run: (...params: any[]) => {
        console.log('DBWrapper.run called with sql:', sql, 'params:', params);
        try {
          // sql.js run() doesn't support parameterized queries
          // We need to use exec() with the params
          const result = this.db.exec(sql, params);
          console.log('DBWrapper.run: exec result:', result);
          
          // Save database to disk
          saveDatabase();
          console.log('DBWrapper.run: Database saved');
          
          // Get the last insert rowid
          const rowidResult = this.db.exec('SELECT last_insert_rowid() as id');
          console.log('DBWrapper.run: last_insert_rowid query result:', rowidResult);
          
          let lastInsertRowid = null;
          if (rowidResult.length > 0 && rowidResult[0].values.length > 0) {
            lastInsertRowid = rowidResult[0].values[0][0];
            console.log('DBWrapper.run: Extracted lastInsertRowid =', lastInsertRowid, 'type:', typeof lastInsertRowid);
          } else {
            console.warn('DBWrapper.run: No last_insert_rowid returned');
          }
          
          // Ensure it's a number, not 0
          if (lastInsertRowid === 0 || lastInsertRowid === null || lastInsertRowid === undefined) {
            console.error('DBWrapper.run: Invalid lastInsertRowid:', lastInsertRowid);
          }
          
          return { 
            lastInsertRowid: lastInsertRowid, 
            changes: result.length > 0 ? 1 : 0
          };
        } catch (error) {
          console.error('DBWrapper.run error:', error);
          throw error;
        }
      },
      get: (...params: any[]) => {
        console.log('DBWrapper.get called with sql:', sql, 'params:', params);
        try {
          const result = this.db.exec(sql, params);
          console.log('DBWrapper.get exec result:', result);
          
          if (!result.length || !result[0].values.length) {
            console.log('DBWrapper.get: No results found');
            return undefined;
          }
          const columns = result[0].columns;
          const row = result[0].values[0];
          const obj: any = {};
          columns.forEach((col, idx) => {
            obj[col] = row[idx];
          });
          console.log('DBWrapper.get: Returning object:', obj);
          return obj;
        } catch (error) {
          console.error('DBWrapper.get error:', error);
          throw error;
        }
      },
      all: (...params: any[]) => {
        const results: any[] = [];
        const result = this.db.exec(sql, params);
        if (result.length > 0) {
          const columns = result[0].columns;
          result[0].values.forEach(row => {
            const obj: any = {};
            columns.forEach((col, idx) => {
              obj[col] = row[idx];
            });
            results.push(obj);
          });
        }
        return results;
      }
    };
  }

  run(sql: string, params?: any[]) {
    console.log('DBWrapper.run (direct) called with sql:', sql, 'params:', params);
    this.db.exec(sql, params || []);
    saveDatabase();
    console.log('DBWrapper.run (direct): Database saved');
  }

  exec(sql: string) {
    return this.db.exec(sql);
  }
}
