"use client";

import { useState } from "react";
import {
  ConfigFooter,
  ResponseNameField,
  SelectField,
  TextField,
  type ConfigProps,
} from "../shared/formFields";

const OPERATORS = [
  { value: "equals", label: "Equals" },
  { value: "contains", label: "Contains" },
  { value: "not_equals", label: "Does not equal" },
  { value: "exists", label: "Exists" },
];

export function FilterConfig({ data, onSave }: ConfigProps) {
  const [expression, setExpression] = useState(data.expression || "");
  const [operator, setOperator] = useState(data.operator || "equals");
  const [value, setValue] = useState(data.value || "");
  const [responseName, setResponseName] = useState(data.responseName || "");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({
      expression,
      operator,
      value: operator === "exists" ? undefined : value,
      responseName: responseName || undefined,
    });
  }

  const missingFields = expression.trim() ? [] : ["Expression"];
  if (operator !== "exists" && !value.trim()) missingFields.push("Value");

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TextField
        label="Expression"
        value={expression}
        onChange={setExpression}
        placeholder="{{previousNode.data.status}}"
      />
      <SelectField
        label="Operator"
        value={operator}
        onChange={setOperator}
        options={OPERATORS}
      />
      {operator !== "exists" && (
        <TextField label="Compare To" value={value} onChange={setValue} />
      )}
      <ResponseNameField value={responseName} onChange={setResponseName} />
      <ConfigFooter
        missingFields={missingFields}
        disabled={missingFields.length > 0}
      />
    </form>
  );
}
