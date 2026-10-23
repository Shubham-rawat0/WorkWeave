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

const OPERATIONS = [
  { value: "create_issue", label: "Create issue" },
  { value: "create_comment", label: "Create comment" },
  { value: "get_issue", label: "Get issue" },
];

export function GitHubConfig({ data, onSave }: ConfigProps) {
  const [credentialId, setCredentialId] = useState(data.credentialId || "");
  const [operation, setOperation] = useState(data.operation || "create_issue");
  const [owner, setOwner] = useState(data.owner || "");
  const [repo, setRepo] = useState(data.repo || "");
  const [issueNumber, setIssueNumber] = useState(data.issueNumber || "");
  const [title, setTitle] = useState(data.title || "");
  const [body, setBody] = useState(data.body || "");
  const [labelsTemplate, setLabelsTemplate] = useState(
    data.labelsTemplate || "",
  );
  const [responseName, setResponseName] = useState(data.responseName || "");

  const missingFields = [];
  if (!credentialId) missingFields.push("Credential");
  if (!owner.trim()) missingFields.push("Owner");
  if (!repo.trim()) missingFields.push("Repository");
  if (
    (operation === "create_comment" || operation === "get_issue") &&
    !issueNumber.trim()
  ) {
    missingFields.push("Issue Number");
  }
  if (operation === "create_issue" && !title.trim()) {
    missingFields.push("Title");
  }
  if (operation === "create_comment" && !body.trim()) {
    missingFields.push("Comment");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({
      credentialId,
      operation,
      owner,
      repo,
      issueNumber: issueNumber || undefined,
      title: title || undefined,
      body: body || undefined,
      labelsTemplate: labelsTemplate || undefined,
      responseName: responseName || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <CredentialSelect
        platform="github"
        value={credentialId}
        onChange={setCredentialId}
      />
      <SelectField
        label="Operation"
        value={operation}
        onChange={setOperation}
        options={OPERATIONS}
      />
      <TextField label="Owner" value={owner} onChange={setOwner} placeholder="octocat" />
      <TextField label="Repository" value={repo} onChange={setRepo} placeholder="hello-world" />
      {operation !== "create_issue" && (
        <TextField
          label="Issue Number"
          value={issueNumber}
          onChange={setIssueNumber}
          placeholder="123"
          type="number"
          min={1}
        />
      )}
      {operation === "create_issue" && (
        <>
          <TextField label="Title" value={title} onChange={setTitle} />
          <TextAreaField
            label="Body"
            value={body}
            onChange={setBody}
            optional
          />
          <TextAreaField
            label="Labels (JSON template)"
            value={labelsTemplate}
            onChange={setLabelsTemplate}
            placeholder={'["bug", "automation"]'}
            optional
          />
        </>
      )}
      {operation === "create_comment" && (
        <TextAreaField label="Comment" value={body} onChange={setBody} />
      )}
      <ResponseNameField value={responseName} onChange={setResponseName} />
      <ConfigFooter
        missingFields={missingFields}
        disabled={missingFields.length > 0}
      />
    </form>
  );
}
