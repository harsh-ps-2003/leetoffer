# Job Market Insights

A platform for navigating the job market using compensation data from LeetCode discussions. Built with Next.js, TypeScript, and modern web technologies.

## Features

- 📊 **Market Insights Dashboard**: Visualize compensation trends with interactive charts

  - Total compensation distribution
  - Compensation by seniority (box plots)
  - Company offer counts
  - Monthly trends over time

- 🔍 **Job Market Browser**: Search and filter compensation offers

  - Search by company, role, or location
  - Filter by years of experience (YOE)
  - Filter by salary range
  - Filter by date range
  - Pagination support

- 🤖 **Automated Data Ingestion**:

  - Fetches compensation data from LeetCode discussions
  - Uses AI (Gemini 2.5 Flash) to parse unstructured data
  - Incremental updates (only fetches new posts)
  - Rate limiting and quota management
  - Automatic cron job scheduling (Vercel)

- 📈 **Data Visualization**:
  - Interactive charts using Recharts
  - Dark theme with modern UI
  - Responsive design

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **Charts**: Recharts
- **AI/LLM**: Google Gemini 2.5 Flash
- **Validation**: Zod
- **Monorepo**: Turborepo
- **Package Manager**: Bun
- **Deployment**: Vercel

## Project Structure

```
v1/
├── apps/
│   ├── app/              # Next.js application (main app)
│   │   ├── src/app/
│   │   │   ├── [locale]/
│   │   │   │   ├── dashboard/    # Market insights dashboard
│   │   │   │   └── market/       # Job market browser
│   │   │   └── api/
│   │   │       └── cron/         # Cron job endpoint
│   │   └── public/
│   │       └── parsed_comps.json # Generated compensation data
│   └── web/              # Marketing website
├── packages/
│   ├── leetcomp/        # LeetCode data ingestion package
│   │   ├── src/
│   │   │   ├── index.ts      # Main entry point
│   │   │   ├── refresh.ts    # Fetch LeetCode posts
│   │   │   ├── parse.ts      # AI parsing logic
│   │   │   ├── queries.ts    # GraphQL queries
│   │   │   └── prompts.ts    # LLM prompts
│   │   └── dist/        # Built package
│   └── ui/              # Shared UI components
└── vercel.json          # Vercel cron configuration
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (v1.1.26+) or Node.js (v18+)
- Google Gemini API key ([Get one here](https://ai.google.dev/))

### Installation

1. **Clone the repository**

   ```bash
   git clone <your-repo-url>
   cd v1
   ```

2. **Install dependencies**

   ```bash
   bun install
   # or
   npm install
   ```

3. **Set up environment variables**

   Create a `.env` file in the project root:

   ```bash
   # Required: Google Gemini API Key
   GEMINI_API_KEY=your_gemini_api_key_here

   # Optional: Vercel deployment
   VERCEL_URL=your-app.vercel.app
   PORT=3000
   ```

4. **Build packages**

   ```bash
   bun run build
   # or
   npm run build
   ```

5. **Run the development server**

   ```bash
   bun run dev:app
   # or
   npm run dev:app
   ```

6. **Open your browser**

   Navigate to [http://localhost:3000](http://localhost:3000)

   - Dashboard: `/en/dashboard`
   - Market: `/en/market`

## Data Ingestion

### Manual Ingestion

To manually fetch and parse LeetCode compensation data:

```bash
cd packages/leetcomp
bun run build
node dist/index.js
```

This will:

1. Fetch posts from LeetCode's compensation discussion forum
2. Parse each post using Gemini AI
3. Save structured data to `apps/app/public/parsed_comps.json`
4. Track metadata in `apps/app/public/.leetcomp_metadata.json`

### Automated Cron Job

The project includes a Vercel cron job that runs every 12 hours:

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "0 */12 * * *"
    }
  ]
}
```

**Note**: The cron endpoint includes optional Bearer token authentication. Set `CRON_SECRET` in your environment variables for production.

### Rate Limiting & Quota Management

The ingestion system includes built-in rate limiting:

- **Free Tier Limits**: 250 requests/day (Gemini API)
- **Automatic Throttling**: 500ms delay between API calls
- **Quota Tracking**: Stops at 240 calls to avoid hitting limits
- **Retry Logic**: Exponential backoff for rate limit errors
- **Incremental Updates**: Only fetches new posts since last run

When the daily quota is exceeded, the script will:

- Stop gracefully
- Save progress
- Resume on the next run (after quota resets)

## Environment Variables

### Required

| Variable         | Description                       | Example   |
| ---------------- | --------------------------------- | --------- |
| `GEMINI_API_KEY` | Google Gemini API key for parsing | `AIza...` |

### Optional

| Variable      | Description                   | Default |
| ------------- | ----------------------------- | ------- |
| `PORT`        | Server port                   | `3000`  |
| `VERCEL_URL`  | Vercel deployment URL         | -       |
| `CRON_SECRET` | Secret for cron endpoint auth | -       |

## Available Scripts

### Root Level

```bash
# Development
bun run dev              # Start all apps in dev mode
bun run dev:app          # Start main app only
bun run dev:web          # Start web app only

# Build
bun run build            # Build all packages

# Code Quality
bun run format           # Format code with Biome
bun run lint             # Lint code
bun run typecheck        # Type check

# Cleanup
bun run clean            # Remove node_modules
bun run clean:workspaces # Clean all workspace build artifacts
```

### LeetCode Package

```bash
cd packages/leetcomp

bun run build            # Build the package
bun run dev              # Watch mode
bun run typecheck        # Type check
```

## API Endpoints

### `/api/cron` (GET)

Triggers the data ingestion process.

**Authentication** (optional):

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron
```

**Response**:

```json
{
  "success": true,
  "message": "Data refreshed successfully",
  "processed": 50,
  "successful": 12,
  "totalOffers": 45,
  "newOffers": 5,
  "outputPath": "/path/to/parsed_comps.json"
}
```

## Data Format

The parsed compensation data is stored in `apps/app/public/parsed_comps.json`:

```typescript
interface ParsedOffer {
  company: string | null;
  role: string | null;
  yoe: number | null; // Years of experience
  base_offer: number | null; // Base salary (in original currency)
  total_offer: number | null; // Total compensation (in original currency)
  location: string | null; // Job location
  visa_sponsorship: "yes" | "no" | null; // VISA sponsorship for Indians
  post_id?: string; // LeetCode post ID
  post_title?: string; // Post title
  post_date?: string; // ISO date (YYYY-MM-DD)
  post_timestamp?: number; // Unix timestamp
}
```

**Note**: All monetary values are stored in the original currency units (typically Lakhs for Indian offers). The UI converts them to ₹ LPA (Lakhs Per Annum) for display.

## Deployment

### Vercel

1. **Connect your repository** to Vercel
2. **Set environment variables** in Vercel dashboard:
   - `GEMINI_API_KEY`
   - `CRON_SECRET` (optional, for cron endpoint security)
3. **Deploy**: Vercel will automatically deploy on push

The cron job will run automatically every 12 hours.

### Manual Deployment

```bash
# Build
bun run build

# Start production server
bun run start:app
```

## Troubleshooting

### "Quota exceeded" errors

The free tier Gemini API has a 250 requests/day limit. The system will:

- Automatically stop before hitting the limit
- Resume processing the next day
- Use incremental updates to avoid re-processing old posts

**Solution**: Wait 24 hours for quota reset, or upgrade to a paid Gemini plan.

### "No offers found"

This usually means:

1. The data ingestion hasn't run yet
2. The `parsed_comps.json` file doesn't exist
3. The cron job failed

**Solution**:

- Manually run the ingestion: `cd packages/leetcomp && bun run build && node dist/index.js`
- Check the cron endpoint logs
- Verify `GEMINI_API_KEY` is set correctly

### Build errors

If you see build errors related to missing dependencies:

```bash
# Clean and reinstall
bun run clean
bun install
bun run build
```

## License

See [LICENSE.md](LICENSE.md) for details.

## Acknowledgments

- Data source: [LeetCode Compensation Discussions](https://leetcode.com/discuss/compensation)
- Built on [Midday v1](https://github.com/midday-ai/v1) foundation
- UI components inspired by [shadcn/ui](https://ui.shadcn.com)
