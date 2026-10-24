"use client";

import { useState } from "react";
import {
  ConfigFooter,
  ResponseNameField,
  TextAreaField,
  TextField,
  type ConfigProps,
} from "../shared/formFields";

export function ConditionConfig({ data, onSave }: ConfigProps) {
  const [expression, setExpression] = useState(data.expression || "");
  const [defaultRoute, setDefaultRoute] = useState(data.defaultRoute || "default");
  const [rulesJson, setRulesJson] = useState(
    data.rulesJson ||
      (data.rules ? JSON.stringify(data.rules, null, 2) : '[\n  {\n    "route": "matched",\n    "operator": "equals",\n    "value": "yes"\n  }\n]'),
  );
  const [responseName, setResponseName] = useState(data.responseName || "");
  const [parseError, setParseError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const rules: unknown = JSON.parse(rulesJson || "[]");
      if (
        !Array.isArray(rules) ||
        rules.some(
          (rule) =>
            !rule ||
            typeof rule.route !== "string" ||
            ![
              "equals",
              "contains",
              "not_equals",
            ].includes(rule.operator) ||
            typeof rule.value !== "string",
        )
      ) {
        throw new Error(
          'Rules must be a JSON array with route, operator, and value fields.',
        );
      }
      setParseError(null);
      onSave({
        expression,
        defaultRoute,
        routes: [
          ...new Set([
            ...rules.map((rule: { route: string }) => rule.route),
            defaultRoute,
          ]),
        ],
        rules,
        rulesJson,
        responseName: responseName || undefined,
      });
    } catch (error) {
      setParseError(
        error instanceof Error ? error.message : "Invalid rules JSON.",
      );
    }
  }

  const missingFields = [];
  if (!expression.trim()) missingFields.push("Expression");
  if (!defaultRoute.trim()) missingFields.push("Default Route");

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TextAreaField
        label="Value Expression"
        value={expression}
        onChange={setExpression}
        placeholder="{{previousNode.age}}"
        rows={3}
      />
      <p className="text-xs text-white/40">
        Use {"{{previousNode.field}}"} to reference output from the single node
        connected directly before this node.
      </p>
      <TextField
        label="Default Route"
        value={defaultRoute}
        onChange={setDefaultRoute}
        placeholder="default"
      />
      <TextAreaField
        label="Rules (JSON)"
        value={rulesJson}
        onChange={(value) => {
          setRulesJson(value);
          setParseError(null);
        }}
        rows={8}
      />
      <p className="text-xs text-white/40">
  {"Format: [{ route, operator: equals|contains|not_equals, value }]"}
</p>
      <ResponseNameField value={responseName} onChange={setResponseName} />
      {parseError && (
        <p role="alert" className="text-sm text-red-400">
          {parseError}
        </p>
      )}
      <ConfigFooter
        missingFields={missingFields}
        disabled={missingFields.length > 0 || Boolean(parseError)}
      />
    </form>
  );
}
