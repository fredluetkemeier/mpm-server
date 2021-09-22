import express from 'express';
import cors from 'cors';
import { ApolloServer } from 'apollo-server-express';
import { typeDefs, resolvers } from './schema.js';

const PORT = 4000;

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

await server.start();

const app = express();
app.use(cors());
server.applyMiddleware({
  app,
  cors: {
    origin: '*',
  },
});

app.listen({ port: PORT }, () =>
  console.log(`Server ready at http://localhost:${PORT}${server.graphqlPath}`)
);
