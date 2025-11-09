// Main entry point for the leetcomp package.
// This file will export the core functions for fetching and parsing LeetCode compensation data.

// Load environment variables from project root
import { config } from "dotenv";
import { resolve } from "path";
import { existsSync } from "fs";

// Try to find .env file in multiple possible locations
const possiblePaths = [
  resolve(process.cwd(), ".env"), // If running from root
  resolve(process.cwd(), "../../.env"), // If running from packages/leetcomp
  resolve(process.cwd(), "../.env"), // If running from packages/leetcomp/dist
];

let envPath: string | undefined;
for (const path of possiblePaths) {
  if (existsSync(path)) {
    envPath = path;
    break;
  }
}

if (envPath) {
  config({ path: envPath });
  console.log(`Loaded .env from: ${envPath}`);
} else {
  console.warn("Warning: .env file not found. Trying default locations...");
  config(); // Try default .env in current directory
}

import { getLatestPosts } from "./refresh";
import { parsePost } from "./parse";
import { writeFile, readFile } from "fs/promises";
import { join } from "path";

interface ParsedOffer {
  company: string | null;
  role: string | null;
  yoe: number | null;
  base_offer: number | null;
  total_offer: number | null;
  location: string | null;
  visa_sponsorship: "yes" | "no" | null;
  post_id?: string; // Track which post this offer came from
  post_title?: string; // Track post title for debugging
  post_date?: string; // ISO date string of when the post was created
  post_timestamp?: number; // Unix timestamp for sorting/filtering
}

function getOutputPaths() {
  const cwd = process.cwd();
  let outputPath: string;
  let metadataPath: string;

  if (cwd.endsWith("apps/app")) {
    outputPath = join(cwd, "public", "parsed_comps.json");
    metadataPath = join(cwd, "public", ".leetcomp_metadata.json");
  } else {
    outputPath = join(cwd, "apps", "app", "public", "parsed_comps.json");
    metadataPath = join(
      cwd,
      "apps",
      "app",
      "public",
      ".leetcomp_metadata.json",
    );
  }

  return { outputPath, metadataPath };
}

async function loadExistingData(): Promise<{
  offers: ParsedOffer[];
  lastPostId: string | undefined;
  lastFetchTime: number | undefined;
}> {
  const { outputPath, metadataPath } = getOutputPaths();

  let existingOffers: ParsedOffer[] = [];
  let lastPostId: string | undefined;
  let lastFetchTime: number | undefined;

  // Load existing offers
  if (existsSync(outputPath)) {
    try {
      const fileContents = await readFile(outputPath, "utf-8");
      existingOffers = JSON.parse(fileContents);
      console.log(`Loaded ${existingOffers.length} existing offers`);
    } catch (error) {
      console.warn("Failed to load existing offers, starting fresh:", error);
    }
  }

  // Load metadata (last post ID and fetch time)
  if (existsSync(metadataPath)) {
    try {
      const metadataContents = await readFile(metadataPath, "utf-8");
      const metadata = JSON.parse(metadataContents);
      lastPostId = metadata.lastPostId;
      lastFetchTime = metadata.lastFetchTime;
      console.log(`Incremental mode: Last post ID was ${lastPostId}`);
    } catch (error) {
      console.warn("Failed to load metadata, will do full fetch:", error);
    }
  }

  return { offers: existingOffers, lastPostId, lastFetchTime };
}

export async function run(): Promise<{
  processed: number;
  successful: number;
  totalOffers: number;
  newOffers: number;
  outputPath: string;
}> {
  console.log("Fetching and parsing LeetCode compensation posts...");

  // Load existing data for incremental updates
  const {
    offers: existingOffers,
    lastPostId,
    lastFetchTime,
  } = await loadExistingData();
  const isIncremental = !!lastPostId;

  if (isIncremental) {
    console.log(
      `🔄 Incremental update mode: Fetching new posts since last run`,
    );
  } else {
    console.log(`🆕 Full fetch mode: Fetching all posts`);
  }

  const newParsedOffers: ParsedOffer[] = [];
  let processedCount = 0;
  let successCount = 0;
  let lastFetchedPostId: string | undefined;
  let apiCallCount = 0;
  const MAX_DAILY_API_CALLS = 240; // Leave some buffer below the 250 limit

  // Fetch new posts (will stop when it reaches lastPostId if in incremental mode)
  try {
    for await (const post of getLatestPosts(
      lastPostId,
      isIncremental ? 500 : 2000,
    )) {
      // Check quota before making API call
      if (apiCallCount >= MAX_DAILY_API_CALLS) {
        console.warn(
          `\n⚠️  Approaching daily API limit (${apiCallCount}/${MAX_DAILY_API_CALLS}). Stopping to avoid quota errors.`,
        );
        console.warn(
          `   Processed ${processedCount} posts, found ${successCount} with valid offers.`,
        );
        console.warn(`   Remaining posts will be processed in the next run.\n`);
        break;
      }

      processedCount++;
      lastFetchedPostId = post.id;
      console.log(`[${processedCount}] Parsing "${post.title}"`);

      if (post.vote_count < 0) {
        console.log(`  ⚠️  Skipping due to negative votes.`);
        continue;
      }

      // Add delay between API calls to avoid rate limiting (1 second delay)
      if (apiCallCount > 0 && apiCallCount % 10 === 0) {
        console.log(
          `  ⏳ Rate limiting: Waiting 2s... (${apiCallCount} API calls made)`,
        );
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } else if (apiCallCount > 0) {
        // Small delay between each call
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      try {
        apiCallCount++;
        const parsedOffers = await parsePost(post);
        if (parsedOffers && parsedOffers.length > 0) {
          successCount++;
          // Add post metadata to each offer
          const postDate = post.creation_date.toISOString().split("T")[0]; // YYYY-MM-DD format
          const postTimestamp = post.creation_date.getTime();
          const offersWithMetadata: ParsedOffer[] = parsedOffers.map(
            (offer) => ({
              company: offer.company ?? null,
              role: offer.role ?? null,
              yoe: offer.yoe ?? null,
              base_offer: offer.base_offer ?? null,
              total_offer: offer.total_offer ?? null,
              location: offer.location ?? null,
              visa_sponsorship: offer.visa_sponsorship ?? null,
              post_id: post.id,
              post_title: post.title,
              post_date: postDate,
              post_timestamp: postTimestamp,
            }),
          );
          newParsedOffers.push(...offersWithMetadata);
          console.log(`  ✅ Found ${parsedOffers.length} offer(s)`);
        } else {
          console.log(`  ℹ️  No valid offers found`);
        }
      } catch (error: any) {
        // Handle quota exceeded error
        if (error.message === "QUOTA_EXCEEDED") {
          console.warn(`\n⚠️  Daily quota exceeded. Stopping processing.`);
          console.warn(
            `   Processed ${processedCount} posts, found ${successCount} with valid offers.`,
          );
          console.warn(`   Remaining posts will be processed tomorrow.\n`);
          break;
        }
        // For other errors, continue processing
        console.warn(`  ⚠️  Error processing post, continuing...`);
      }
    }
  } catch (error: any) {
    if (error.message === "QUOTA_EXCEEDED") {
      console.warn(`\n⚠️  Quota exceeded during processing.`);
    } else {
      throw error;
    }
  }

  // Merge new offers with existing ones
  // Create a Set of existing offer keys to avoid duplicates
  const existingOfferKeys = new Set(
    existingOffers.map(
      (offer) =>
        `${offer.company}-${offer.role}-${offer.total_offer}-${offer.post_id}`,
    ),
  );

  // Filter out duplicates from new offers
  const uniqueNewOffers = newParsedOffers.filter((offer) => {
    const key = `${offer.company}-${offer.role}-${offer.total_offer}-${offer.post_id}`;
    return !existingOfferKeys.has(key);
  });

  const allOffers = [...existingOffers, ...uniqueNewOffers];

  const { outputPath, metadataPath } = getOutputPaths();

  // Ensure the directory exists
  const outputDir = join(outputPath, "..");
  if (!existsSync(outputDir)) {
    throw new Error(`Output directory does not exist: ${outputDir}`);
  }

  // Save offers
  await writeFile(outputPath, JSON.stringify(allOffers, null, 2));

  // Save metadata (last post ID and fetch time)
  if (lastFetchedPostId) {
    await writeFile(
      metadataPath,
      JSON.stringify(
        {
          lastPostId: lastFetchedPostId,
          lastFetchTime: Date.now(),
          totalOffers: allOffers.length,
        },
        null,
        2,
      ),
    );
  }

  console.log(`\n✅ Done!`);
  console.log(`   Processed: ${processedCount} new posts`);
  console.log(`   Successful: ${successCount} posts with valid data`);
  console.log(`   New offers: ${uniqueNewOffers.length}`);
  console.log(
    `   Total offers: ${allOffers.length} (${existingOffers.length} existing + ${uniqueNewOffers.length} new)`,
  );
  console.log(`   Data saved to: ${outputPath}`);

  return {
    processed: processedCount,
    successful: successCount,
    totalOffers: allOffers.length,
    newOffers: uniqueNewOffers.length,
    outputPath,
  };
}

// Only run if called directly (not when imported as a module)
if (typeof require !== "undefined" && require.main === module) {
  run();
}
