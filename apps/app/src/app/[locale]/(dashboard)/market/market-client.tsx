"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@v1/ui/input";
import { Button } from "@v1/ui/button";

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

interface MarketClientProps {
  initialData: ParsedOffer[];
}

const PAGE_SIZE = 12;

export function MarketClient({ initialData }: MarketClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [yoeMin, setYoeMin] = useState("0");
  const [yoeMax, setYoeMax] = useState("30");
  const [salaryMin, setSalaryMin] = useState("1");
  const [salaryMax, setSalaryMax] = useState("200");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const parsedYoeMin = yoeMin ? Number(yoeMin) : undefined;
  const parsedYoeMax = yoeMax ? Number(yoeMax) : undefined;
  const parsedSalaryMin = salaryMin ? Number(salaryMin) : undefined;
  const parsedSalaryMax = salaryMax ? Number(salaryMax) : undefined;
  const parsedDateFrom = dateFrom ? new Date(dateFrom).getTime() : undefined;
  const parsedDateTo = dateTo
    ? new Date(dateTo + "T23:59:59").getTime()
    : undefined;

  const filteredOffers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return initialData.filter((offer) => {
      if (term) {
        const matchesTerm =
          offer.company?.toLowerCase().includes(term) ||
          offer.role?.toLowerCase().includes(term) ||
          offer.location?.toLowerCase().includes(term);
        if (!matchesTerm) return false;
      }

      if (parsedYoeMin !== undefined) {
        if (offer.yoe === null || offer.yoe < parsedYoeMin) return false;
      }

      if (parsedYoeMax !== undefined) {
        if (offer.yoe === null || offer.yoe > parsedYoeMax) return false;
      }

      if (parsedSalaryMin !== undefined) {
        if (
          offer.total_offer === null ||
          offer.total_offer < parsedSalaryMin * 100000
        ) {
          return false;
        }
      }

      if (parsedSalaryMax !== undefined) {
        if (
          offer.total_offer === null ||
          offer.total_offer > parsedSalaryMax * 100000
        ) {
          return false;
        }
      }

      // Date filtering
      if (parsedDateFrom !== undefined && offer.post_timestamp !== undefined) {
        if (offer.post_timestamp < parsedDateFrom) {
          return false;
        }
      }

      if (parsedDateTo !== undefined && offer.post_timestamp !== undefined) {
        if (offer.post_timestamp > parsedDateTo) {
          return false;
        }
      }

      return true;
    });
  }, [
    initialData,
    parsedSalaryMax,
    parsedSalaryMin,
    parsedYoeMax,
    parsedYoeMin,
    parsedDateFrom,
    parsedDateTo,
    searchTerm,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, yoeMin, yoeMax, salaryMin, salaryMax, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filteredOffers.length / PAGE_SIZE));
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageOffers = filteredOffers.slice(pageStart, pageStart + PAGE_SIZE);

  const showingFrom = filteredOffers.length === 0 ? 0 : pageStart + 1;
  const showingTo = pageStart + pageOffers.length;

  const resetFilters = () => {
    setSearchTerm("");
    setYoeMin("0");
    setYoeMax("30");
    setSalaryMin("1");
    setSalaryMax("200");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Input
          placeholder="Search by company, role, or location..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="max-w-2xl w-full bg-background border-border text-lg md:text-xl py-6 px-4 mx-auto"
        />

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">YOE min</label>
            <Input
              type="number"
              min={0}
              value={yoeMin}
              onChange={(event) => setYoeMin(event.target.value)}
              className="bg-background border-border"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">YOE max</label>
            <Input
              type="number"
              min={0}
              value={yoeMax}
              onChange={(event) => setYoeMax(event.target.value)}
              className="bg-background border-border"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">
              Total salary min (₹ LPA)
            </label>
            <Input
              type="number"
              min={0}
              value={salaryMin}
              onChange={(event) => setSalaryMin(event.target.value)}
              className="bg-background border-border"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">
              Total salary max (₹ LPA)
            </label>
            <Input
              type="number"
              min={0}
              value={salaryMax}
              onChange={(event) => setSalaryMax(event.target.value)}
              className="bg-background border-border"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Date from</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="bg-background border-border"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Date to</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="bg-background border-border"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={resetFilters}
            className="border-border"
          >
            Reset filters
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-background/40 backdrop-blur-sm p-4 md:p-6">
        {pageOffers.length === 0 ? (
          <p className="text-center text-muted-foreground py-12 text-xl md:text-2xl">
            No offers found. Try adjusting your search or filters.
          </p>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {pageOffers.map((offer, index) => (
                <div
                  key={`${offer.company}-${offer.role}-${index}`}
                  className="border border-border/60 rounded-lg p-4 hover:border-foreground/30 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-lg">
                        {offer.company || "Unknown Company"}
                      </h3>
                      {offer.location && (
                        <p className="text-muted-foreground text-sm">
                          {offer.location}
                        </p>
                      )}
                    </div>
                    {offer.total_offer && (
                      <span className="text-lg font-semibold text-green-500">
                        ₹
                        {(offer.total_offer / 100000).toLocaleString(
                          undefined,
                          { maximumFractionDigits: 2 },
                        )}
                        L
                      </span>
                    )}
                  </div>
                  <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                    {offer.role && <p>Role: {offer.role}</p>}
                    {offer.yoe !== null && <p>Experience: {offer.yoe} years</p>}
                    {offer.base_offer && (
                      <p>
                        Base: ₹
                        {(offer.base_offer / 100000).toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                        })}
                        L
                      </p>
                    )}
                    {offer.visa_sponsorship && (
                      <p className="text-xs">
                        <span className="font-medium">VISA Sponsorship:</span>{" "}
                        <span
                          className={
                            offer.visa_sponsorship === "yes"
                              ? "text-green-400"
                              : "text-red-400"
                          }
                        >
                          {offer.visa_sponsorship === "yes" ? "Yes" : "No"}
                        </span>
                      </p>
                    )}
                    {offer.post_date && (
                      <p className="text-xs opacity-75">
                        Posted:{" "}
                        {new Date(offer.post_date).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {showingFrom}-{showingTo} of {filteredOffers.length}{" "}
                offers
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="border-border"
                  disabled={currentPage === 1}
                  onClick={() =>
                    setCurrentPage((page) => Math.max(1, page - 1))
                  }
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  className="border-border"
                  disabled={currentPage === totalPages}
                  onClick={() =>
                    setCurrentPage((page) => Math.min(totalPages, page + 1))
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
