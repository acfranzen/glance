import { getAllWidgets, getAllCustomWidgets } from '../src/lib/db.ts';
import {
  validateStoredCustomWidgetPayload,
  validateStoredWidgetPayload,
} from '../src/lib/widget-contract.ts';

function auditWidgets() {
  const rows = getAllWidgets();
  const invalid: Array<{ id: string; issues: ReturnType<typeof validateStoredWidgetPayload>['issues'] }> = [];

  for (const row of rows) {
    try {
      const payload = {
        type: row.type,
        title: row.title,
        config: JSON.parse(row.config),
        position: JSON.parse(row.position),
        data_source: row.data_source ? JSON.parse(row.data_source) : undefined,
        custom_widget_id: (row as { custom_widget_id?: string }).custom_widget_id || undefined,
      };

      const result = validateStoredWidgetPayload(payload);
      if (!result.ok) {
        invalid.push({ id: row.id, issues: result.issues });
      }
    } catch {
      invalid.push({
        id: row.id,
        issues: [{ path: '$', code: 'invalid_json', message: 'Stored widget JSON could not be parsed' }],
      });
    }
  }

  return invalid;
}

function auditCustomWidgets() {
  const rows = getAllCustomWidgets(true);
  const invalid: Array<{ id: string; issues: ReturnType<typeof validateStoredCustomWidgetPayload>['issues'] }> = [];

  for (const row of rows) {
    const result = validateStoredCustomWidgetPayload(row);
    if (!result.ok) {
      invalid.push({ id: row.id, issues: result.issues });
    }
  }

  return invalid;
}

const invalidWidgets = auditWidgets();
const invalidCustomWidgets = auditCustomWidgets();

console.log(`widgets.invalid=${invalidWidgets.length}`);
console.log(`custom_widgets.invalid=${invalidCustomWidgets.length}`);

if (invalidWidgets.length > 0) {
  console.log('\nInvalid widgets:');
  for (const widget of invalidWidgets) {
    console.log(`- ${widget.id}`);
    for (const issue of widget.issues) {
      console.log(`  ${issue.path} [${issue.code}] ${issue.message}`);
    }
  }
}

if (invalidCustomWidgets.length > 0) {
  console.log('\nInvalid custom widgets:');
  for (const widget of invalidCustomWidgets) {
    console.log(`- ${widget.id}`);
    for (const issue of widget.issues) {
      console.log(`  ${issue.path} [${issue.code}] ${issue.message}`);
    }
  }
}

if (invalidWidgets.length > 0 || invalidCustomWidgets.length > 0) {
  process.exitCode = 1;
}
