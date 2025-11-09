"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  Rectangle,
} from "recharts";

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

interface DashboardClientProps {
  initialData: ParsedOffer[];
}

function getExperienceLevel(yoe: number | null): string {
  if (yoe === null) return "Unknown";
  if (yoe <= 1) return "Entry (0-1)";
  if (yoe <= 6) return "Mid (2-6)";
  if (yoe <= 10) return "Senior (7-10)";
  return "Senior + (11+)";
}

function calculateStats(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const q1Index = Math.floor(sorted.length * 0.25);
  const q2Index = Math.floor(sorted.length * 0.5);
  const q3Index = Math.floor(sorted.length * 0.75);

  return {
    min: sorted[0],
    q1: sorted[q1Index],
    median: sorted[q2Index],
    q3: sorted[q3Index],
    max: sorted[sorted.length - 1],
    mean: sorted.reduce((a, b) => a + b, 0) / sorted.length,
  };
}

// Custom Box Plot Shape Component
function BoxPlotShape(props: any) {
  const { x, y, width, payload } = props;
  if (!payload) return null;

  const { min, q1, median, q3, max } = payload;
  const boxWidth = width * 0.6;
  const boxX = x + (width - boxWidth) / 2;
  const centerX = x + width / 2;

  // Calculate Y positions (inverted because Y increases downward in SVG)
  const yMin = y - min;
  const yMax = y - max;
  const yQ1 = y - q1;
  const yQ3 = y - q3;
  const yMedian = y - median;
  const boxHeight = yQ1 - yQ3;

  return (
    <g>
      {/* Lower whisker */}
      <line
        x1={centerX}
        y1={yQ1}
        x2={centerX}
        y2={yMin}
        stroke="currentColor"
        strokeWidth={1.5}
      />
      <line
        x1={centerX - 4}
        y1={yMin}
        x2={centerX + 4}
        y2={yMin}
        stroke="currentColor"
        strokeWidth={1.5}
      />

      {/* Upper whisker */}
      <line
        x1={centerX}
        y1={yQ3}
        x2={centerX}
        y2={yMax}
        stroke="currentColor"
        strokeWidth={1.5}
      />
      <line
        x1={centerX - 4}
        y1={yMax}
        x2={centerX + 4}
        y2={yMax}
        stroke="currentColor"
        strokeWidth={1.5}
      />

      {/* Box */}
      <rect
        x={boxX}
        y={yQ3}
        width={boxWidth}
        height={boxHeight}
        fill="currentColor"
        fillOpacity={0.3}
        stroke="currentColor"
        strokeWidth={1.5}
      />

      {/* Median line */}
      <line
        x1={boxX}
        y1={yMedian}
        x2={boxX + boxWidth}
        y2={yMedian}
        stroke="currentColor"
        strokeWidth={2}
      />
    </g>
  );
}

export function DashboardClient({ initialData }: DashboardClientProps) {
  const chartData = useMemo(() => {
    // Filter offers with total compensation
    const offersWithTotal = initialData.filter(
      (offer) => offer.total_offer !== null && offer.total_offer > 0,
    );

    // Calculate date range for the info banner
    const dates = offersWithTotal
      .map((offer) => offer.post_timestamp)
      .filter((ts): ts is number => ts !== undefined)
      .sort((a, b) => b - a);

    const newestDate = dates[0]
      ? new Date(dates[0]).toISOString().split("T")[0]
      : null;
    const lastDate = dates[dates.length - 1];
    const oldestDate = lastDate !== undefined
      ? new Date(lastDate).toISOString().split("T")[0]
      : null;

    // 1. Total Compensation Distribution (Bar Chart)
    const distributionData: Record<string, number> = {};
    offersWithTotal.forEach((offer) => {
      const totalLPA = (offer.total_offer || 0) / 100000;
      const bucket = Math.floor(totalLPA / 10) * 10;
      const key = `${bucket}-${bucket + 9}`;
      distributionData[key] = (distributionData[key] || 0) + 1;
    });

    const distributionChart = Object.entries(distributionData)
      .map(([range, count]) => ({
        range: range.replace("-", "-") + " LPA",
        count,
      }))
      .sort((a, b) => {
        const aNum = parseInt(a.range);
        const bNum = parseInt(b.range);
        return aNum - bNum;
      });

    // 2. Total Compensation by Experience Level (Box Plot)
    const experienceGroups: Record<string, number[]> = {};
    offersWithTotal.forEach((offer) => {
      if (offer.yoe !== null) {
        const level = getExperienceLevel(offer.yoe);
        const totalLPA = (offer.total_offer || 0) / 100000;
        if (!experienceGroups[level]) {
          experienceGroups[level] = [];
        }
        experienceGroups[level].push(totalLPA);
      }
    });

    const experienceBoxPlot = Object.entries(experienceGroups)
      .map(([level, values]) => {
        const stats = calculateStats(values);
        return {
          level,
          min: stats?.min || 0,
          q1: stats?.q1 || 0,
          median: stats?.median || 0,
          q3: stats?.q3 || 0,
          max: stats?.max || 0,
          mean: stats?.mean || 0,
        };
      })
      .sort((a, b) => {
        const order = [
          "Entry (0-1)",
          "Mid (2-6)",
          "Senior (7-10)",
          "Senior + (11+)",
        ];
        return order.indexOf(a.level) - order.indexOf(b.level);
      });

    // 3. Number of Offers by Company (Horizontal Bar Chart)
    const companyGroups: Record<string, number[]> = {};
    offersWithTotal.forEach((offer) => {
      if (offer.company) {
        const company = offer.company;
        const totalLPA = (offer.total_offer || 0) / 100000;
        if (!companyGroups[company]) {
          companyGroups[company] = [];
        }
        companyGroups[company].push(totalLPA);
      }
    });

    const companyCounts = Object.entries(companyGroups)
      .map(([company, values]) => ({
        company:
          company.length > 20 ? company.substring(0, 20) + "..." : company,
        fullCompany: company,
        count: values.length,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // 4. Compensation Trends Over Time (Monthly)
    const monthlyData: Record<string, number[]> = {};
    offersWithTotal.forEach((offer) => {
      if (offer.post_date) {
        const monthKey = offer.post_date.substring(0, 7);
        const totalLPA = (offer.total_offer || 0) / 100000;
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = [];
        }
        monthlyData[monthKey].push(totalLPA);
      }
    });

    const trendChart = Object.entries(monthlyData)
      .map(([month, values]) => {
        const stats = calculateStats(values);
        return {
          month,
          median: stats?.median || 0,
          mean: stats?.mean || 0,
          count: values.length,
        };
      })
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12);

    return {
      distributionChart,
      experienceBoxPlot,
      companyCounts,
      trendChart,
      newestDate:
        dates.length > 0 && dates[0] !== undefined
          ? new Date(dates[0]).toISOString().split("T")[0]
          : null,
      oldestDate: (() => {
        const lastDate = dates[dates.length - 1];
        return lastDate !== undefined
          ? new Date(lastDate).toISOString().split("T")[0]
          : null;
      })(),
    };
  }, [initialData]);

  const COLORS = {
    primary: "hsl(220 70% 50%)",
    secondary: "hsl(160 60% 45%)",
    accent: "hsl(280 60% 50%)",
  };

  return (
    <div className="w-full space-y-8">
      {/* Info Banner */}
      {chartData.newestDate && chartData.oldestDate && (
        <div className="rounded-xl border border-border/60 bg-background/40 backdrop-blur-sm p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Based on {initialData.length} offers parsed between{" "}
            {chartData.oldestDate} and {chartData.newestDate}
          </p>
        </div>
      )}

      {/* Chart Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Total Compensation Distribution */}
        <div className="rounded-xl border border-border/60 bg-background/40 backdrop-blur-sm p-6">
          <h3 className="mb-4 text-lg font-semibold">
            Total Compensation Distribution
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={chartData.distributionChart}
              margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
              />
              <XAxis
                dataKey="range"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: "transparent",
                  border: "none",
                  boxShadow: "none",
                }}
                cursor={{ fill: "transparent" }}
              />
              <Bar dataKey="count" fill={COLORS.primary} radius={[4, 4, 0, 0]}>
                {chartData.distributionChart.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS.primary} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Total Compensation by Experience Level - Box Plot */}
        <div className="rounded-xl border border-border/60 bg-background/40 backdrop-blur-sm p-6">
          <h3 className="mb-4 text-lg font-semibold">
            Total Compensation by Seniority
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={chartData.experienceBoxPlot}
              margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
              />
              <XAxis
                dataKey="level"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                label={{
                  value: "Total Compensation (₹ LPA)",
                  angle: -90,
                  position: "insideLeft",
                }}
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: "transparent",
                  border: "none",
                  boxShadow: "none",
                }}
                cursor={{ fill: "transparent" }}
                formatter={(value: any, name: string, props: any) => {
                  if (name === "median")
                    return [`₹${value.toFixed(2)}L`, "Median"];
                  if (name === "q1") return [`₹${value.toFixed(2)}L`, "Q1"];
                  if (name === "q3") return [`₹${value.toFixed(2)}L`, "Q3"];
                  if (name === "min") return [`₹${value.toFixed(2)}L`, "Min"];
                  if (name === "max") return [`₹${value.toFixed(2)}L`, "Max"];
                  return value;
                }}
              />
              <Bar dataKey="max" fill="transparent" shape={BoxPlotShape} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Number of Offers by Company */}
        <div className="rounded-xl border border-border/60 bg-background/40 backdrop-blur-sm p-6">
          <h3 className="mb-4 text-lg font-semibold">
            Number of Offers by Company
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={chartData.companyCounts}
              layout="vertical"
              margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
              />
              <XAxis
                type="number"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                label={{
                  value: "# Offers",
                  position: "insideBottom",
                  offset: -5,
                }}
              />
              <YAxis
                type="category"
                dataKey="company"
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                width={100}
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: "transparent",
                  border: "none",
                  boxShadow: "none",
                }}
                cursor={{ fill: "transparent" }}
              />
              <Bar
                dataKey="count"
                fill={COLORS.secondary}
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Compensation Trends Over Time */}
        {chartData.trendChart.length > 0 && (
          <div className="rounded-xl border border-border/60 bg-background/40 backdrop-blur-sm p-6 md:col-span-2 lg:col-span-3">
            <h3 className="mb-4 text-lg font-semibold">
              Compensation Trends Over Time (Last 12 Months)
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={chartData.trendChart}
                margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="month"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  tickFormatter={(value) => {
                    const date = new Date(value + "-01");
                    return date.toLocaleDateString("en-US", {
                      month: "short",
                      year: "numeric",
                    });
                  }}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  label={{
                    value: "Total Compensation (₹ LPA)",
                    angle: -90,
                    position: "insideLeft",
                  }}
                />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: "transparent",
                    border: "none",
                    boxShadow: "none",
                  }}
                  cursor={{
                    stroke: "hsl(var(--border))",
                    strokeWidth: 1,
                    strokeDasharray: "3 3",
                  }}
                  formatter={(value: any, name: string) => {
                    if (name === "median") {
                      return [`₹${value.toFixed(2)}L`, "Median"];
                    }
                    if (name === "mean") {
                      return [`₹${value.toFixed(2)}L`, "Mean"];
                    }
                    return value;
                  }}
                  labelFormatter={(value) => {
                    const date = new Date(value + "-01");
                    return date.toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    });
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="median"
                  stroke={COLORS.primary}
                  strokeWidth={2}
                  dot={{ fill: COLORS.primary, r: 4 }}
                  name="Median"
                />
                <Line
                  type="monotone"
                  dataKey="mean"
                  stroke={COLORS.secondary}
                  strokeWidth={2}
                  dot={{ fill: COLORS.secondary, r: 4 }}
                  name="Mean"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
