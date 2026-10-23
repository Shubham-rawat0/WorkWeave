"use client";

import { useState } from "react";
import { ConfigFooter, TextAreaField, type ConfigProps } from "../shared/formFields";

export function TriggerConfig({ data, onSave }: ConfigProps) {
  const [payload, setPayload] = useState(
    data.payload ? JSON.stringify(data.payload, null, 2) : "{}",
  );
  const [parseError, setParseError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const parsedPayload: unknown = JSON.parse(payload || "{}");
      if (
        typeof parsedPayload !== "object" ||
        parsedPayload === null ||
        Array.isArray(parsedPayload)
      ) {
        throw new Error("Payload must be a JSON object.");
      }
      setParseError(null);
      onSave({ payload: parsedPayload });
    } catch (error) {
      setParseError(
        error instanceof Error ? error.message : "Invalid payload JSON.",
      );
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TextAreaField
        label="Trigger Payload (JSON)"
        value={payload}
        onChange={(value) => {
          setPayload(value);
          setParseError(null);
        }}
        placeholder="{}"
        rows={7}
      />
      <p className="text-xs text-white/40">
        The payload is available to downstream nodes when the workflow starts.
      </p>
      {parseError && (
        <p role="alert" className="text-sm text-red-400">
          {parseError}
        </p>
      )}
      <ConfigFooter missingFields={[]} disabled={Boolean(parseError)} />
    </form>
  );
}
