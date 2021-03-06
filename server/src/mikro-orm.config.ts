import { __prod__ } from './constant';
import { Post } from './entities/Post';
import { User } from './entities/User';
import { MikroORM } from '@mikro-orm/core';
import path from 'path';

export default {
  migrations: {
    tableName: 'mikro_orm_migrations', // name of database table with log of executed transactions
    path: path.join(__dirname, './migrations'), // path to the folder with migrations
    pattern: /^[\w-]+\d+\.[tj]s$/, // regex pattern for the migration files
  },
  entities: [Post, User],
  dbName: 'lireddit',
  debug: !__prod__,
  type: 'postgresql',
  user: 'postgres',
  password: 'postgres',
} as Parameters<typeof MikroORM.init>[0];
