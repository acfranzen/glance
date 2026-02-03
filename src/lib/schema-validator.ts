/**
 * Lightweight JSON Schema validator for widget data
 * 
 * Supports a subset of JSON Schema for validating cache data:
 * - type: object, array, string, number, boolean, null
 * - properties: object property definitions
 * - required: list of required property names
 * - items: array item schema
 * - format: date-time (for string validation)
 */

import { DataSchema, DataSchemaProperty } from "./db";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate data against a JSON Schema
 */
export function validateDataSchema(
  data: unknown,
  schema: DataSchema,
  path: string = ""
): ValidationResult {
  const errors: string[] = [];

  // Validate root type
  if (schema.type === "object") {
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      errors.push(`${path || "data"}: expected object, got ${getType(data)}`);
      return { valid: false, errors };
    }

    const obj = data as Record<string, unknown>;

    // Check required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in obj)) {
          errors.push(`${path || "data"}: missing required field "${field}"`);
        }
      }
    }

    // Validate properties
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in obj) {
          const propPath = path ? `${path}.${key}` : key;
          const propResult = validateProperty(obj[key], propSchema, propPath);
          errors.push(...propResult.errors);
        }
      }
    }
  } else if (schema.type === "array") {
    if (!Array.isArray(data)) {
      errors.push(`${path || "data"}: expected array, got ${getType(data)}`);
      return { valid: false, errors };
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate a property against its schema
 */
function validateProperty(
  value: unknown,
  schema: DataSchemaProperty,
  path: string
): ValidationResult {
  const errors: string[] = [];

  // Handle null/undefined
  if (value === null || value === undefined) {
    // Allow null/undefined for optional fields
    return { valid: true, errors: [] };
  }

  // Type validation
  const actualType = getType(value);
  const expectedType = schema.type;

  if (expectedType === "object") {
    if (actualType !== "object") {
      errors.push(`${path}: expected object, got ${actualType}`);
      return { valid: false, errors };
    }

    const obj = value as Record<string, unknown>;

    // Check required fields for nested objects
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in obj)) {
          errors.push(`${path}: missing required field "${field}"`);
        }
      }
    }

    // Validate nested properties
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in obj) {
          const propPath = `${path}.${key}`;
          const propResult = validateProperty(obj[key], propSchema, propPath);
          errors.push(...propResult.errors);
        }
      }
    }
  } else if (expectedType === "array") {
    if (!Array.isArray(value)) {
      errors.push(`${path}: expected array, got ${actualType}`);
      return { valid: false, errors };
    }

    // Validate array items
    if (schema.items) {
      const arr = value as unknown[];
      for (let i = 0; i < arr.length; i++) {
        const itemPath = `${path}[${i}]`;
        const itemResult = validateProperty(arr[i], schema.items, itemPath);
        errors.push(...itemResult.errors);
      }
    }
  } else if (expectedType === "string") {
    if (actualType !== "string") {
      errors.push(`${path}: expected string, got ${actualType}`);
    } else if (schema.format === "date-time") {
      // Validate ISO 8601 date-time format
      const dateStr = value as string;
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        errors.push(`${path}: invalid date-time format "${dateStr}"`);
      }
    }
  } else if (expectedType === "number") {
    if (actualType !== "number") {
      errors.push(`${path}: expected number, got ${actualType}`);
    }
  } else if (expectedType === "boolean") {
    if (actualType !== "boolean") {
      errors.push(`${path}: expected boolean, got ${actualType}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get the type of a value as a string
 */
function getType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

/**
 * Format validation errors into a human-readable message
 */
export function formatValidationErrors(errors: string[]): string {
  if (errors.length === 0) return "";
  if (errors.length === 1) return errors[0];
  return `Multiple validation errors:\n${errors.map(e => `  - ${e}`).join("\n")}`;
}
