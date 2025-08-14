// @ts-nocheck

'use client';

import React, { useMemo, useRef, useState } from 'react';

type Range = { start: string; end: string };

export type DateSelection = { [date: string]: Range[] };
export type AllowedDateMap = { [date: string]: Range[] };

interface TwoWeekTimeGridProps {
  startHour?: number;
  endHour?: number;
  stepMinutes?: number;
  value: DateSelection;
  onChange: (next: DateSelection) => void;
  allowed?: AllowedDateMap;
  maxMinutesPerSession?: number;
  className?: string;
  singleDayOnly?: boolean;        // if true, only one date may have selection
  singleContiguousRange?: boolean; // if true, at most one contiguous range per date
}

function formatDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function computeDateColumns(): string[] {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const cols: string[] = [];
  for (let i = 2; i < 16; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cols.push(formatDateKey(d));
  }
  return cols;
}

export function TwoWeekTimeGrid({ startHour = 7, endHour = 22, stepMinutes = 30, value, onChange, allowed, maxMinutesPerSession, className, singleDayOnly, singleContiguousRange }: TwoWeekTimeGridProps) {
  const dateCols = useMemo(() => computeDateColumns(), []);

  const rows = useMemo(() => {
    const out: string[] = [];
    const totalSteps = ((endHour - startHour) * 60) / stepMinutes;
    for (let i = 0; i < totalSteps; i++) {
      const minutes = startHour * 60 + i * stepMinutes;
      const hh = Math.floor(minutes / 60);
      const mm = minutes % 60;
      const label = `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
      out.push(label);
    }
    return out;
  }, [startHour, endHour, stepMinutes]);

  const [isDragging, setIsDragging] = useState(false);
  const dragDateRef = useRef<string | null>(null);

  const isAllowed = (date: string, slotIndex: number) => {
    if (!allowed) return true;
    const time = rows[slotIndex];
    const endIdx = slotIndex + 1 < rows.length ? slotIndex + 1 : slotIndex;
    const end = rows[endIdx];
    const ranges = allowed[date] || [];
    return ranges.some(r => time >= r.start && end <= r.end);
  };

  const getDateRanges = (date: string): Range[] => {
    return (value[date] || []).slice();
  };

  const setDateRanges = (date: string, ranges: Range[], lastStart?: string, lastEnd?: string) => {
    let merged = mergeRanges(sortRanges(ranges));
    if (singleContiguousRange && merged.length > 1) {
      // Keep only the range that contains the last toggled slot
      const chosenIdx = merged.findIndex(r => lastStart! >= r.start && (lastEnd || lastStart!) <= r.end);
      merged = chosenIdx >= 0 ? [merged[chosenIdx]] : [merged[0]];
    }
    let next: DateSelection = { ...value, [date]: merged };
    if (singleDayOnly) {
      // Clear other dates
      next = Object.keys(next).reduce((acc: DateSelection, key) => {
        if (key === date) acc[key] = next[key]; else acc[key] = [];
        return acc;
      }, {} as DateSelection);
    }
    onChange(next);
  };

  const toggleSlot = (date: string, slotIndex: number) => {
    if (!isAllowed(date, slotIndex)) return;
    const start = rows[slotIndex];
    const end = rows[slotIndex + 1] || rows[slotIndex];
    const ranges = getDateRanges(date);
    const idx = ranges.findIndex(r => start >= r.start && end <= r.end);
    if (idx >= 0) {
      const r = ranges[idx];
      const newRanges: Range[] = [];
      if (r.start < start) newRanges.push({ start: r.start, end: start });
      if (end < r.end) newRanges.push({ start: end, end: r.end });
      ranges.splice(idx, 1, ...newRanges);
      setDateRanges(date, ranges, start, end);
    } else {
      ranges.push({ start, end });
      const merged = mergeRanges(ranges);
      if (maxMinutesPerSession) {
        const total = merged.reduce((acc, r) => acc + diffMinutes(r.start, r.end), 0);
        if (total > maxMinutesPerSession) return;
      }
      setDateRanges(date, merged, start, end);
    }
  };

  const onMouseDownCell = (date: string, slotIndex: number) => {
    if (!isAllowed(date, slotIndex)) return;
    setIsDragging(true);
    dragDateRef.current = date;
    toggleSlot(date, slotIndex);
  };

  const onMouseEnterCell = (date: string, slotIndex: number) => {
    if (!isDragging) return;
    if (dragDateRef.current !== date) return;
    toggleSlot(date, slotIndex);
  };

  const onMouseUpGrid = () => {
    setIsDragging(false);
    dragDateRef.current = null;
  };

  const isSelected = (date: string, slotIndex: number) => {
    const start = rows[slotIndex];
    const end = rows[slotIndex + 1] || rows[slotIndex];
    return (value[date] || []).some(r => start >= r.start && end <= r.end);
  };

  return (
    <div className={className} onMouseLeave={onMouseUpGrid}>
      <div className="overflow-auto border rounded">
        <table className="min-w-full border-collapse select-none">
          <thead>
            <tr>
              <th className="sticky left-0 bg-white z-10 text-xs text-gray-500 font-medium px-2 py-1 border-b">Time</th>
              {dateCols.map(date => (
                <th key={date} className="text-xs text-gray-600 font-medium px-2 py-1 border-b">
                  {new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody onMouseUp={onMouseUpGrid}>
            {rows.map((t, rowIdx) => (
              <tr key={t}>
                <td className="sticky left-0 bg-white z-10 text-[11px] text-gray-500 px-2 py-1 border-b">{t}</td>
                {dateCols.map((date) => {
                  const selected = isSelected(date, rowIdx);
                  const allowedHere = isAllowed(date, rowIdx);
                  return (
                    <td
                      key={`${date}-${t}`}
                      onMouseDown={() => onMouseDownCell(date, rowIdx)}
                      onMouseEnter={() => onMouseEnterCell(date, rowIdx)}
                      className={
                        `h-6 border-b border-l cursor-pointer ` +
                        (selected
                          ? 'bg-blue-500/80'
                          : allowedHere
                            ? 'bg-green-50 hover:bg-green-100'
                            : 'bg-gray-100 cursor-not-allowed')
                      }
                      title={`${date} ${t}`}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-xs text-gray-500">Drag to select time blocks. Click again to remove.</div>
    </div>
  );
}

function sortRanges(ranges: Range[]) {
  return ranges
    .filter(r => r.start && r.end && r.start < r.end)
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
}

function mergeRanges(ranges: Range[]) {
  const sorted = sortRanges(ranges);
  const merged: Range[] = [];
  for (const r of sorted) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push({ ...r });
    } else if (r.start <= last.end) {
      if (r.end > last.end) last.end = r.end;
    } else {
      merged.push({ ...r });
    }
  }
  return merged;
}

export function compressSelectionToDateMap(selection: DateSelection): { [date: string]: string[] } {
  const out: { [date: string]: string[] } = {};
  Object.entries(selection).forEach(([date, ranges]) => {
    if (!ranges || !ranges.length) return;
    out[date] = ranges.map(r => `${r.start}-${r.end}`);
  });
  return out;
}

function diffMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}


