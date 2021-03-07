import { ArgsType, Field } from "type-graphql";

@ArgsType()
export class UserPasswordArgument {
  @Field()
  usernameOrEmail: string;

  @Field()
  password: string;
}
