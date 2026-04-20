import { inject } from 'tsyringe';
import { DatabaseConnection } from '../../db/connection.js';

export abstract class BaseRepository {
  constructor(
    @inject(DatabaseConnection) protected readonly dbConnection: DatabaseConnection
  ) {}

  protected get db() {
    return this.dbConnection.getDb();
  }

  protected transaction<T>(fn: () => T): T {
    return this.dbConnection.transaction(fn);
  }
}
