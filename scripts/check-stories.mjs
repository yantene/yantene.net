#!/usr/bin/env node
/**
 * Check that every component in app/frontend/components/ has a corresponding
 * Storybook story file (*.stories.tsx).
 *
 * Only app/frontend/components/ is checked; pages, layouts and framework files
 * are excluded. Passes when the directory does not exist yet or has no
 * components (safe for a template with no components).
 */
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

const COMPONENTS_DIR = "app/frontend/components";

function findComponentFiles(dir) {
  const files = [];
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- trusted local directory path
  if (!existsSync(dir)) {
    return files;
  }
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- trusted local directory path
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const currentPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findComponentFiles(currentPath));
    } else if (
      entry.name.endsWith(".tsx") &&
      !entry.name.endsWith(".stories.tsx") &&
      !entry.name.endsWith(".test.tsx")
    ) {
      files.push(currentPath);
    }
  }
  return files;
}

const componentFiles = findComponentFiles(COMPONENTS_DIR);

if (componentFiles.length === 0) {
  console.log(`✓ No components found in ${COMPONENTS_DIR}`);
} else {
  const missing = componentFiles.filter(
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- trusted local file path
    (file) => !existsSync(file.replace(/\.tsx$/, ".stories.tsx")),
  );

  if (missing.length > 0) {
    const missingList = missing
      .map((file) => `  ${file}\n  → ${file.replace(/\.tsx$/, ".stories.tsx")}`)
      .join("\n\n");
    throw new Error(
      `Missing Storybook stories for ${missing.length} component(s):\n\n${missingList}`,
    );
  }

  console.log(
    `✓ All ${componentFiles.length} component(s) in ${COMPONENTS_DIR} have stories`,
  );
}
