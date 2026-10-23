"use client";

import { useState } from "react";
import {
  ConfigFooter,
  CredentialSelect,
  TextAreaField,
  TextField,
  type ConfigProps,
} from "../shared/formFields";

export function SlackConfig({ data, onSave }: ConfigProps) {
  const [credentialId, setCredentialId] = useState(data.credentialId || "");
  const [webhookUrl, setWebhookUrl] = useState(data.webhookUrl || "");
  const [message, setMessage] = useState(data.message || "");
  const [channel, setChannel] = useState(data.channel || "");

  const missingFields: string[] = [];
  if (!message.trim()) missingFields.push("Message");
  if (!credentialId && !webhookUrl.trim()) {
    missingFields.push("Credential or Webhook URL");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({
      credentialId: credentialId || undefined,
      webhookUrl: webhookUrl || undefined,
      message,
      channel: channel || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <CredentialSelect
        platform="slack"
        value={credentialId}
        onChange={setCredentialId}
      />
      <TextField
        label="Webhook URL"
        value={webhookUrl}
        onChange={setWebhookUrl}
        placeholder="https://hooks.slack.com/services/..."
        optional
      />
      <TextField
        label="Channel"
        value={channel}
        onChange={setChannel}
        placeholder="#general"
        optional
      />
      <TextAreaField
        label="Message"
        value={message}
        onChange={setMessage}
        placeholder="Workflow completed: {{trigger.data}}"
        rows={4}
      />
      <ConfigFooter
        missingFields={missingFields}
        disabled={missingFields.length > 0}
      />
    </form>
  );
}
