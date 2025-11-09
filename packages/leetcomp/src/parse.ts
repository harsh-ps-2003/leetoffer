import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { PARSING_PROMPT } from "./prompts";
import type { LeetCodePost } from "./types";

// Lazy initialization - only create model when needed (after dotenv has loaded)
let model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]> | null = null;

function getModel() {
  if (!model) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY environment variable is required. Please set it in your .env file.",
      );
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  }
  return model;
}

const ParsedOfferSchema = z.object({
  company: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  yoe: z.number().nullable().optional(),
  base_offer: z.number().nullable().optional(),
  total_offer: z.number().nullable().optional(),
  location: z.string().nullable().optional(),
  visa_sponsorship: z.enum(["yes", "no"]).nullable().optional(),
});

// Filter out entries that don't have essential compensation data
// Relaxed validation: accept offers with company name OR compensation data
// This matches the original dataset which includes partial offers
function isValidOffer(offer: z.infer<typeof ParsedOfferSchema>): boolean {
  // Must have at least company name OR some compensation data
  const hasCompany = !!offer.company;
  const hasCompensation = !!(offer.base_offer || offer.total_offer);

  // Accept if we have company name (even without compensation)
  // OR if we have compensation data (even without company - might be extracted from context)
  return hasCompany || hasCompensation;
}

const ParsedContentSchema = z.array(ParsedOfferSchema);

export type ParsedOffer = z.infer<typeof ParsedOfferSchema>;

function parseJsonMarkdown(markdown: string): unknown {
  const jsonRegex = /```json\n([\s\S]*?)\n```/;
  const match = markdown.match(jsonRegex);
  if (!match || !match[1]) {
    return null;
  }
  try {
    return JSON.parse(match[1]);
  } catch (error) {
    return null;
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function parsePost(
  post: LeetCodePost,
  retryCount: number = 0,
): Promise<ParsedOffer[] | null> {
  const inputText = `${post.title}\n---\n${post.content}`;
  const prompt = PARSING_PROMPT.replace("{leetcode_post}", inputText);

  try {
    const modelInstance = getModel();
    const result = await modelInstance.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const parsedJson = parseJsonMarkdown(text);

    if (!parsedJson) {
      return null;
    }

    const validationResult = ParsedContentSchema.safeParse(parsedJson);

    if (!validationResult.success) {
      return null;
    }

    // Filter out invalid offers (missing essential data)
    const validOffers = validationResult.data.filter(isValidOffer);

    if (validOffers.length === 0) {
      return null;
    }
    return validOffers;
  } catch (error: any) {
    // Handle rate limiting (429 errors)
    if (error.status === 429) {
      const retryDelay = error.errorDetails?.find(
        (detail: any) =>
          detail["@type"] === "type.googleapis.com/google.rpc.RetryInfo",
      )?.retryDelay;

      const delaySeconds = retryDelay
        ? parseFloat(retryDelay.replace("s", ""))
        : Math.pow(2, retryCount) * 2; // Exponential backoff: 2s, 4s, 8s, etc.

      // Check if it's a quota exceeded error (daily limit)
      const quotaFailure = error.errorDetails?.find(
        (detail: any) =>
          detail["@type"] === "type.googleapis.com/google.rpc.QuotaFailure",
      );

      if (quotaFailure && retryCount === 0) {
        console.warn(`\n⚠️  Quota exceeded! Daily limit reached.`);
        console.warn(`   The free tier allows 250 requests per day.`);
        console.warn(`   Please wait 24 hours or upgrade your plan.`);
        console.warn(`   Stopping processing to avoid further errors.\n`);
        throw new Error("QUOTA_EXCEEDED");
      }

      // Retry with exponential backoff (max 3 retries)
      if (retryCount < 3) {
        console.warn(
          `[Post ${post.id}] Rate limited. Retrying in ${delaySeconds.toFixed(1)}s... (attempt ${retryCount + 1}/3)`,
        );
        await sleep(delaySeconds * 1000);
        return parsePost(post, retryCount + 1);
      } else {
        console.error(`[Post ${post.id}] Max retries reached. Skipping.`);
        return null;
      }
    }

    // For other errors, just log and return null
    console.error(`[Post ${post.id}] Error parsing:`, error.message || error);
    return null;
  }
}
