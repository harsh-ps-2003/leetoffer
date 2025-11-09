import { readFile } from "fs/promises";
import { join } from "path";
import { MarketClient } from "./market-client";
import { AnimatedText } from "@v1/ui/animated-text";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@v1/ui/tooltip";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Job Market - Compensation Data",
  description: "Browse software engineering compensation data from LeetCode",
};

interface ParsedOffer {
  company: string | null;
  role: string | null;
  yoe: number | null;
  base_offer: number | null;
  total_offer: number | null;
  location: string | null;
  visa_sponsorship: "yes" | "no" | null;
  post_id?: string;
  post_title?: string;
  post_date?: string;
  post_timestamp?: number;
}

async function getCompensationData(): Promise<ParsedOffer[]> {
  try {
    const filePath = join(process.cwd(), "public", "parsed_comps.json");
    const fileContents = await readFile(filePath, "utf-8");
    return JSON.parse(fileContents);
  } catch (error) {
    console.error("Error reading compensation data:", error);
    return [];
  }
}

export default async function MarketPage() {
  const data = await getCompensationData();

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background">
      <div className="pointer-events-none absolute -top-[118px] inset-x-0 h-[80%] bg-[linear-gradient(to_right,#222_1px,transparent_1px),linear-gradient(to_bottom,#222_1px,transparent_1px)] bg-[size:4.5rem_2rem] -z-10 [transform:perspective(1000px)_rotateX(-63deg)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-full bg-gradient-to-t from-background to-transparent -z-10" />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center gap-10 px-4 pb-24 pt-32">
        <h1 className="font-departure text-center text-[80px] md:text-[140px] lg:text-[160px] leading-tight">
          <AnimatedText text="Job Market" />
        </h1>
        <p className="text-center text-2xl md:text-3xl lg:text-4xl text-muted-foreground/80">
          Browse {data.length} compensation offers
        </p>

        <MarketClient initialData={data} />

        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href="https://leetcode.com/discuss/compensation"
                target="_blank"
                rel="noreferrer"
                className="relative z-10"
              >
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/image.png"
                    alt="LeetCode"
                    className="h-5 w-5 md:h-6 md:w-6 object-contain"
                  />
                  <span className="text-lg md:text-xl lg:text-2xl">
                    Live from LeetCode
                  </span>
                </div>
              </a>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={15} className="text-xs">
              Browse real compensation data from LeetCode discussions
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-b from-transparent to-background -z-10" />
      <div className="pointer-events-none absolute -bottom-[280px] inset-x-0 h-[70%] bg-[linear-gradient(to_right,#222_1px,transparent_1px),linear-gradient(to_bottom,#222_1px,transparent_1px)] bg-[size:4.5rem_2rem] -z-10 [transform:perspective(560px)_rotateX(63deg)]" />
    </div>
  );
}
