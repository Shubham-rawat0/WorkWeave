"use client";

import { useState } from "react";
import {
  ConfigFooter,
  ResponseNameField,
  TextField,
  type ConfigProps,
} from "../shared/formFields";

export function WebhookTriggerConfig({
  nodeId,
  data,
  onSave,
}: ConfigProps & { nodeId: string }) {
  const [secret, setSecret] = useState(data.secret || "");
  const [routeKey, setRouteKey] = useState(data.routeKey || "");
  const [responseName, setResponseName] = useState(data.responseName || "");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({
      secret: secret || undefined,
      routeKey: routeKey || undefined,
      responseName: responseName || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="break-all text-xs text-white/50">
        Webhook endpoint: /api/v1/webhooks/{nodeId}
      </p>
      <TextField
        label="Secret"
        value={secret}
        onChange={setSecret}
        placeholder="Optional shared secret"
        optional
        type="password"
      />
      <TextField
        label="Route Key"
        value={routeKey}
        onChange={setRouteKey}
        placeholder="Optional event key"
        optional
      />
      <ResponseNameField value={responseName} onChange={setResponseName} />
      <ConfigFooter missingFields={[]} disabled={false} />
    </form>
  );
}
