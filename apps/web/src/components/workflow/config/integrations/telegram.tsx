"use client";

import { useState } from "react";
import { ConfigFooter, CredentialSelect, TextAreaField, TextField, type ConfigProps } from "../shared/formFields";

export function TelegramConfig({ data, onSave }: ConfigProps) {
  const [credentialId, setCredentialId] = useState(data.credentialId || "");
  const [chatId, setChatId] = useState(data.chatId || "");
  const [message, setMessage] = useState(data.message || "");
  const missingFields: string[] = [];
  if (!credentialId) missingFields.push("Telegram bot credential");
  if (!chatId.trim()) missingFields.push("Chat ID");
  if (!message.trim()) missingFields.push("Message");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({ credentialId, chatId: chatId.trim(), message });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <CredentialSelect platform="telegram" value={credentialId} onChange={setCredentialId} />
      <TextField label="Chat ID" value={chatId} onChange={setChatId} placeholder="123456789, -1001234567890, or @channel" />
      <p className="-mt-2 text-xs text-white/40">The bot must have permission to message this user, group, or channel. Users need to start the bot first.</p>
      <TextAreaField label="Message" value={message} onChange={setMessage} placeholder="Workflow completed: {{trigger.data}}" rows={4} />
      <ConfigFooter missingFields={missingFields} disabled={missingFields.length > 0} />
    </form>
  );
}
