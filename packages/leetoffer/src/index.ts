// Main entry point for the leetoffer package.
// This file will export the core functions for fetching and parsing LeetCode compensation data.

// Load environment variables from project root
import { config } from "dotenv";
import { resolve } from "path";
import { existsSync } from "fs";

// Try to find .env file in multiple possible locations
const possiblePaths = [
  resolve(process.cwd(), ".env"), // If running from root
  resolve(process.cwd(), "../../.env"), // If running from packages/leetoffer
  resolve(process.cwd(), "../.env"), // If running from packages/leetoffer/dist
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
import { writeFile, readFile, mkdir } from "fs/promises";
import { join, dirname } from "path";

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

  // In Vercel, use /tmp (writable) instead of public folder (read-only)
  const isVercel = !!process.env.VERCEL;

  if (isVercel) {
    outputPath = "/tmp/parsed_comps.json";
    metadataPath = "/tmp/.leetoffer_metadata.json";
  } else if (cwd.endsWith("apps/app")) {
    outputPath = join(cwd, "public", "parsed_comps.json");
    metadataPath = join(cwd, "public", ".leetoffer_metadata.json");
  } else if (cwd.includes("packages/leetoffer")) {
    // Running from packages/leetoffer - go up to root, then into apps/app/public
    outputPath = join(cwd, "..", "..", "apps", "app", "public", "parsed_comps.json");
    metadataPath = join(cwd, "..", "..", "apps", "app", "public", ".leetoffer_metadata.json");
  } else {
    // Running from root or other location
    outputPath = join(cwd, "apps", "app", "public", "parsed_comps.json");
    metadataPath = join(
      cwd,
      "apps",
      "app",
      "public",
      ".leetoffer_metadata.json",
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

  // Load from local file first (committed file)
  if (existsSync(outputPath)) {
    try {
      const fileContents = await readFile(outputPath, "utf-8");
      existingOffers = JSON.parse(fileContents);
      console.log(`Loaded ${existingOffers.length} existing offers from local file`);
    } catch (error) {
      console.warn("Failed to load existing offers from local file:", error);
    }
  }

  // Fallback to Gist if local file is empty or doesn't exist
  if (existingOffers.length === 0 && process.env.GIST_ID) {
    try {
      // Try API first (works for both public and private with token)
      const headers: HeadersInit = {
        Accept: "application/vnd.github.v3+json",
      };
      
      // Add auth if token is provided (for private gists)
      if (process.env.GITHUB_TOKEN) {
        headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
      }

      const response = await fetch(
        `https://api.github.com/gists/${process.env.GIST_ID}`,
        { headers },
      );

      if (response.ok) {
        const gist = await response.json();
        const file = gist.files["parsed_comps.json"];
        if (file) {
          existingOffers = JSON.parse(file.content);
          console.log(`Loaded ${existingOffers.length} existing offers from Gist`);
        }

        // Try to load metadata from Gist too
        const metadataFile = gist.files[".leetoffer_metadata.json"];
        if (metadataFile) {
          const metadata = JSON.parse(metadataFile.content);
          lastPostId = metadata.lastPostId;
          lastFetchTime = metadata.lastFetchTime;
          console.log(`Incremental mode: Last post ID was ${lastPostId}`);
        }
      } else {
        console.warn(`Failed to load from Gist API: ${response.status}`);
      }
    } catch (error) {
      console.warn("Failed to load from Gist:", error);
    }
  }

  // Load metadata from local file if not already loaded from Gist
  if (!lastPostId && existsSync(metadataPath)) {
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

// Helper function to save data (extracted for reuse)
async function saveData(
  allOffers: ParsedOffer[],
  outputPath: string,
  metadataPath: string,
  lastFetchedPostId: string | undefined,
): Promise<void> {
  // Save data - always try to save even if there were errors
  try {
    // Ensure the directory exists (skip check for /tmp in Vercel)
    if (!outputPath.startsWith("/tmp")) {
      const outputDir = dirname(outputPath);
      if (!existsSync(outputDir)) {
        console.log(`Creating directory: ${outputDir}`);
        await mkdir(outputDir, { recursive: true });
      }
    }

    // Save offers to local file
    await writeFile(outputPath, JSON.stringify(allOffers, null, 2));
    console.log(`✅ Saved ${allOffers.length} offers to ${outputPath}`);
  } catch (saveError) {
    console.error(`❌ Failed to save to ${outputPath}:`, saveError);
    // Still try to save to Gist as backup
  }

  // Also save to Gist if configured
  if (process.env.GIST_ID && process.env.GITHUB_TOKEN) {
    try {
      console.log(`Saving ${allOffers.length} offers to Gist ${process.env.GIST_ID}...`);
      
      // First, verify we can read the Gist (to check if it exists and we have access)
      console.log(`Verifying Gist access for ID: ${process.env.GIST_ID}`);
      const readResponse = await fetch(`https://api.github.com/gists/${process.env.GIST_ID}`, {
        headers: {
          Authorization: `token ${process.env.GITHUB_TOKEN}`,
          Accept: "application/vnd.github.v3+json",
        },
      });
      
      if (!readResponse.ok) {
        const readError = await readResponse.text();
        let errorMsg = `Cannot access Gist (read failed): ${readResponse.status}`;
        try {
          const errorJson = JSON.parse(readError);
          errorMsg += ` - ${errorJson.message || readError}`;
        } catch {
          errorMsg += ` - ${readError}`;
        }
        errorMsg += `\nPlease verify:\n1. Gist ID is correct: ${process.env.GIST_ID}\n2. Token has 'gist' scope enabled\n3. Token belongs to the Gist owner (harsh-ps-2003)`;
        throw new Error(errorMsg);
      }
      
      const gistData = await readResponse.json();
      const gistOwner = gistData.owner?.login || 'unknown';
      console.log(`✅ Gist accessible. Owner: ${gistOwner}, Public: ${gistData.public}`);
      
      // Verify token belongs to the Gist owner
      const userResponse = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `token ${process.env.GITHUB_TOKEN}`,
          Accept: "application/vnd.github.v3+json",
        },
      });
      
      if (userResponse.ok) {
        const userData = await userResponse.json();
        const tokenOwner = userData.login;
        console.log(`Token belongs to: ${tokenOwner}`);
        
        if (tokenOwner !== gistOwner) {
          throw new Error(`Token owner (${tokenOwner}) does not match Gist owner (${gistOwner}). The token must belong to the Gist owner to update it.`);
        }
        
        // Check token scopes from response headers
        const scopes = userResponse.headers.get('x-oauth-scopes') || '';
        console.log(`Token scopes: ${scopes || 'none (check token settings)'}`);
        
        if (!scopes.includes('gist')) {
          throw new Error(`Token is missing 'gist' scope. Current scopes: ${scopes || 'none'}. Please create a new token with 'gist' scope at https://github.com/settings/tokens`);
        }
      } else {
        console.warn(`⚠️  Could not verify token owner (status: ${userResponse.status})`);
      }
      
      // Build files object - preserve existing files and update parsed_comps.json
      const files: Record<string, { content: string } | null> = {};
      
      // Preserve all existing files (set to null to keep them, or update if needed)
      if (gistData.files) {
        for (const [filename, fileData] of Object.entries(gistData.files)) {
          if (filename !== "parsed_comps.json") {
            // Keep existing files by setting them to null (preserves them)
            files[filename] = null;
          }
        }
      }
      
      // Update parsed_comps.json
      files["parsed_comps.json"] = {
        content: JSON.stringify(allOffers, null, 2),
      };
      
      console.log(`Updating Gist with ${Object.keys(files).length} file(s)...`);
      const patchBody = {
        files: files,
      };
      console.log(`PATCH body keys: ${Object.keys(patchBody.files).join(', ')}`);
      
      const response = await fetch(`https://api.github.com/gists/${process.env.GIST_ID}`, {
        method: "PATCH",
        headers: {
          Authorization: `token ${process.env.GITHUB_TOKEN}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
          "User-Agent": "leetoffer-script",
        },
        body: JSON.stringify(patchBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorDetails = errorText;
        try {
          const errorJson = JSON.parse(errorText);
          errorDetails = JSON.stringify(errorJson, null, 2);
          // Check for specific error messages
          if (errorJson.message) {
            console.error(`GitHub API error message: ${errorJson.message}`);
          }
        } catch {
          // Keep as text if not JSON
        }
        console.error(`Full error response: ${errorDetails}`);
        throw new Error(`GitHub API error: ${response.status} - ${errorDetails}`);
      }

      console.log(`✅ Successfully saved ${allOffers.length} offers to GitHub Gist`);
    } catch (error) {
      console.error("❌ Failed to save to Gist:", error);
      // Don't throw - allow the function to complete even if Gist save fails
    }
  } else {
    console.log("⚠️  GIST_ID or GITHUB_TOKEN not set, skipping Gist save");
  }

  // Save metadata (last post ID and fetch time) to local file
  if (lastFetchedPostId) {
    const metadata = {
      lastPostId: lastFetchedPostId,
      lastFetchTime: Date.now(),
      totalOffers: allOffers.length,
    };
    try {
      // Ensure metadata directory exists
      if (!metadataPath.startsWith("/tmp")) {
        const metadataDir = dirname(metadataPath);
        if (!existsSync(metadataDir)) {
          await mkdir(metadataDir, { recursive: true });
        }
      }
      await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    } catch (error) {
      console.warn("Failed to save metadata file (non-fatal):", error);
    }

    // Also save metadata to Gist if configured
    if (process.env.GIST_ID && process.env.GITHUB_TOKEN) {
      try {
        const metadata = {
          lastPostId: lastFetchedPostId,
          lastFetchTime: Date.now(),
          totalOffers: allOffers.length,
        };
        await fetch(`https://api.github.com/gists/${process.env.GIST_ID}`, {
          method: "PATCH",
          headers: {
            Authorization: `token ${process.env.GITHUB_TOKEN}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            files: {
              ".leetoffer_metadata.json": {
                content: JSON.stringify(metadata, null, 2),
              },
            },
          }),
        });
      } catch (error) {
        console.warn("Failed to save metadata to Gist (non-fatal):", error);
      }
    }
  }
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
  
  // Store paths for cleanup on interrupt
  const { outputPath, metadataPath } = getOutputPaths();
  
  // Set up signal handlers to save data on interrupt (Ctrl+C)
  let shouldSaveOnExit = true;
  const saveOnExit = async () => {
    if (!shouldSaveOnExit) return;
    shouldSaveOnExit = false;
    console.log("\n\n⚠️  Interrupted! Saving collected data...");
    
    try {
      // Merge whatever we have
      const existingOfferKeys = new Set(
        existingOffers.map(
          (offer) =>
            `${offer.company}-${offer.role}-${offer.total_offer}-${offer.post_id}`,
        ),
      );
      const uniqueNewOffers = newParsedOffers.filter((offer) => {
        const key = `${offer.company}-${offer.role}-${offer.total_offer}-${offer.post_id}`;
        return !existingOfferKeys.has(key);
      });
      const allOffers = [...existingOffers, ...uniqueNewOffers];
      
      await saveData(allOffers, outputPath, metadataPath, lastFetchedPostId);
      console.log(`\n✅ Saved ${allOffers.length} offers before exit.`);
    } catch (error) {
      console.error("Failed to save on exit:", error);
    }
    process.exit(0);
  };
  
  // Handle SIGINT (Ctrl+C) and SIGTERM
  process.on("SIGINT", saveOnExit);
  process.on("SIGTERM", saveOnExit);

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
      } catch (error: unknown) {
        // Handle quota exceeded error
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage === "QUOTA_EXCEEDED") {
          console.warn(`\n⚠️  Daily quota exceeded. Stopping processing.`);
          console.warn(
            `   Processed ${processedCount} posts, found ${successCount} with valid offers.`,
          );
          console.warn(`   Remaining posts will be processed tomorrow.\n`);
          break;
        }
        // For other errors, continue processing (parsePost already logged the error)
        // Don't log again here to avoid duplicate error messages
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage === "QUOTA_EXCEEDED") {
      console.warn(`\n⚠️  Quota exceeded during processing.`);
    } else {
      console.error("Error during processing:", error);
      // Don't throw - continue to save whatever we have
    }
  }

  // Merge new offers with existing ones
  // Always save data even if there were errors
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

  // Disable save-on-exit handler since we're saving normally
  shouldSaveOnExit = false;

  // Save data using the helper function
  await saveData(allOffers, outputPath, metadataPath, lastFetchedPostId);

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
