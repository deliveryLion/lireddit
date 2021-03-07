import { ArgsType, Field } from "type-graphql";

@ArgsType()
export class CreatePostArgument {
  @Field()
  title: string;

  @Field({ nullable: true })
  body: string;
}
