import { parseTemplate, parseTemplateWithMetadata } from "@WorkOrchestrator/shared/parser";
import { AINodeData, NodeExecutionOutput } from "../../engine/types";
import { resolveCredentials } from "../../engine/credentials";

type SupportedAINodeType =
    | "aiNode"
    | "openaiNode"
    | "anthropicNode"
    | "geminiNode";

type AIProvider = "openai" | "anthropic" | "gemini";
type AIInputMode = "prompt" | "json";
const MAX_PROMPT_CHARS = 200_000;
const PROMPT_TRUNCATION_SUFFIX =
    "\n\n[Prompt truncated to stay within model context limits]";
const AI_PROVIDER_BY_NODE_TYPE: Record<SupportedAINodeType, AIProvider> = {
    aiNode: "openai",
    openaiNode: "openai",
    anthropicNode: "anthropic",
    geminiNode: "gemini",
};
const DEFAULT_MODEL_BY_PROVIDER: Record<AIProvider, string> = {
    openai: "gpt-5-mini",
    anthropic: "claude-sonnet-4-5",
    gemini: "gemini-2.5-flash",
};

function resolveInputMode(inputMode: unknown): AIInputMode {
    return inputMode === "json" ? "json" : "prompt";
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}


// Validates a raw OpenAI chat-completions payload (messages array with valid roles/content).
function ensureOpenAiJsonInput(payload: unknown, label: string): Record<string, unknown> {
    if (!isRecord(payload)){
        throw new Error(`${label} JSON input must be an object with a "messages" array.`)
    }
    const messages=payload.messages
    if (!Array.isArray(messages)||messages.length===0){
        throw new Error(`${label} JSON input requires "messages" as a non-empty array`)
    }

    const allowedRoles=new Set(["system","user","assistant","developer"])
    for (let i=0;i<messages.length;i+=1){
        const message=messages[i]
        if (!isRecord(message)){
            throw new Error(
                `${label} JSON input messages[${i}] must be an object.`,
            );
        }

        const role=message["role"]
        if (!isNonEmptyString(role) || !allowedRoles.has(role)) {
            throw new Error(
                `${label} JSON input messages[${i}].role must be one of: system, user, assistant, developer.`,
            );
        }

        const content=message["content"]
        const validContent =
            isNonEmptyString(content) ||
            (Array.isArray(content) && content.length > 0);
        if (!validContent) {
            throw new Error(
                `${label} JSON input messages[${i}].content must be a non-empty string or non-empty content array.`,
            );
        }
    }
    return payload;
}

// Validates a raw Anthropic messages payload (user/assistant roles only).
function ensureAnthropicJsonInput(
    payload: unknown,
    providerLabel: string,
): Record<string, unknown> {
    if (!isRecord(payload)) {
        throw new Error(
            `${providerLabel} JSON input must be an object with a "messages" array.`,
        );
    }
    const messages = payload.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
        throw new Error(
            `${providerLabel} JSON input requires "messages" as a non-empty array. Example: {"messages":[{"role":"user","content":"Hello"}]}`,
        );
    }
    const allowedRoles = new Set(["user", "assistant"]);
    for (let index = 0; index < messages.length; index += 1) {
        const message = messages[index];
        if (!isRecord(message)) {
            throw new Error(
                `${providerLabel} JSON input messages[${index}] must be an object.`,
            );
        }
        const role = message.role;
        if (!isNonEmptyString(role) || !allowedRoles.has(role)) {
            throw new Error(
                `${providerLabel} JSON input messages[${index}].role must be one of: user, assistant.`,
            );
        }
        const content = message.content;
        const validContent =
            isNonEmptyString(content) ||
            (Array.isArray(content) && content.length > 0);
        if (!validContent) {
            throw new Error(
                `${providerLabel} JSON input messages[${index}].content must be a non-empty string or non-empty content array.`,
            );
        }
    }
    return payload;
}

// Validates a raw Gemini generateContent payload (contents with text parts).
function ensureGeminiJsonInput(
    payload: unknown,
    providerLabel: string,
): Record<string, unknown> {
    if (!isRecord(payload)) {
        throw new Error(
            `${providerLabel} JSON input must be an object with a "contents" array.`,
        );
    }
    const contents = payload.contents;
    if (!Array.isArray(contents) || contents.length === 0) {
        throw new Error(
            `${providerLabel} JSON input requires "contents" as a non-empty array. Example: {"contents":[{"role":"user","parts":[{"text":"Hello"}]}]}`,
        );
    }
    for (
        let contentIndex = 0;
        contentIndex < contents.length;
        contentIndex += 1
    ) {
        const content = contents[contentIndex];
        if (!isRecord(content)) {
            throw new Error(
                `${providerLabel} JSON input contents[${contentIndex}] must be an object.`,
            );
        }
        const parts = content.parts;
        if (!Array.isArray(parts) || parts.length === 0) {
            throw new Error(
                `${providerLabel} JSON input contents[${contentIndex}].parts must be a non-empty array.`,
            );
        }
        const hasTextPart = parts.some(
            (part) => isRecord(part) && isNonEmptyString(part.text),
        );
        if (!hasTextPart) {
            throw new Error(
                `${providerLabel} JSON input contents[${contentIndex}].parts must include at least one part with non-empty "text".`,
            );
        }
    }
    return payload
}

// Renders the JSON template, parses it, and validates it for the given provider.
function parseProviderJsonInput(params: {
    provider: AIProvider;
    providerLabel: string;
    requestJson: string;
    runMetadata: Record<string, NodeExecutionOutput>;
}): Record<string, unknown> {
    const template=parseTemplateWithMetadata(params.requestJson,params.runMetadata as Record<string,string>)
    const rendered=template.output.trim()
    if (template.missingVars?.length) {
        throw new Error(
            `${params.providerLabel} JSON input uses undefined variables: ${template.missingVars.join(", ")}.`,
        );
    }
    if (!rendered) {
        throw new Error(
            `${params.providerLabel} JSON input is empty after template rendering.`,
        );
    }
    let parsed:unknown
    try {
        parsed=JSON.parse(rendered)
    } catch (error) {
        throw new Error(
            `${params.providerLabel} JSON input is invalid JSON. Ensure the rendered JSON is valid for this provider.`,
        );
    }
    if (params.provider==="openai"){
        return ensureOpenAiJsonInput(parsed,"openai")
    } 
    if (params.provider === "anthropic") {
        return ensureAnthropicJsonInput(parsed, params.providerLabel);
    }
    return ensureGeminiJsonInput(parsed, params.providerLabel);
}

// Maps a node type string to its AI provider, throwing on unknown types.
function resolveProvider(nodeType: string): AIProvider {
    if (nodeType in AI_PROVIDER_BY_NODE_TYPE) {
        return AI_PROVIDER_BY_NODE_TYPE[nodeType as SupportedAINodeType];
    }
    throw new Error(`Unsupported AI node type: ${nodeType}`);
}

function getProviderLabel(provider: AIProvider): string {
    switch (provider) {
        case "openai":
            return "OpenAI";
        case "anthropic":
            return "Anthropic";
        case "gemini":
            return "Gemini";
    }
}

function getProviderApiKeyFromEnv(provider: AIProvider): string | undefined {
    switch (provider) {
        case "openai":
            return process.env.OPENAI_API_KEY;
        case "anthropic":
            return process.env.ANTHROPIC_API_KEY;
        case "gemini":
            return process.env.GEMINI_API_KEY;
    }
}

// Wraps an unknown usage blob as NodeExecutionOutput, or undefined if absent.
function normalizeUsage(usage: unknown): NodeExecutionOutput | undefined {
    if (usage === undefined || usage === null) return undefined;
    return usage as NodeExecutionOutput;
}

// Caps the prompt at MAX_PROMPT_CHARS, appending a truncation notice if cut.
function truncatePrompt(prompt: string): {
    prompt: string;
    truncated: boolean;
    originalLength: number;
} {
    const originalLength = prompt.length;
    if (originalLength <= MAX_PROMPT_CHARS) {
        return {
            prompt,
            truncated: false,
            originalLength,
        };
    }
    const available = Math.max(
        0,
        MAX_PROMPT_CHARS - PROMPT_TRUNCATION_SUFFIX.length,
    );
    return {
        prompt: prompt.slice(0, available) + PROMPT_TRUNCATION_SUFFIX,
        truncated: true,
        originalLength,
    };
}

// Sends a prompt-mode chat completion request to the OpenAI API.
async function executeOpenAIRequest(params: {
    apiKey: string;
    model: string;
    prompt: string;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
}): Promise<NodeExecutionOutput> {
    const messages:Array<{role:string,content:string}>=[]
    if (params.systemPrompt){
        messages.push({role:"system",content:params.systemPrompt})
    }
    messages.push({role:"user",content:params.prompt})
    const isReasoningModel =/^(o[1-4])(-|$)/.test(params.model) || /^gpt-5/.test(params.model);
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${params.apiKey}`,
        },
        body: JSON.stringify({
            model: params.model,
            messages,
            ...(params.temperature !== undefined && !isReasoningModel
                ? { temperature: params.temperature }
                : {}),
            ...(params.maxTokens ? { max_tokens: params.maxTokens } : {}),
        }),
    });
    if (!response.ok){
        const error=await response.text()
        throw new Error(`OpenAI API error (${response.status}): ${error}`);
    }
    const result = await response.json();
    const content = result.choices?.[0]?.message?.content ?? "";
    return {
        success: true,
        data: content,
        model: result.model,
        usage: result.usage,
    };
}

// Sends a prompt-mode messages request to the Anthropic API.
async function executeAnthropicRequest(params: {
    apiKey: string;
    model: string;
    prompt: string;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
}): Promise<NodeExecutionOutput> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": params.apiKey,
            "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
            model: params.model,
            messages: [{ role: "user", content: params.prompt }],
            ...(params.systemPrompt ? { system: params.systemPrompt } : {}),
            ...(params.temperature !== undefined
                ? { temperature: params.temperature }
                : {}),
            max_tokens: params.maxTokens ?? 1024,
        }),
    });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Anthropic API error (${response.status}): ${errorBody}`);
    }
    const result=(await response.json()) as {
        model:string,
        content:Array<{type?:string,text?:string}>,
        usage:Record<string,unknown>
    }
    
    const content=Array.isArray(result.content)?result.content.filter((item)=>item?.type==="text").map((item)=>item.text??"").join("\n"):""

    const normalizedUsage = normalizeUsage(result.usage);
    if (normalizedUsage === undefined) {
        return {
            success: true,
            data: content,
            model: result.model ?? params.model,
        };
    }
    return {
        success: true,
        data: content,
        model: result.model ?? params.model,
        usage: normalizedUsage,
    };
}

// Sends a prompt-mode generateContent request to the Gemini API.
async function executeGeminiRequest(params: {
    apiKey: string;
    model: string;
    prompt: string;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
}): Promise<NodeExecutionOutput> {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(params.model)}:generateContent?key=${encodeURIComponent(params.apiKey)}`;
    const generationConfig = {
        ...(params.temperature !== undefined
            ? { temperature: params.temperature }
            : {}),
        ...(params.maxTokens ? { maxOutputTokens: params.maxTokens } : {}),
    };
    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: params.prompt }] }],
            ...(params.systemPrompt
                ? { systemInstruction: { parts: [{ text: params.systemPrompt }] } }
                : {}),
            ...(Object.keys(generationConfig).length > 0 ? { generationConfig } : {}),
        }),
    });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Gemini API error (${response.status}): ${errorBody}`);
    }
    const result = (await response.json()) as {
        candidates?: Array<{
            content?: {
                parts?: Array<{
                    text?: string;
                }>;
            };
        }>;
        usageMetadata?: Record<string, unknown>;
    };
    const content =
        result.candidates?.[0]?.content?.parts
            ?.map((part) => part.text ?? "")
            .join("\n") ?? "";
    const normalizedUsage = normalizeUsage(result.usageMetadata);
    if (normalizedUsage === undefined) {
        return {
            success: true,
            data: content,
            model: params.model,
        };
    }
    return {
        success: true,
        data: content,
        model: params.model,
        usage: normalizedUsage,
    };
}

// Sends a user-supplied JSON body to the OpenAI chat completions API.
async function executeOpenAIJsonRequest(params: {
    apiKey: string;
    model: string;
    requestBody: Record<string, unknown>;
    temperature?: number;
    maxTokens?: number;
}): Promise<NodeExecutionOutput> {
    const body:Record<string,unknown>={
        ...params.requestBody,
        model:params.model
    }

    const isReasoningModel =
        /^(o[1-4])(-|$)/.test(params.model) || /^gpt-5/.test(params.model);
    const bodyHasTemperature=typeof body.temperature==="number"
    const bodyHasMaxTokens = typeof body.max_tokens === "number";

    // Reasoning models reject "temperature"; strip it from the merged body.
    if (bodyHasTemperature && isReasoningModel){
        delete body.temperature
    }

    if (
        !bodyHasTemperature &&
        params.temperature !== undefined &&
        !isReasoningModel
    ) {
        body.temperature = params.temperature;
    }
    if (!bodyHasMaxTokens && params.maxTokens !== undefined) {
        body.max_tokens = params.maxTokens;
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${params.apiKey}`,
        },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${errorBody}`);
    }
    const result = await response.json();
    const content = result.choices?.[0]?.message?.content ?? "";
    return {
        success: true,
        data: content,
        model: result.model,
        usage: result.usage,
    };
}

// Sends a user-supplied JSON body to the Anthropic messages API.
async function executeAnthropicJsonRequest(params: {
    apiKey: string;
    model: string;
    requestBody: Record<string, unknown>;
    temperature?: number;
    maxTokens?: number;
}): Promise<NodeExecutionOutput> {
    const body: Record<string, unknown> = {
        ...params.requestBody,
        model: params.model,
    };
    if (
        typeof body.temperature !== "number" &&
        params.temperature !== undefined
    ) {
        body.temperature = params.temperature;
    }
    if (typeof body.max_tokens !== "number") {
        body.max_tokens = params.maxTokens ?? 1024;
    }
    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": params.apiKey,
            "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Anthropic API error (${response.status}): ${errorBody}`);
    }
    const result = (await response.json()) as {
        model?: string;
        content?: Array<{
            type?: string;
            text?: string;
        }>;
        usage?: Record<string, unknown>;
    };
    const content = Array.isArray(result.content)
        ? result.content
            .filter((item) => item?.type === "text")
            .map((item) => item.text ?? "")
            .join("\n")
        : "";
    const normalizedUsage = normalizeUsage(result.usage);
    if (normalizedUsage === undefined) {
        return {
            success: true,
            data: content,
            model: result.model ?? params.model,
        };
    }
    return {
        success: true,
        data: content,
        model: result.model ?? params.model,
        usage: normalizedUsage,
    };
}

// Sends a user-supplied JSON body to the Gemini generateContent API.
async function executeGeminiJsonRequest(params: {
    apiKey: string;
    model: string;
    requestBody: Record<string, unknown>;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
}): Promise<NodeExecutionOutput> {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(params.model)}:generateContent?key=${encodeURIComponent(params.apiKey)}`;
    const body: Record<string, unknown> = {
        ...params.requestBody,
    };
    if (params.systemPrompt && !body.systemInstruction) {
        body.systemInstruction = { parts: [{ text: params.systemPrompt }] };
    }
    const currentGenerationConfig = isRecord(body.generationConfig)
        ? { ...body.generationConfig }
        : {};
    if (
        params.temperature !== undefined &&
        typeof currentGenerationConfig.temperature !== "number"
    ) {
        currentGenerationConfig.temperature = params.temperature;
    }
    if (
        params.maxTokens !== undefined &&
        typeof currentGenerationConfig.maxOutputTokens !== "number"
    ) {
        currentGenerationConfig.maxOutputTokens = params.maxTokens;
    }
    if (Object.keys(currentGenerationConfig).length > 0) {
        body.generationConfig = currentGenerationConfig;
    }
    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Gemini API error (${response.status}): ${errorBody}`);
    }
    const result = (await response.json()) as {
        candidates?: Array<{
            content?: {
                parts?: Array<{
                    text?: string;
                }>;
            };
        }>;
        usageMetadata?: Record<string, unknown>;
    };
    const content =
        result.candidates?.[0]?.content?.parts
            ?.map((part) => part.text ?? "")
            .join("\n") ?? "";
    const normalizedUsage = normalizeUsage(result.usageMetadata);
    if (normalizedUsage === undefined) {
        return {
            success: true,
            data: content,
            model: params.model,
        };
    }
    return {
        success: true,
        data: content,
        model: params.model,
        usage: normalizedUsage,
    };
}

// Entry point: resolves provider/credentials, renders templates, and dispatches
// the request (prompt or JSON mode) to the matching provider API.
export async function executeAINode(
    nodeType: string,
    data: AINodeData,
    runMetadata: Record<string, NodeExecutionOutput>,
    ownerUserId: string,
): Promise<NodeExecutionOutput> {
    const provider=resolveProvider(nodeType)
    const providerLabel=getProviderLabel(provider)
    const {
        prompt,
        model,
        temperature,
        maxTokens,
        systemPrompt,
        apiKey,
        credentialId,
        requestJson,
        inputMode: rawInputMode,
    } = data;
    const inputMode=resolveInputMode(rawInputMode)
    const trimmedModel=model?.trim()

    let resolvedApiKey=apiKey

    if (credentialId){
        const credential=await resolveCredentials(credentialId,ownerUserId)
        if (credential.platform!==provider){
            throw new Error(`Credential platform mismatch: ${nodeType} requires ${provider} credential, got ${credential.platform}`)
        }
        resolvedApiKey=credential.keys.apiKey||resolvedApiKey
    }

    if (!resolvedApiKey) {
        resolvedApiKey = getProviderApiKeyFromEnv(provider);
    }
    if (!resolvedApiKey) {
        throw new Error(`${providerLabel} API key not configured`);
    }
    
    const parsedSystemPrompt=systemPrompt?parseTemplate(systemPrompt,runMetadata):undefined
    const resolvedModel = trimmedModel || DEFAULT_MODEL_BY_PROVIDER[provider];

    if (inputMode==="json"){
        const trimmedRequestJson = requestJson?.trim();
        if (!trimmedRequestJson) {
            return {
                success: true,
                skipped: true,
                reason: "No JSON input configured",
            };
        }

        const parsedJSONInput=parseProviderJsonInput({provider,providerLabel,requestJson:trimmedRequestJson,runMetadata})

        if(provider==="openai"){
            return executeOpenAIJsonRequest({
                apiKey: resolvedApiKey, model: resolvedModel, requestBody: parsedJSONInput, 
                ...(temperature !== undefined ? { temperature } : {}),
                ...(maxTokens !== undefined ? { maxTokens } : {}),
            })
        }
        if (provider==="anthropic"){
            return executeAnthropicJsonRequest({
                apiKey: resolvedApiKey, model: resolvedModel, requestBody: parsedJSONInput,
                ...(temperature !== undefined ? { temperature } : {}),
                ...(maxTokens !== undefined ? { maxTokens } : {}),
            })
        }
        
        return executeGeminiJsonRequest({
                apiKey: resolvedApiKey, model: resolvedModel, requestBody: parsedJSONInput,
                ...(temperature !== undefined ? { temperature } : {}),
                ...(maxTokens !== undefined ? { maxTokens } : {}),
        })
    }

    if (!prompt){
        return {
            success: true,
            skipped: true,
            reason: "No prompt configured",
        };
    }

    const promptResult=parseTemplateWithMetadata(prompt,runMetadata)
    const parsedPrompt=promptResult.output
    if (!parsedPrompt && promptResult.hasSubstitutions) {
        const missingVarList =
            promptResult.missingVars?.join(", ") || "unknown variables";
        const errorMsg = `Prompt template uses undefined variables: ${missingVarList}. Original template: "${prompt.slice(0, 100)}${prompt.length > 100 ? "..." : ""}"`;
        return {
            success: false,
            error: errorMsg,
            skipped: false,
        };
    }
    if (!parsedPrompt) {
        return {
            success: true,
            skipped: true,
            reason: "Prompt is empty after parsing",
        };
    }

    const truncatedPrompt = truncatePrompt(parsedPrompt);
    const requestParams = {
        apiKey:resolvedApiKey,
        model: resolvedModel,
        prompt: truncatedPrompt.prompt,
        ...(parsedSystemPrompt ? { systemPrompt: parsedSystemPrompt } : {}),
        ...(temperature !== undefined ? { temperature } : {}),
        ...(maxTokens !== undefined ? { maxTokens } : {}),
    }

    let response: NodeExecutionOutput;
    if (provider === "openai") {
        response = await executeOpenAIRequest(requestParams);
    } 
    else if (provider === "anthropic") {
        response = await executeAnthropicRequest(requestParams);
    } 
    else {
        response = await executeGeminiRequest(requestParams);
    }
    if (!truncatedPrompt.truncated) {
        return response;
    }

    if (response && typeof response === "object" && !Array.isArray(response)) {
        return {
            ...response,
            _inputTruncated: true,
            _inputOriginalLength: truncatedPrompt.originalLength,
            _inputTruncatedLength: truncatedPrompt.prompt.length,
            _inputTruncationReason: "prompt_char_limit_exceeded",
        };
    }
    return {
        success: true,
        data: response,
        _inputTruncated: true,
        _inputOriginalLength: truncatedPrompt.originalLength,
        _inputTruncatedLength: truncatedPrompt.prompt.length,
        _inputTruncationReason: "prompt_char_limit_exceeded",
    };
}