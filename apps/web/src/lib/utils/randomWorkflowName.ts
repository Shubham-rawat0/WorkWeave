import {
  uniqueNamesGenerator,
  adjectives,
  animals,
} from "unique-names-generator";

export function generateWorkflowName(): string {
  return uniqueNamesGenerator({
    dictionaries: [adjectives, animals],
    separator: "-",
    length: 2,
    style: "lowerCase",
  });
}