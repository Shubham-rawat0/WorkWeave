"use client";

import { AIConfigForm } from "./aiConfigForm";
import type { ConfigProps } from "../shared/formFields";

export function OpenAIConfig(props: ConfigProps) {
  return <AIConfigForm {...props} provider="openai" />;
}
