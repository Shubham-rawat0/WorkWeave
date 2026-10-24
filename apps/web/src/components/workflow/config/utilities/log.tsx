"use client";

import { useState } from "react";
import {
  ConfigFooter,
  ResponseNameField,
  SelectField,
  TextAreaField,
  type ConfigProps,
} from "../shared/formFields";

const LEVELS = [
  { value: "debug", label: "Debug" },
  { value: "info", label: "Info" },
  { value: "warn", label: "Warning" },
  { value: "error", label: "Error" },
];

export function LogConfig({ data, onSave }: ConfigProps) {
  const [message, setMessage] = useState(data.message || "");
  const [level, setLevel] = useState(data.level || "info");
  const [responseName, setResponseName] = useState(data.responseName || "");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({
      message,
      level,
      responseName: responseName || undefined,
    });
  }

  const missingFields = message.trim() ? [] : ["Message"];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TextAreaField
        label="Message"
        value={message}
        onChange={setMessage}
        placeholder="Processed {{previousNode.id}}"
      />
      <p className="text-xs text-white/40">
        Use {"{{previousNode.field}}"} to reference output from the single node
        connected directly before this node.
      </p>
      <SelectField
        label="Log Level"
        value={level}
        onChange={setLevel}
        options={LEVELS}
      />
      <ResponseNameField value={responseName} onChange={setResponseName} />
      <ConfigFooter
        missingFields={missingFields}
        disabled={missingFields.length > 0}
      />
    </form>
  );
}
