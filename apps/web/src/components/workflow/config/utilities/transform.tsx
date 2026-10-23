"use client";

import { useState } from "react";
import {
  ConfigFooter,
  ResponseNameField,
  TextAreaField,
  type ConfigProps,
} from "../shared/formFields";

export function TransformConfig({ data, onSave }: ConfigProps) {
  const [expression, setExpression] = useState(data.expression || "");
  const [responseName, setResponseName] = useState(data.responseName || "");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({
      expression,
      responseName: responseName || undefined,
    });
  }

  const missingFields = expression.trim() ? [] : ["Expression"];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TextAreaField
        label="Output Template"
        value={expression}
        onChange={setExpression}
        placeholder={'{\n  "id": "{{previousNode.data.id}}"\n}'}
        rows={7}
      />
      <p className="text-xs text-white/40">
        Valid JSON output is returned as an object; other output is returned as
        text.
      </p>
      <ResponseNameField value={responseName} onChange={setResponseName} />
      <ConfigFooter
        missingFields={missingFields}
        disabled={missingFields.length > 0}
      />
    </form>
  );
}
