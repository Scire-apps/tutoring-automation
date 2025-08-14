// @ts-nocheck

'use client';

import React, { useMemo, useRef, useState } from 'react';

type DayKey = 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat';

export type WeeklySelection = {
  [day in DayKey]?: Array<{ start: string; end: string }>; // HH:MM ranges
};

type AllowedMap = {
  [day in DayKey]?: Array<{ start: string; end: string }>; // restrict selection
};

interface WeeklyTimeGridProps {
  startHour?: number; // 0-23
  endHour?: number;   // 1-24
  stepMinutes?: number; // e.g., 30
  value: WeeklySelection;
  onChange: (next: WeeklySelection) => void;
  allowed?: AllowedMap; // optional mask to constrain selectable cells
  maxMinutesPerSession?: number; // limit total selected minutes for this grid
  disallowedDays?: DayKey[]; // days forbidden (e.g., already used by other sessions)
  className?: string;
}

const DAY_KEYS: DayKey[] = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export function WeeklyTimeGrid({ startHour = 7, endHour = 22, stepMinutes = 30, value, onChange, allowed, maxMinutesPerSession, disallowedDays, className }: WeeklyTimeGridProps) {
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
  const dragDayRef = useRef<DayKey | null>(null);
  const dragStartRef = useRef<number | null>(null);

  const isAllowed = (day: DayKey, slotIndex: number) => {
    if (disallowedDays && disallowedDays.includes(day)) return false;
    if (!allowed) return true;
    const time = rows[slotIndex];
    const endIdx = slotIndex + 1 < rows.length ? slotIndex + 1 : slotIndex;
    const end = rows[endIdx];
    const ranges = allowed[day] || [];
    return ranges.some(r => time >= r.start && end <= r.end);
  };

  const getDayRanges = (day: DayKey): Array<{ start: string; end: string }> => {
    return (value[day] || []).slice();
  };

  const setDayRanges = (day: DayKey, ranges: Array<{ start: string; end: string }>) => {
    const next: WeeklySelection = { ...value, [day]: mergeRanges(sortRanges(ranges)) };
    onChange(next);
  };

  const toggleSlot = (day: DayKey, slotIndex: number) => {
    if (!isAllowed(day, slotIndex)) return;
    const start = rows[slotIndex];
    const end = rows[slotIndex + 1] || rows[slotIndex];
    const ranges = getDayRanges(day);
    // If within existing range -> remove that tiny block; otherwise add
    const idx = ranges.findIndex(r => start >= r.start && end <= r.end);
    if (idx >= 0) {
      const r = ranges[idx];
      const newRanges: Array<{ start: string; end: string }> = [];
      if (r.start < start) newRanges.push({ start: r.start, end: start });
      if (end < r.end) newRanges.push({ start: end, end: r.end });
      ranges.splice(idx, 1, ...newRanges);
      setDayRanges(day, ranges);
    } else {
      ranges.push({ start, end });
      const merged = mergeRanges(ranges);
      if (maxMinutesPerSession) {
        const total = merged.reduce((acc, r) => acc + diffMinutes(r.start, r.end), 0);
        if (total > maxMinutesPerSession) return; // prevent exceeding limit
      }
      setDayRanges(day, merged);
    }
  };

  const onMouseDownCell = (day: DayKey, slotIndex: number) => {
    if (!isAllowed(day, slotIndex)) return;
    setIsDragging(true);
    dragDayRef.current = day;
    dragStartRef.current = slotIndex;
    toggleSlot(day, slotIndex);
  };

  const onMouseEnterCell = (day: DayKey, slotIndex: number) => {
    if (!isDragging) return;
    if (dragDayRef.current !== day) return;
    toggleSlot(day, slotIndex);
  };

  const onMouseUpGrid = () => {
    setIsDragging(false);
    dragDayRef.current = null;
    dragStartRef.current = null;
  };

  const isSelected = (day: DayKey, slotIndex: number) => {
    const start = rows[slotIndex];
    const end = rows[slotIndex + 1] || rows[slotIndex];
    return (value[day] || []).some(r => start >= r.start && end <= r.end);
  };

  return (
    <div className={className} onMouseLeave={onMouseUpGrid}>
      <div className="overflow-auto border rounded">
        <table className="min-w-full border-collapse select-none">
          <thead>
            <tr>
              <th className="sticky left-0 bg-white z-10 text-xs text-gray-500 font-medium px-2 py-1 border-b">Time</th>
              {DAY_KEYS.map(day => (
                <th key={day} className="text-xs text-gray-600 font-medium px-2 py-1 border-b">{day}</th>
              ))}
            </tr>
          </thead>
          <tbody onMouseUp={onMouseUpGrid}>
            {rows.map((t, rowIdx) => (
              <tr key={t}>
                <td className="sticky left-0 bg-white z-10 text-[11px] text-gray-500 px-2 py-1 border-b">{t}</td>
                {DAY_KEYS.map((day) => {
                  const selected = isSelected(day, rowIdx);
                  const allowedHere = isAllowed(day, rowIdx);
                  return (
                    <td
                      key={`${day}-${t}`}
                      onMouseDown={() => onMouseDownCell(day, rowIdx)}
                      onMouseEnter={() => onMouseEnterCell(day, rowIdx)}
                      className={
                        `h-6 border-b border-l cursor-pointer ` +
                        (selected
                          ? 'bg-blue-500/80'
                          : allowedHere
                            ? 'bg-green-50 hover:bg-green-100'
                            : 'bg-gray-100 cursor-not-allowed')
                      }
                      title={`${day} ${t}`}
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

function sortRanges(ranges: Array<{ start: string; end: string }>) {
  return ranges
    .filter(r => r.start && r.end && r.start < r.end)
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
}

function mergeRanges(ranges: Array<{ start: string; end: string }>) {
  const sorted = sortRanges(ranges);
  const merged: Array<{ start: string; end: string }> = [];
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

export function compressSelectionToWeeklyMap(selection: WeeklySelection): { [k: string]: string[] } {
  const out: { [k: string]: string[] } = {};
  Object.entries(selection).forEach(([day, ranges]) => {
    if (!ranges || !ranges.length) return;
    out[day] = ranges.map(r => `${r.start}-${r.end}`);
  });
  return out;
}

function diffMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}


