"use client";

import { useState } from "react";
import {
  ConfigFooter,
  ResponseNameField,
  SelectField,
  TextField,
  type ConfigProps,
} from "../shared/formFields";

const SCHEDULES = [
  { value: "every_5_minutes", label: "Every 5 minutes" },
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
];

const DAYS = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

export function CronTriggerConfig({ data, onSave }: ConfigProps) {
  const [schedule, setSchedule] = useState(data.schedule || "daily");
  const [hour, setHour] = useState(String(data.hour ?? 9));
  const [minute, setMinute] = useState(String(data.minute ?? 0));
  const [dayOfWeek, setDayOfWeek] = useState(String(data.dayOfWeek ?? 1));
  const [responseName, setResponseName] = useState(data.responseName || "");

  const validTime =
    Number.isInteger(Number(hour)) &&
    Number(hour) >= 0 &&
    Number(hour) <= 23 &&
    Number.isInteger(Number(minute)) &&
    Number(minute) >= 0 &&
    Number(minute) <= 59;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({
      schedule,
      hour: Number(hour),
      minute: Number(minute),
      ...(schedule === "weekly" ? { dayOfWeek: Number(dayOfWeek) } : {}),
      timezone: "Asia/Kolkata",
      responseName: responseName || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <SelectField
        label="Schedule"
        value={schedule}
        onChange={setSchedule}
        options={SCHEDULES}
      />
      {(schedule === "daily" || schedule === "weekly") && (
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Hour"
            value={hour}
            onChange={setHour}
            type="number"
            min={0}
            max={23}
          />
          <TextField
            label="Minute"
            value={minute}
            onChange={setMinute}
            type="number"
            min={0}
            max={59}
          />
        </div>
      )}
      {schedule === "weekly" && (
        <SelectField
          label="Day of Week"
          value={dayOfWeek}
          onChange={setDayOfWeek}
          options={DAYS}
        />
      )}
      <div className="space-y-2">
        <p className="text-sm text-white/80">Timezone</p>
        <p className="text-sm text-white/60">
          India Standard Time (Asia/Kolkata, UTC+05:30)
        </p>
      </div>
      <ResponseNameField value={responseName} onChange={setResponseName} />
      {!validTime && (
        <p role="alert" className="text-sm text-red-400">
          Enter a valid hour (0–23) and minute (0–59).
        </p>
      )}
      <ConfigFooter missingFields={[]} disabled={!validTime} />
    </form>
  );
}
