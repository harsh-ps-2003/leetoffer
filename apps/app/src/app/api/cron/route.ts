import { NextResponse } from "next/server";
import { run } from "@v1/leetcomp";

export async function GET(request: Request) {
  // Simple security: check for a secret token in the request
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("Starting LeetCode compensation data refresh...");
    const result = (await run()) as {
      processed: number;
      successful: number;
      totalOffers: number;
      newOffers: number;
      outputPath: string;
    } | void;
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
