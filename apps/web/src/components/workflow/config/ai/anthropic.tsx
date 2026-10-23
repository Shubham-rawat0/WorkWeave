"use client";

import { AIConfigForm } from "./aiConfigForm";
import type { ConfigProps } from "../shared/formFields";

export function AnthropicConfig(props: ConfigProps) {
  return <AIConfigForm {...props} provider="anthropic" />;
}
