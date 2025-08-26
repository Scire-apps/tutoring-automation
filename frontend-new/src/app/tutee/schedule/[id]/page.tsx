// @ts-nocheck

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/app/providers";
import { TuteeLayout } from "@/components/tutee-layout";
import api from "@/services/api";
import {
  TwoWeekTimeGrid,
  compressSelectionToDateMap,
} from "@/components/two-week-time-grid";

export default function TuteeSchedulePage() {
  const { user, isLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [job, setJob] = useState<any>(null);
  const [selection, setSelection] = useState<{
    [date: string]: Array<{ start: string; end: string }>;
  }>({});
  const [saving, setSaving] = useState(false);
  const [desiredDuration, setDesiredDuration] = useState<number>(60);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.push("/auth/login");
      return;
    }
    (async () => {
      try {
        const {
          data: { session },
        } = await (
          await import("@/services/supabase")
        ).supabase.auth.getSession();
        const resp = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/tutee/jobs/${jobId}`,
          {
            headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
          }
        );
        if (!resp.ok) {
          setError("Job not found");
          return;
        }
        const json = await resp.json();
        setJob(json.job);
        // Preload previous availability if any
        if (
          json.job?.tutee_availability &&
          typeof json.job.tutee_availability === "object"
        ) {
          const mask: any = {};
          Object.entries(json.job.tutee_availability).forEach(
            ([d, arr]: any) => {
              mask[d] = (arr || []).map((s: string) => {
                const [start, end] = s.split("-");
                return { start, end };
              });
            }
          );
          setSelection(mask);
        }
      } catch (e) {
        setError("Failed to load job");
      }
    })();
  }, [isLoading, user, router, jobId]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const availability = compressSelectionToDateMap(selection);
      // Simple guard
      const hasAny = Object.values(availability).some(
        (arr) => Array.isArray(arr) && arr.length > 0
      );
      if (!hasAny)
        throw new Error("Please mark at least one time you are available.");
      await api.setTuteeAvailability(jobId, availability, desiredDuration);
      router.push("/tutee/dashboard");
    } catch (e: any) {
      setError(e?.message || "Failed to save availability");
    } finally {
      setSaving(false);
    }
  };

  if (!job) {
    return (
      <TuteeLayout>
        <div className="min-h-full flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-800">Loading...</p>
          </div>
        </div>
      </TuteeLayout>
    );
  }

  return (
    <TuteeLayout>
      <div className="p-6 bg-white max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold">Set Your Availability</h1>
        <p className="text-sm text-gray-600 mt-1">
          Select all times you can meet over the next 14 days (excluding the
          next 2 days). The tutor will choose one time from your selection.
        </p>

        <div className="mt-6">
          {/* No cap on total selectable minutes for tutee availability */}
          <TwoWeekTimeGrid value={selection} onChange={setSelection} />
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium mb-3">
            Desired session length
          </label>
          <div className="relative">
            {/* Slider track */}
            <div className="w-full h-2 bg-gray-200 rounded-full relative">
              {/* Progress fill */}
              <div
                className="h-2 bg-blue-600 rounded-full transition-all duration-200 ease-out"
                style={{
                  width: `${((desiredDuration - 30) / (180 - 30)) * 100}%`,
                }}
              />
              {/* Slider thumb */}
              <div
                className="absolute top-1/2 transform -translate-y-1/2 w-6 h-6 bg-white border-2 border-blue-600 rounded-full shadow-lg cursor-pointer hover:scale-110 transition-transform duration-150"
                style={{
                  left: `calc(${
                    ((desiredDuration - 30) / (180 - 30)) * 100
                  }% - 12px)`,
                }}
              />
            </div>

            {/* Hidden range input for functionality */}
            <input
              type="range"
              min="30"
              max="180"
              step="30"
              value={desiredDuration}
              onChange={(e) => setDesiredDuration(Number(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />

            {/* Time markers */}
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>30 min</span>
              <span>60 min</span>
              <span>90 min</span>
              <span>120 min</span>
              <span>150 min</span>
              <span>180 min</span>
            </div>

            {/* Current value display */}
            <div className="text-center mt-3">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-600">
                {desiredDuration} minutes
              </span>
            </div>
          </div>
        </div>

        {error && <div className="mt-4 text-red-600 text-sm">{error}</div>}

        <div className="mt-6 flex w-full gap-4 mb-20 mt-20">
          <button
            onClick={() => router.push("/tutee/dashboard")}
            className="flex-1 px-4 py-3 text-gray-700 bg-gray-200 rounded-md font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-3 bg-blue-100 text-blue-600 rounded-md font-medium"
          >
            {saving ? "Saving..." : "Save Availability"}
          </button>
        </div>
      </div>
    </TuteeLayout>
  );
}
