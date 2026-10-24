"use client";

import { useState } from "react";
import {
  ConfigFooter,
  CredentialSelect,
  ResponseNameField,
  SelectField,
  TextAreaField,
  TextField,
  type ConfigProps,
} from "../shared/formFields";

type AIProvider = "openai" | "gemini" | "anthropic";

const PROVIDER_CONFIG: Record<
  AIProvider,
  { name: string; models: Array<{ value: string; label: string }> }
> = {
  openai: {
    name: "OpenAI",
    models: [
      { value: "gpt-4.1", label: "GPT-4.1" },
      { value: "gpt-4.1-mini", label: "GPT-4.1 mini" },
      { value: "gpt-4.1-nano", label: "GPT-4.1 nano" },
      { value: "gpt-4o", label: "GPT-4o" },
      { value: "o3", label: "o3" },
    ],
  },
  gemini: {
    name: "Gemini",
    models: [
      { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    ],
  },
  anthropic: {
    name: "Anthropic",
    models: [
      { value: "claude-opus-4-6", label: "Claude Opus 4.6" },
      { value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
      { value: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
      { value: "claude-sonnet-4-0", label: "Claude Sonnet 4" },
      { value: "claude-opus-4-0", label: "Claude Opus 4" },
    ],
  },
};

const JSON_PLACEHOLDERS: Record<AIProvider, string> = {
  openai: `{
  "messages": [
    { "role": "user", "content": "Summarize this: {json incidentPayload}" }
  ]
}`,
  gemini: `{
  "contents": [
    { "parts": [{ "text": "Summarize this: {json incidentPayload}" }] }
  ]
}`,
  anthropic: `{
  "messages": [
    { "role": "user", "content": "Summarize this incident: {json incidentPayload}" }
  ]
}`,
};

export function AIConfigForm({
  provider,
  data,
  onSave,
}: ConfigProps & { provider: AIProvider }) {
  const providerConfig = PROVIDER_CONFIG[provider];
  const [responseName, setResponseName] = useState(
    data.responseName || `${provider}Response`,
  );
  const [credentialId, setCredentialId] = useState(data.credentialId || "");
  const [model, setModel] = useState(data.model || "");
  const [systemPrompt, setSystemPrompt] = useState(data.systemPrompt || "");
  const [inputMode, setInputMode] = useState<"prompt" | "json">(
    data.inputMode === "json" ? "json" : "prompt",
  );
  const [prompt, setPrompt] = useState(data.prompt || "");
  const [requestJson, setRequestJson] = useState(data.requestJson || "");
  const [temperature, setTemperature] = useState(data.temperature ?? 0.7);
  const [maxTokens, setMaxTokens] = useState(
    data.maxTokens == null ? "" : String(data.maxTokens),
  );

  const inputMissing =
    inputMode === "json" ? !requestJson.trim() : !prompt.trim();
  const missingFields: string[] = [];
  if (!responseName.trim()) missingFields.push("Response Name");
  if (!credentialId) missingFields.push("Credential");
  if (!model.trim()) missingFields.push("Model");
  if (inputMissing) {
    missingFields.push(inputMode === "json" ? "JSON Input" : "Prompt");
  }

  function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({
      responseName,
      credentialId,
      model,
      systemPrompt,
      inputMode,
      prompt,
      requestJson,
      temperature,
      maxTokens: maxTokens ? Number.parseInt(maxTokens, 10) : undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ResponseNameField
        value={responseName}
        onChange={setResponseName}
        fallback={`${provider}Response`}
        optional={false}
      />
      <CredentialSelect
        platform={provider}
        value={credentialId}
        onChange={setCredentialId}
      />
      <TextField
        label="Model"
        value={model}
        onChange={setModel}
        placeholder={`e.g. ${providerConfig.models[0]?.value}`}
        list={`${provider}-model-options`}
      />
      <datalist id={`${provider}-model-options`}>
        {providerConfig.models.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </datalist>
      <p className="-mt-3 text-xs text-white/40">
        Type any {providerConfig.name} model id, including newer releases.
      </p>
      <TextAreaField
        label="System Prompt"
        value={systemPrompt}
        onChange={setSystemPrompt}
        placeholder="You are a helpful assistant."
        optional
        rows={3}
      />
      <SelectField
        label="Input Mode"
        value={inputMode}
        onChange={(value) => setInputMode(value as "prompt" | "json")}
        options={[
          { value: "prompt", label: "Prompt Template" },
          { value: "json", label: "JSON Request" },
        ]}
      />
      {inputMode === "prompt" ? (
        <TextAreaField
          label="Prompt"
          value={prompt}
          onChange={setPrompt}
          placeholder="What is the capital of France?"
          rows={3}
        />
      ) : (
        <TextAreaField
          label="JSON Input"
          value={requestJson}
          onChange={setRequestJson}
          placeholder={JSON_PLACEHOLDERS[provider]}
          rows={8}
        />
      )}
      <div className="space-y-2">
        <label className="text-sm text-white/80">
          Temperature: {temperature}
        </label>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={temperature}
          onChange={(event) => setTemperature(Number.parseFloat(event.target.value))}
          className="w-full accent-white"
        />
        <div className="flex justify-between text-xs text-white/30">
          <span>Precise (0)</span>
          <span>Creative (2)</span>
        </div>
      </div>
      <TextField
        label="Max Tokens"
        value={maxTokens}
        onChange={setMaxTokens}
        placeholder="Default (model max)"
        optional
        type="number"
        min={1}
      />
      <ConfigFooter
        missingFields={missingFields}
        disabled={
          missingFields.length > 0 ||
          (maxTokens !== "" &&
            (!Number.isInteger(Number(maxTokens)) || Number(maxTokens) <= 0))
        }
      />
    </form>
  );
}
