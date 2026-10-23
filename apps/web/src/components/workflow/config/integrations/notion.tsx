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
  { value: "create", label: "Create page" },
  { value: "get", label: "Get page" },
  { value: "get_many", label: "Query pages" },
  { value: "update", label: "Update page" },
];

export function NotionConfig({ data, onSave }: ConfigProps) {
  const [credentialId, setCredentialId] = useState(data.credentialId || "");
  const [operation, setOperation] = useState(data.operation || "create");
  const [dataSourceId, setDataSourceId] = useState(data.dataSourceId || "");
  const [databaseId, setDatabaseId] = useState(data.databaseId || "");
  const [pageId, setPageId] = useState(data.pageId || "");
  const [propertiesTemplate, setPropertiesTemplate] = useState(
    data.propertiesTemplate || "",
  );
  const [childrenTemplate, setChildrenTemplate] = useState(
    data.childrenTemplate || "",
  );
  const [filterTemplate, setFilterTemplate] = useState(
    data.filterTemplate || "",
  );
  const [sortsTemplate, setSortsTemplate] = useState(
    data.sortsTemplate || "",
  );
  const [pageSize, setPageSize] = useState(
    data.pageSize == null ? "" : String(data.pageSize),
  );
  const [startCursor, setStartCursor] = useState(data.startCursor || "");
  const [archived, setArchived] = useState(Boolean(data.archived));
  const [responseName, setResponseName] = useState(data.responseName || "");

  const missingFields: string[] = [];
  if (!credentialId) missingFields.push("Credential");
  if (operation === "create" && !dataSourceId.trim() && !databaseId.trim()) {
    missingFields.push("Data Source or Database ID");
  }
  if ((operation === "get" || operation === "update") && !pageId.trim()) {
    missingFields.push("Page ID");
  }
  if (operation === "create" && !propertiesTemplate.trim()) {
    missingFields.push("Properties JSON");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({
      credentialId,
      operation,
      dataSourceId: dataSourceId || undefined,
      databaseId: databaseId || undefined,
      pageId: pageId || undefined,
      propertiesTemplate: propertiesTemplate || undefined,
      childrenTemplate: childrenTemplate || undefined,
      filterTemplate: filterTemplate || undefined,
      sortsTemplate: sortsTemplate || undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      startCursor: startCursor || undefined,
      archived,
      responseName: responseName || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <CredentialSelect
        platform="notion"
        value={credentialId}
        onChange={setCredentialId}
      />
      <SelectField
        label="Operation"
        value={operation}
        onChange={setOperation}
        options={OPERATIONS}
      />
      {operation === "create" && (
        <>
          <TextField
            label="Data Source ID"
            value={dataSourceId}
            onChange={setDataSourceId}
            optional
          />
          <TextField
            label="Database ID (legacy)"
            value={databaseId}
            onChange={setDatabaseId}
            optional
          />
          <TextAreaField
            label="Properties (JSON template)"
            value={propertiesTemplate}
            onChange={setPropertiesTemplate}
            placeholder={'{\n  "Name": { "title": [{ "text": { "content": "Example" } }] }\n}'}
            rows={6}
          />
          <TextAreaField
            label="Children (JSON template)"
            value={childrenTemplate}
            onChange={setChildrenTemplate}
            optional
            rows={4}
          />
        </>
      )}
      {(operation === "get" || operation === "update") && (
        <TextField label="Page ID" value={pageId} onChange={setPageId} />
      )}
      {operation === "update" && (
        <>
          <TextAreaField
            label="Properties (JSON template)"
            value={propertiesTemplate}
            onChange={setPropertiesTemplate}
            placeholder='{"Name": {"title": [{"text": {"content": "Updated"}}]}}'
            rows={5}
          />
          <label className="flex items-center gap-2 text-sm text-white/80">
            <input
              type="checkbox"
              checked={archived}
              onChange={(event) => setArchived(event.target.checked)}
            />
            Archive page
          </label>
        </>
      )}
      {operation === "get_many" && (
        <>
          <TextField
            label="Data Source ID"
            value={dataSourceId}
            onChange={setDataSourceId}
            optional
          />
          <TextField
            label="Database ID (legacy)"
            value={databaseId}
            onChange={setDatabaseId}
            optional
          />
          <TextAreaField
            label="Filter (JSON template)"
            value={filterTemplate}
            onChange={setFilterTemplate}
            optional
          />
          <TextAreaField
            label="Sorts (JSON template)"
            value={sortsTemplate}
            onChange={setSortsTemplate}
            optional
          />
          <TextField
            label="Page Size"
            value={pageSize}
            onChange={setPageSize}
            type="number"
            min={1}
            max={100}
            optional
          />
          <TextField
            label="Start Cursor"
            value={startCursor}
            onChange={setStartCursor}
            optional
          />
        </>
      )}
      <ResponseNameField value={responseName} onChange={setResponseName} />
      <ConfigFooter
        missingFields={missingFields}
        disabled={missingFields.length > 0}
      />
    </form>
  );
}
