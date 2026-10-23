"use client";

import { useState } from "react";
import {
  ConfigFooter,
  ResponseNameField,
  SelectField,
  TextAreaField,
  TextField,
  type ConfigProps,
} from "../shared/formFields";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

export function HTTPConfig({ data, onSave }: ConfigProps) {
  const [url, setUrl] = useState(data.url || "");
  const [method, setMethod] = useState(data.method || "GET");
  const [headers, setHeaders] = useState(
    data.headers ? JSON.stringify(data.headers, null, 2) : "",
  );
  const [body, setBody] = useState(
    data.body == null
      ? ""
      : typeof data.body === "string"
        ? data.body
        : JSON.stringify(data.body, null, 2),
  );
  const [timeout, setTimeout] = useState(
    data.timeout == null ? "" : String(data.timeout),
  );
  const [responseName, setResponseName] = useState(data.responseName || "");
  const [parseError, setParseError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setParseError(null);
    let parsedHeaders: Record<string, string> | undefined;
    let parsedBody: unknown;
    try {
      parsedHeaders = headers.trim()
        ? (JSON.parse(headers) as Record<string, string>)
        : undefined;
      if (
        parsedHeaders &&
        (typeof parsedHeaders !== "object" || Array.isArray(parsedHeaders))
      ) {
        throw new Error("Headers must be a JSON object.");
      }
      parsedBody = body.trim() ? JSON.parse(body) : undefined;
    } catch (error) {
      setParseError(
        error instanceof Error ? error.message : "Invalid JSON in request data.",
      );
      return;
    }
    onSave({
      url,
      method,
      headers: parsedHeaders,
      body: parsedBody,
      timeout: timeout ? Number(timeout) : undefined,
      responseName: responseName || undefined,
    });
  }

  const missingFields = url.trim() ? [] : ["URL"];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TextField
        label="Request URL"
        value={url}
        onChange={setUrl}
        placeholder="https://api.example.com/resource"
      />
      <SelectField
        label="Method"
        value={method}
        onChange={setMethod}
        options={METHODS.map((value) => ({ value, label: value }))}
      />
      <TextAreaField
        label="Headers (JSON)"
        value={headers}
        onChange={setHeaders}
        placeholder={'{\n  "Content-Type": "application/json"\n}'}
        optional
        rows={4}
      />
      <TextAreaField
        label="Body (JSON)"
        value={body}
        onChange={setBody}
        placeholder={'{\n  "key": "value"\n}'}
        optional
        rows={5}
      />
      <TextField
        label="Timeout (ms)"
        value={timeout}
        onChange={setTimeout}
        placeholder="Default"
        optional
        type="number"
        min={1}
      />
      <ResponseNameField value={responseName} onChange={setResponseName} />
      {parseError && (
        <p role="alert" className="text-sm text-red-400">
          {parseError}
        </p>
      )}
      <ConfigFooter missingFields={missingFields} disabled={!url.trim()} />
    </form>
  );
}
