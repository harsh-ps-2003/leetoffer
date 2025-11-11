import { z } from "zod";
import { PARSING_PROMPT } from "./prompts";
import type { LeetCodePost } from "./types";

function getApiKey(): string {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error(
      "PERPLEXITY_API_KEY environment variable is required. Please set it in your .env file.",
    );
  }
  return apiKey;
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
  retryCount = 0,
): Promise<ParsedOffer[] | null> {
  const inputText = `${post.title}\n---\n${post.content}`;
  const prompt = PARSING_PROMPT.replace("{leetcode_post}", inputText);

  try {
    const apiKey = getApiKey();
    if (!apiKey || apiKey.length < 10) {
      throw new Error("Invalid API key: API key is missing or too short");
    }
    
    let response: Response;
    try {
      response = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "sonar-pro",
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.2,
          max_tokens: 4000,
        }),
      });
    } catch (fetchError) {
      const fetchErr = fetchError as Error;
      throw new Error(`Network error: ${fetchErr.message}`);
    }

    if (!response.ok) {
      let errorData: any = {};
      let errorText = "";
      try {
        errorText = await response.text();
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText || `HTTP ${response.status}` };
      }
      const errorMsg = errorData.error?.message || errorData.message || `HTTP ${response.status}: ${errorText.substring(0, 100)}`;
      throw new Error(errorMsg);
    }

    let data: any;
    try {
      data = await response.json();
    } catch (parseError) {
      throw new Error(`Failed to parse API response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }
    
    // Check if response has the expected structure
    if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      console.error(`[Post ${post.id}] Unexpected response format:`, JSON.stringify(data).substring(0, 200));
      return null;
    }
    
    const text = data.choices[0]?.message?.content || "";
    
    if (!text) {
      console.error(`[Post ${post.id}] Empty response from API`);
      return null;
    }

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
  } catch (error: unknown) {
    // Convert error to Error object for consistent handling
    let errorObj: Error;
    if (error instanceof Error) {
      errorObj = error;
    } else if (typeof error === "object" && error !== null) {
      const err = error as { message?: string; status?: number; errorDetails?: any };
      const message = err.message || 
        err.errorDetails?.error?.message ||
        err.errorDetails?.message ||
        JSON.stringify(err).substring(0, 200) ||
        `Unknown error (status: ${err.status || "unknown"})`;
      errorObj = new Error(message);
      (errorObj as any).status = err.status;
      (errorObj as any).errorDetails = err.errorDetails;
    } else {
      errorObj = new Error(String(error));
    }

    // Handle rate limiting (429 errors)
    const status = (errorObj as any).status;
    if (status === 429) {
      const delaySeconds = Math.pow(2, retryCount) * 2; // Exponential backoff: 2s, 4s, 8s, etc.

      // Check if it's a quota exceeded error
      const errorDetails = (errorObj as any).errorDetails || {};
      const errorMessage = errorDetails.error?.message || errorObj.message || "";
      if (errorMessage.includes("quota") || errorMessage.includes("limit") || errorMessage.includes("rate limit")) {
        if (retryCount === 0) {
          console.warn(`\n⚠️  Quota exceeded! Daily limit reached.`);
          console.warn(`   Please wait or upgrade your plan.`);
          console.warn(`   Stopping processing to avoid further errors.\n`);
          throw new Error("QUOTA_EXCEEDED");
        }
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

    // For other errors, log the actual error message
    console.error(`[Post ${post.id}] Error parsing: ${errorObj.message}`);
    return null;
  }
}
