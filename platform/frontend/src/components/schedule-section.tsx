"use client";

import { useCallback, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type ScheduleMode = "hourly" | "daily";

export const DEFAULT_CRON = "0 9 * * 1-5";

const WEEKDAYS = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 0 },
] as const;

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: String(i),
  label: `${String(i).padStart(2, "0")}:00`,
}));

export function parseCronToMode(cron: string): {
  mode: ScheduleMode;
  hour: string;
  minute: string;
  days: number[];
} {
  const parts = cron.trim().split(/\s+/);
  const defaults = {
    hour: "9",
    minute: "0",
    days: [1, 2, 3, 4, 5],
  };

  if (parts.length !== 5) {
    return { mode: "daily", ...defaults };
  }

  const [min, hr, , , dow] = parts;

  // Hourly: "0 * * * *" or "N * * * *"
  if (hr === "*" && dow === "*") {
    return { mode: "hourly", ...defaults };
  }

  // Daily: specific hour, days pattern
  if (hr !== "*" && !hr.includes("/")) {
    const dayList =
      dow === "*"
        ? [0, 1, 2, 3, 4, 5, 6]
        : dow.split(",").flatMap((part) => {
            if (part.includes("-")) {
              const [start, end] = part.split("-").map(Number);
              const result: number[] = [];
              for (let i = start; i <= end; i++) result.push(i);
              return result;
            }
            return [Number(part)];
          });

    return {
      mode: "daily",
      hour: hr,
      minute: min,
      days: dayList,
    };
  }

  return { mode: "daily", ...defaults };
}

export function buildCronFromSchedule(
  mode: ScheduleMode,
  hour: string,
  minute: string,
  days: number[],
): string {
  switch (mode) {
    case "hourly":
      return `${minute} * * * *`;
    case "daily": {
      const sorted = [...days].sort((a, b) => a - b);
      const dowPart =
        sorted.length === 7 || sorted.length === 0 ? "*" : sorted.join(",");
      return `${minute} ${hour} * * ${dowPart}`;
    }
  }
}

export function ScheduleSection({
  cronExpression,
  onCronExpressionChange,
}: {
  cronExpression: string;
  onCronExpressionChange: (value: string) => void;
}) {
  const parsed = useMemo(
    () => parseCronToMode(cronExpression),
    [cronExpression],
  );
  const [mode, setMode] = useState<ScheduleMode>(parsed.mode);
  const [hour, setHour] = useState(parsed.hour);
  const [minute] = useState(parsed.minute);
  const [days, setDays] = useState<number[]>(parsed.days);

  const updateCron = useCallback(
    (
      newMode: ScheduleMode,
      newHour: string,
      newMinute: string,
      newDays: number[],
    ) => {
      onCronExpressionChange(
        buildCronFromSchedule(newMode, newHour, newMinute, newDays),
      );
    },
    [onCronExpressionChange],
  );

  const handleModeChange = (newMode: ScheduleMode) => {
    setMode(newMode);
    updateCron(newMode, hour, minute, days);
  };

  const handleHourChange = (newHour: string) => {
    setHour(newHour);
    updateCron(mode, newHour, minute, days);
  };

  const handleDayToggle = (day: number) => {
    const newDays = days.includes(day)
      ? days.filter((d) => d !== day)
      : [...days, day];
    if (newDays.length === 0) return;
    setDays(newDays);
    updateCron(mode, hour, minute, newDays);
  };

  return (
    <div className="space-y-3">
      <Label>Schedule</Label>

      <div className="flex gap-1 rounded-md border p-1">
        {(["hourly", "daily"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => handleModeChange(m)}
            className={cn(
              "flex-1 rounded-sm px-2 py-1.5 text-xs font-medium capitalize transition-colors",
              mode === m
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {m}
          </button>
        ))}
      </div>

      {mode === "daily" && (
        <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2">
          <Label className="self-end">Repeat on</Label>
          <Label className="self-end">Time</Label>
          <div className="flex gap-1">
            {WEEKDAYS.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => handleDayToggle(d.value)}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-md border text-xs font-medium transition-colors",
                  days.includes(d.value)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input text-muted-foreground hover:bg-muted",
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
          <Select value={hour} onValueChange={handleHourChange}>
            <SelectTrigger className="w-[90px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOURS.map((h) => (
                <SelectItem key={h.value} value={h.value}>
                  {h.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
