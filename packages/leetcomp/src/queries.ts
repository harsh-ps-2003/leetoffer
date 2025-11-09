export const COMP_POSTS_DATA_QUERY = {
  query: `
    query communityCategoryTopicList($categories: [String!], $skip: Int!, $first: Int!, $orderBy: TopicSortingOption, $query: String, $tags: [String!]) {
      categoryTopicList(categories: $categories, skip: $skip, first: $first, orderBy: $orderBy, query: $query, tags: $tags) {
        ...TopicsList
      }
    }

    fragment TopicsList on TopicConnection {
      edges {
        node {
          id
          title
          post {
            id
            voteCount
            creationDate
          }
          commentCount
          viewCount
        }
      }
    }
  `,
  variables: {
    categories: ["compensation"],
    skip: 0,
    first: 50,
    orderBy: "newest_to_oldest",
    query: "",
    tags: [],
  },
  operationName: "communityCategoryTopicList",
};

export const COMP_POST_CONTENT_DATA_QUERY = {
  query: `
    query discussionTopic($topicId: Int!) {
      topic(id: $topicId) {
        id
        title
        post {
          ...DiscussPost
        }
      }
    }

    fragment DiscussPost on PostNode {
      content
    }
  `,
  variables: {
    topicId: 0,
  },
  operationName: "discussionTopic",
};
