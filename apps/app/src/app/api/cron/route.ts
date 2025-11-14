import { NextResponse } from "next/server";
import { run } from "@v1/leetoffer";

export async function GET(request: Request) {
  // Security: Check for Vercel cron header OR secret token
  // Vercel automatically sends x-vercel-cron header when invoking cron jobs
  const vercelCronHeader = request.headers.get("x-vercel-cron");
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // Allow if it's from Vercel cron OR if it has the correct secret token (for manual testing)
  const isVercelCron = vercelCronHeader === "1";
  const hasValidSecret = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isVercelCron && !hasValidSecret) {
    // If CRON_SECRET is set, require it. Otherwise, only allow Vercel cron.
    if (cronSecret) {
      return NextResponse.json(
        { error: "Unauthorized - Missing or invalid CRON_SECRET" },
        { status: 401 },
      );
    }
    // If no CRON_SECRET is set, only allow Vercel cron
    if (!isVercelCron) {
      return NextResponse.json(
        { error: "Unauthorized - Must be called by Vercel cron or with valid CRON_SECRET" },
        { status: 401 },
      );
    }
  }

  try {
    console.log("Starting LeetCode compensation data refresh...");
    const result = (await run()) as {
      processed: number;
      successful: number;
      totalOffers: number;
      newOffers: number;
      outputPath: string;
    } | undefined;

    // Note: Data is already saved to Gist by the leetoffer package if GIST_ID and GITHUB_TOKEN are set

    return NextResponse.json({
      success: true,
      message: "Data refreshed successfully",
      ...(result && typeof result === "object" ? result : {}),
    });
  } catch (error) {
    console.error("Error refreshing data:", error);
    return NextResponse.json(
      {
        error: "Failed to refresh data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
