import { withUrqlClient } from "next-urql";
import React from "react";
import { NavBar } from "../components/NavBar";
import { usePostsQuery } from "../generated/graphql";
import { createUrqlClient } from "../utils/createUrqlClient";

const Index = () => {
  const [{ data }] = usePostsQuery();
  return (
    <>
      <NavBar />
      <div>Hello, world</div>
      <br />
      {!data
        ? null
        : data.posts.map((p) => (
            <div key={p.id}>
              <b>{p.id} </b>
              {p.title}
            </div>
          ))}
    </>
  );
};

export default withUrqlClient(createUrqlClient, { ssr: true })(Index);
