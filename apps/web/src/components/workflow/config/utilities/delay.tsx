"use client";

import { useState } from "react";
import {
  ConfigFooter,
  ResponseNameField,
  TextField,
  type ConfigProps,
} from "../shared/formFields";

export function DelayConfig({ data, onSave }: ConfigProps) {
  const [durationMs, setDurationMs] = useState(
    data.durationMs == null ? "" : String(data.durationMs),
  );
  const [responseName, setResponseName] = useState(data.responseName || "");
  const validDuration =
    Number.isFinite(Number(durationMs)) && Number(durationMs) > 0;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({
      durationMs: Number(durationMs),
      responseName: responseName || undefined,
    });
  }

  const missingFields = validDuration ? [] : ["Duration"];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TextField
        label="Duration (ms)"
        value={durationMs}
        onChange={setDurationMs}
        placeholder="1000"
        type="number"
        min={1}
      />
      <p className="text-xs text-white/40">
        The delay is capped by the worker&apos;s configured maximum duration.
      </p>
      <ResponseNameField value={responseName} onChange={setResponseName} />
      <ConfigFooter
        missingFields={missingFields}
        disabled={!validDuration}
      />
    </form>
  );
}
