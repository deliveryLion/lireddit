import { ApolloServer } from "apollo-server-express";
import connectMongo from "connect-mongo";
import cors from "cors";
import express from "express";
import session from "express-session";
import "reflect-metadata";
import { buildSchema } from "type-graphql";
import { createConnection } from "typeorm";
import { COOKIE_NAME, FOO_COOKIE_SECRET, __prod__ } from "./constant";
import { Post } from "./entities/Post";
import { User } from "./entities/User";
import { HelloResolver } from "./resolvers/hello";
import { PostResolver } from "./resolvers/posts";
import { UserResolver } from "./resolvers/user";

const main = async () => {
  const conn = await createConnection({
    type: "postgres",
    database: "liredditDB",
    username: "postgres",
    password: "postgres",
    logging: true,
    synchronize: true, // create tables automatically
    entities: [User, Post],
  });

  await conn.runMigrations();
  // express
  const app = express();
  // session middleware will run before the apollo middleware
  app.use(
    cors({
      origin: "http://localhost:3000",
      credentials: true,
    }),
  );
  app.use(
    session({
      store: connectMongo.create({
        mongoUrl: "mongodb://localhost:27017/local",
      }),
      secret: FOO_COOKIE_SECRET,
      name: COOKIE_NAME,
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 10 * 365 * 24 * 60 * 60 * 1000, // 10 years
        httpOnly: true,
        sameSite: "lax", // csrf
        secure: __prod__, // cookie only works in https
      },
    }),
  );

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [HelloResolver, PostResolver, UserResolver],
      validate: false,
    }),
    context: ({ req, res }) => ({
      req,
      res,
    }),
  });

  apolloServer.applyMiddleware({
    app,
    cors: false,
  });

  app.listen(4000, () => {
    console.log("server started on localhost:4000");
  });
};

main().catch((err) => {
  console.error(err);
});
