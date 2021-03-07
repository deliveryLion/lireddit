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
import { COOKIE_NAME } from "../constant";
import { User } from "../entities/User";
import { MyContext } from "../types";
import { UsernamePasswordInput } from "./UsernamePasswordInput";
import { UserPasswordArgument } from "./UserPasswordArgument";
import { UserResponse } from "./UserResponse";

@Resolver(User)
export class UserResolver {
  @Mutation(() => Boolean)
  async forgotPassword(@Arg("email") email: string) {
    const user = User.findOne({ where: { email } });
    // todo: complete this later
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
