"use client";

import { useEffect, useState } from "react";
import { api, type CredentialSummary } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ValidationMessage } from "../../shared/validationMessage";

const inputClassName =
  "bg-[#2D2D2E] border-[#444] text-white placeholder:text-white/30";
const textAreaClassName =
  "w-full rounded-md border border-[#444] bg-[#2D2D2E] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-ring resize-y";
const selectClassName =
  "w-full h-9 rounded-md border border-[#444] bg-[#2D2D2E] px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-ring";

export interface ConfigProps {
  data: Record<string, any>;
  onSave: (data: Record<string, any>) => void;
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  optional?: boolean;
  type?: string;
  min?: number;
  max?: number;
  step?: number;
  list?: string;
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  optional,
  type = "text",
  min,
  max,
  step,
  list,
}: FieldProps) {
  return (
    <div className="space-y-2">
      <Label className="text-white/80">
        {label}
        {optional && <span className="text-white/40"> (optional)</span>}
      </Label>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        list={list}
        className={inputClassName}
      />
    </div>
  );
}

interface TextAreaFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  optional?: boolean;
  rows?: number;
}

export function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  optional,
  rows = 4,
}: TextAreaFieldProps) {
  return (
    <div className="space-y-2">
      <Label className="text-white/80">
        {label}
        {optional && <span className="text-white/40"> (optional)</span>}
      </Label>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={textAreaClassName}
      />
    </div>
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  optional?: boolean;
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  optional,
}: SelectFieldProps) {
  return (
    <div className="space-y-2">
      <Label className="text-white/80">
        {label}
        {optional && <span className="text-white/40"> (optional)</span>}
      </Label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={selectClassName}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ResponseNameField({
  value,
  onChange,
  fallback = "nodeResponse",
  optional = true,
}: {
  value: string;
  onChange: (value: string) => void;
  fallback?: string;
  optional?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-white/80">
        Response Name
        {optional && <span className="text-white/40"> (optional)</span>}
      </Label>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={fallback}
        className={inputClassName}
      />
      <p className="text-xs text-white/40">
        Use this name to reference the response in other nodes:{" "}
        {`{{${value || fallback}.data}}`}
      </p>
    </div>
  );
}

export function CredentialSelect({
  platform,
  value,
  onChange,
}: {
  platform: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [credentials, setCredentials] = useState<CredentialSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    api
      .credentials()
      .then(({ credentials: loadedCredentials }) => {
        if (isCurrent) setCredentials(loadedCredentials);
      })
      .catch((requestError: unknown) => {
        if (isCurrent) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Failed to load credentials.",
          );
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  const platformCredentials = credentials.filter(
    (credential) => credential.platform === platform,
  );

  return (
    <div className="space-y-2">
      <Label className="text-white/80">Credential</Label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={selectClassName}
        disabled={isLoading}
      >
        <option value="">
          {isLoading ? "Loading credentials…" : "Select a credential"}
        </option>
        {platformCredentials.map((credential) => (
          <option key={credential.id} value={credential.id}>
            {credential.title}
          </option>
        ))}
      </select>
      {error ? (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      ) : (
        <p className="text-xs text-white/40">
          No credentials?{" "}
          <a
            href="/home/credentials"
            className="text-[#F04D26] hover:text-[#F04D26]/90 underline"
          >
            Add one in Credentials page
          </a>
        </p>
      )}
    </div>
  );
}

export function ConfigFooter({
  missingFields,
  disabled,
}: {
  missingFields: string[];
  disabled: boolean;
}) {
  return (
    <>
      <ValidationMessage missingFields={missingFields} />
      <button
        type="submit"
        disabled={disabled}
        className="w-full rounded-md bg-[#F04D26] px-4 py-2 text-sm font-medium text-white hover:bg-[#e04420] disabled:bg-[#F04D26]/50 disabled:text-white/70"
      >
        Save
      </button>
    </>
  );
}
