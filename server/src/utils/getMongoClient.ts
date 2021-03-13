import { MongoClient } from "mongodb";
import { MONGO_DB_URI } from "../constant";

export const getMongoClient = async (): Promise<MongoClient> => {
  const client = new MongoClient(MONGO_DB_URI, {
    useUnifiedTopology: true,
  });
  await client.connect();
  // const databasesList = await client.db().admin().listDatabases();
  // databasesList.databases.forEach((db: any) =>
  //   console.log(`- ${db.name}`),
  // );
  return client;
};
