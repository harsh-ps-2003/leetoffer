import { request } from "undici";
import { COMP_POSTS_DATA_QUERY, COMP_POST_CONTENT_DATA_QUERY } from "./queries";
import type { LeetCodePost } from "./types";

const LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql/";

async function fetchLeetCodeData(query: object) {
  const { body } = await request(LEETCODE_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(query),
  });
  return body.json();
}

async function getPostContent(postId: number): Promise<string> {
  const query = {
    ...COMP_POST_CONTENT_DATA_QUERY,
    variables: { topicId: postId },
  };
  const data: any = await fetchLeetCodeData(query);
  if (!data.data?.topic?.post?.content) {
    throw new Error(`Failed to fetch content for post_id=${postId}`);
  }
  return data.data.topic.post.content;
}

export async function* getLatestPosts(
  lastPostId?: string,
  maxPosts: number = 2000,
): AsyncGenerator<LeetCodePost> {
  let skip = 0;
  const first = 50;
  const MAX_POSTS = maxPosts;
  let totalFetched = 0;
  let foundLastPost = false;

  while (totalFetched < MAX_POSTS && !foundLastPost) {
    const query = {
      ...COMP_POSTS_DATA_QUERY,
      variables: {
        ...COMP_POSTS_DATA_QUERY.variables,
        skip,
        first,
      },
    };

    const data: any = await fetchLeetCodeData(query);
    const posts = data.data?.categoryTopicList?.edges;

    if (!posts || posts.length === 0) {
      console.log(
        `No more posts available at skip=${skip}. Total fetched: ${totalFetched}`,
      );
      break;
    }

    // Check if we've reached the end BEFORE removing pinned post
    const originalPostCount = posts.length;

    // Remove pinned post, which is the first one (only on first page)
    if (skip === 0 && posts && posts.length > 0) {
      posts.shift();
    }

    // Process posts
    let postsProcessed = 0;
    for (const post of posts) {
      if (totalFetched >= MAX_POSTS) {
        break;
      }

      // If we have a lastPostId, check if we've reached or passed it
      // Posts are fetched in descending order (newest first), so when we encounter
      // a post with ID <= lastPostId, we've reached posts we've already processed
      if (lastPostId) {
        const currentPostId = post.node.id;
        const lastPostIdNum = parseInt(lastPostId, 10);
        const currentPostIdNum = parseInt(currentPostId, 10);
        
        // If current post ID is less than or equal to lastPostId, we've caught up
        if (currentPostIdNum <= lastPostIdNum) {
          console.log(
            `Reached last known post ID: ${lastPostId} (current: ${currentPostId}). Stopping incremental fetch.`,
          );
          foundLastPost = true;
          break;
        }
      }

      try {
        const content = await getPostContent(parseInt(post.node.id, 10));
        yield {
          id: post.node.id,
          title: post.node.title,
          content: content,
          vote_count: post.node.post.voteCount,
          comment_count: post.node.commentCount,
          view_count: post.node.viewCount,
          creation_date: new Date(post.node.post.creationDate * 1000),
        };
        totalFetched++;
        postsProcessed++;
      } catch (error) {
        console.warn(`Skipping post ${post.node.id}:`, error);
        continue;
      }
    }

    // If we got fewer posts than requested (checking original count), we've reached the end
    // Also check if we processed fewer posts than available (might have hit MAX_POSTS)
    if (
      originalPostCount < first ||
      (postsProcessed === 0 && originalPostCount > 0)
    ) {
      console.log(
        `Reached end of posts at skip=${skip}. Original count: ${originalPostCount}, Processed: ${postsProcessed}, Total fetched: ${totalFetched}`,
      );
      break;
    }

    skip += first;

    // Add a small delay to avoid rate limiting
    if (skip % 200 === 0) {
      console.log(`Progress: Fetched ${totalFetched} posts so far...`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log(`Finished fetching posts. Total: ${totalFetched}`);
}
