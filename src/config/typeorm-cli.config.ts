import 'dotenv/config';
import { DataSource } from 'typeorm';
import { createDatabaseOptions } from './database.config';

export default new DataSource(createDatabaseOptions('development-cli'));
