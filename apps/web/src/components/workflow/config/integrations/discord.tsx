"use client";

import { useState } from "react";
import {
  ConfigFooter,
  TextAreaField,
  TextField,
  type ConfigProps,
} from "../shared/formFields";

export function DiscordConfig({ data, onSave }: ConfigProps) {
  const [webhookUrl, setWebhookUrl] = useState(data.webhookUrl || "");
  const [message, setMessage] = useState(data.message || "");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({ webhookUrl, message });
  }

  const missingFields = [];
  if (!webhookUrl.trim()) missingFields.push("Webhook URL");
  if (!message.trim()) missingFields.push("Message");

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TextField
        label="Discord Webhook URL"
        value={webhookUrl}
        onChange={setWebhookUrl}
        placeholder="https://discord.com/api/webhooks/..."
      />
      <TextAreaField
        label="Message"
        value={message}
        onChange={setMessage}
        rows={4}
      />
      <ConfigFooter
        missingFields={missingFields}
        disabled={missingFields.length > 0}
      />
    </form>
  );
}
