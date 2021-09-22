import { gql } from 'apollo-server-express';
import fetch from 'node-fetch';
import moment from 'moment';

const MINECRAFT_GAME_ID = '432';
const MODS_SECTION_ID = '6';

export const typeDefs = gql`
  ##
  ## Cache Control
  ##
  enum CacheControlScope {
    PUBLIC
    PRIVATE
  }

  directive @cacheControl(
    maxAge: Int
    scope: CacheControlScope
    inheritMaxAge: Boolean
  ) on FIELD_DEFINITION | OBJECT | INTERFACE | UNION

  ##
  ## Schema
  ##
  enum Category {
    ALL
    FABRIC
  }

  type Query @cacheControl {
    mod(id: String!): Mod!
    mods(ids: [String!]!): [Mod!]!
    findMods(
      searchTerm: String = ""
      category: Category = NONE
      gameVersion: String = ""
      page: Int = 1
      pageSize: Int = 10
    ): [Mod!]!
  }

  type Mod {
    id: ID!
    name: String!
    authors: [Author!]!
    thumbnail: Thumbnail
    externalLink: String!
    summary: String!
    downloadCount: Int!
    files: [File!]!
    latestFile(minecraftVersion: String = ""): File
    popularity: Float!
  }

  type Author {
    id: ID!
    name: String!
  }

  type Thumbnail {
    url: String!
    description: String!
  }

  type File {
    id: ID!
    name: String!
    date: String!
    url: String!
    minecraftVersions: [String!]!
  }
`;

export const resolvers = {
  Category: {
    ALL: '',
    FABRIC: '4780',
  },

  Query: {
    mod: (parent, args) =>
      fetch(`https://addons-ecs.forgesvc.net/api/v2/addon/${args.id}`).then(
        (response) => response.json()
      ),

    mods: (parent, args) =>
      fetch(`https://addons-ecs.forgesvc.net/api/v2/addon`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(args.ids),
      }).then((response) => response.json()),
    findMods: (
      parent,
      { searchTerm, category, gameVersion, page, pageSize }
    ) => {
      const index = (page - 1) * pageSize;

      const query = `gameId=${MINECRAFT_GAME_ID}&sectionId=${MODS_SECTION_ID}&searchFilter=${searchTerm.toLowerCase()}&categoryId=${category}&gameVersion=${gameVersion}&index=${index}&pageSize=${pageSize}`;

      return fetch(
        `https://addons-ecs.forgesvc.net/api/v2/addon/search?${query}`
      ).then((response) => response.json());
    },
  },

  Mod: {
    id: (parent) => parent.id,
    name: (parent) => parent.name,
    authors: (parent) => parent.authors,
    thumbnail: (parent) => {
      if (parent.attachments) {
        return (
          parent.attachments.find((attachment) => attachment.isDefault) ||
          attachments[0]
        );
      }

      return null;
    },
    externalLink: (parent) => parent.websiteUrl,
    summary: (parent) => parent.summary,
    downloadCount: (parent) => parseInt(parent.downloadCount),
    files: (parent) =>
      fetch(`https://addons-ecs.forgesvc.net/api/v2/addon/${parent.id}/files`)
        .then((response) => response.json())
        .then((files) => files.sort(fileByDate)),
    latestFile: async (parent, args) => {
      const files = await fetch(
        `https://addons-ecs.forgesvc.net/api/v2/addon/${parent.id}/files`
      ).then((response) => response.json());

      const sortedFiles = files.sort(fileByDate);

      return args.minecraftVersion
        ? sortedFiles.filter((file) =>
            file.gameVersion.includes(args.minecraftVersion)
          )[0]
        : sortedFiles[0];
    },
    popularity: (parent) => parent.popularityScore,
  },

  Author: {
    id: (parent) => parent.id,
    name: (parent) => parent.name,
  },

  Thumbnail: {
    url: (parent) => parent.thumbnailUrl,
    description: (parent) => parent.title,
  },

  File: {
    id: (parent) => parent.id,
    name: (parent) => parent.fileName.trim(),
    date: (parent) => toPosixTime(parent.fileDate),
    url: (parent) => parent.downloadUrl,
    minecraftVersions: (parent) => parent.gameVersion,
  },
};

function toPosixTime(timestamp) {
  return moment(timestamp).format('X');
}

function fileByDate({ fileDate: a }, { fileDate: b }) {
  const posixA = toPosixTime(a);
  const posixB = toPosixTime(b);

  if (posixA == posixB) {
    return 0;
  }

  return posixA < posixB ? 1 : -1;
}
