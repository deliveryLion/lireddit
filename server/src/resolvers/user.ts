import argon2 from "argon2";
import {
  Arg,
  Args,
  Ctx,
  FieldResolver,
  Mutation,
  Query,
  Resolver,
  Root,
} from "type-graphql";
import { getConnection } from "typeorm";
import { v4 } from "uuid";
import {
  COOKIE_NAME,
  FORGOT_PASSWORD_PREFIX,
  MONGO_DB_NAME,
  MONGO_DB_PASSWORD_COLLECTION,
} from "../constant";
import { User } from "../entities/User";
import { MyContext } from "../types";
import { sendEmail } from "../utils/sendEmail";
import { UsernamePasswordInput } from "./UsernamePasswordInput";
import { UserPasswordArgument } from "./UserPasswordArgument";
import { UserResponse } from "./UserResponse";

@Resolver(User)
export class UserResolver {
  @Mutation(() => UserResponse)
  async changePassword(
    @Arg("token") token: string,
    @Arg("newPassword") newPassword: string,
    @Ctx() { mongoClient, req }: MyContext,
  ): Promise<UserResponse> {
    if (newPassword.length <= 2) {
      return {
        errors: [
          {
            field: "password",
            message: "length must be greater than 2",
          },
        ],
      };
    }

    const key = FORGOT_PASSWORD_PREFIX + token;
    const { _id: userId } = await mongoClient
      .db(MONGO_DB_NAME)
      .collection(MONGO_DB_PASSWORD_COLLECTION)
      .findOne({ token: key });

    if (!userId) {
      return {
        errors: [
          {
            field: "token",
            message: "token expired",
          },
        ],
      };
    }

    const userIdNumber = parseInt(userId);
    const user = await User.findOne(userIdNumber);
    if (!user) {
      return {
        errors: [
          {
            field: "token",
            message: "user no longer exists",
          },
        ],
      };
    }

    await User.update(
      { id: userIdNumber },
      {
        password: await argon2.hash(newPassword),
      },
    );

    await mongoClient
      .db(MONGO_DB_NAME)
      .collection(MONGO_DB_PASSWORD_COLLECTION)
      .deleteOne({
        token: key,
      });

    req.session.userId = user.id;

    return { user };
  }

  @Mutation(() => Boolean)
  async forgotPassword(
    @Arg("email") email: string,
    @Ctx() { mongoClient }: MyContext,
  ) {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      // the email is not in the db.
      return true;
    }
    const token = v4();

    await mongoClient
      .db(MONGO_DB_NAME)
      .collection(MONGO_DB_PASSWORD_COLLECTION)
      .replaceOne(
        {
          // filter
          _id: user.id,
        },
        {
          // replacement document
          _id: user.id,
          token: FORGOT_PASSWORD_PREFIX + token,
        },
        {
          // replace or create
          upsert: true,
        },
      );

    await sendEmail(
      email,
      `<a href="http://localhost:3000/change-password/${token}">reset password</a>`,
    );
    return true;
  }

  @Query(() => User, { nullable: true })
  async me(@Ctx() { req }: MyContext) {
    if (!req.session.userId) {
      return null;
    }
    return User.findOne(req.session.userId);
  }

  @FieldResolver(() => String, { nullable: true })
  async email(@Root() user: User, @Ctx() { req }: MyContext) {
    if (req.session.userId === user.id) {
      return user.email;
    }
    return "";
  }

  @Mutation(() => UserResponse)
  async register(
    @Arg("options") options: UsernamePasswordInput,
    @Ctx() { req }: MyContext,
  ): Promise<UserResponse> {
    if (options.username.length <= 2) {
      return {
        errors: [
          {
            field: "username",
            message: "length must be greater than 2",
          },
        ],
      };
    }

    if (options.password.length <= 2) {
      return {
        errors: [
          {
            field: "password",
            message: "length must be greater than 2",
          },
        ],
      };
    }
    const hashedPassword = await argon2.hash(options.password);
    let user;
    try {
      const result = await getConnection()
        .createQueryBuilder()
        .insert()
        .into(User)
        .values({
          username: options.username,
          email: options.email,
          password: hashedPassword,
        })
        .returning("*")
        .execute();
      user = result.raw[0];
    } catch (err) {
      if (err.code === "23505") {
        const usedEmail = err.detail.includes("email");
        let errors;
        if (usedEmail) {
          errors = [
            {
              field: "email",
              message:
                "email already used, navigate to forgot password",
            },
          ];
        } else {
          errors = [
            {
              field: "username",
              message: "username already taken",
            },
          ];
        }
        return { errors };
      }
    }

    // set cookie
    req.session.userId = user.id;

    return {
      user,
    };
  }

  @Mutation(() => UserResponse)
  async login(
    @Args() { usernameOrEmail, password }: UserPasswordArgument,
    @Ctx() { req }: MyContext,
  ): Promise<UserResponse> {
    // Lookup the user by username
    const user = await User.findOne(
      usernameOrEmail.includes("@")
        ? {
            where: { email: usernameOrEmail },
          }
        : { where: { username: usernameOrEmail } },
    );
    if (!user) {
      return {
        errors: [
          {
            field: "usernameOrEmail",
            message: "that username or email doesn't exist",
          },
        ],
      };
    }

    // verify password
    const valid = await argon2.verify(user.password, password);
    if (!valid) {
      return {
        errors: [
          {
            field: "password",
            message: "incorrect password",
          },
        ],
      };
    }

    // set cookie
    req.session.userId = user.id;

    // Return user without errors
    return {
      user,
    };
  }

  @Mutation(() => Boolean)
  logout(@Ctx() { req, res }: MyContext) {
    return new Promise((resolve) =>
      req.session.destroy((err) => {
        res.clearCookie(COOKIE_NAME);
        if (err) {
          console.log(err);
          resolve(false);
          return;
        }
        resolve(true);
      }),
    );
  }
}
