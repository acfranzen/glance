/**
 * Script to add data_schema to existing widgets
 * Run with: npx tsx scripts/add-widget-schemas.ts
 */

import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "glance.db");

const schemas: Record<string, object> = {
  "claude-code-usage": {
    type: "object",
    properties: {
      session: { type: "string", description: "Session usage %, e.g. '45%'" },
      sessionResets: { type: "string", description: "Reset time, e.g. '7pm'" },
      weekAll: { type: "string", description: "Week all-models usage %" },
      weekSonnet: { type: "string", description: "Week Sonnet usage %" },
      extra: { type: "string", description: "Extra usage %" },
      extraSpent: { type: "string", description: "Spend string, e.g. '$12 / $20'" },
      fetchedAt: { type: "string", format: "date-time" }
    },
    required: ["session", "weekAll", "fetchedAt"]
  },
  "open-prs": {
    type: "object",
    properties: {
      libra: {
        type: "array",
        items: {
          type: "object",
          properties: {
            number: { type: "number" },
            title: { type: "string" },
            url: { type: "string" },
            createdAt: { type: "string" }
          }
        }
      },
      glance: {
        type: "array",
        items: {
          type: "object",
          properties: {
            number: { type: "number" },
            title: { type: "string" },
            url: { type: "string" },
            createdAt: { type: "string" }
          }
        }
      },
      fetchedAt: { type: "string", format: "date-time" }
    },
    required: ["libra", "glance", "fetchedAt"]
  },
  "recent-emails": {
    type: "object",
    properties: {
      emails: {
        type: "array",
        items: {
          type: "object",
          properties: {
            subject: { type: "string" },
            from: { type: "string" },
            summary: { type: "string" }
          }
        }
      },
      count: { type: "number" },
      fetchedAt: { type: "string", format: "date-time" }
    },
    required: ["emails", "fetchedAt"]
  }
};

async function main() {
  console.log("Opening database at:", DB_PATH);
  const db = new Database(DB_PATH);
  
  // Check if data_schema column exists, add if not
  const tableInfo = db.prepare("PRAGMA table_info(custom_widgets)").all() as Array<{ name: string }>;
  const hasDataSchema = tableInfo.some(col => col.name === "data_schema");
  
  if (!hasDataSchema) {
    console.log("Adding data_schema column to custom_widgets table...");
    db.exec("ALTER TABLE custom_widgets ADD COLUMN data_schema TEXT");
  }

  const updateStmt = db.prepare(`
    UPDATE custom_widgets 
    SET data_schema = ?, updated_at = datetime('now')
    WHERE slug = ?
  `);

  let updated = 0;
  let notFound = 0;

  for (const [slug, schema] of Object.entries(schemas)) {
    // Check if widget exists
    const existing = db.prepare("SELECT id, slug FROM custom_widgets WHERE slug = ?").get(slug) as { id: string; slug: string } | undefined;
    
    if (existing) {
      updateStmt.run(JSON.stringify(schema), slug);
      console.log(`✓ Updated schema for widget: ${slug}`);
      updated++;
    } else {
      console.log(`⚠ Widget not found: ${slug}`);
      notFound++;
    }
  }

  db.close();

  console.log("\nSummary:");
  console.log(`  Updated: ${updated}`);
  console.log(`  Not found: ${notFound}`);
}

main().catch(console.error);
