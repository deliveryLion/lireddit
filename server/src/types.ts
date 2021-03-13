import { Request, Response } from "express";
import { MongoClient } from "mongodb";

declare global {
  namespace Express {
    interface Session {
      userId?: number;
    }
  }
}

export type MyContext = {
  req: Request & { session: Express.Session };
  res: Response;
  mongoClient: MongoClient;
};
