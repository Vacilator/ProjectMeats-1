#!/usr/bin/env python3
"""Replace console.log with logger utility across frontend"""

import re
import os
from pathlib import Path

FRONTEND_DIR = Path("frontend/src")
LOGGER_IMPORT = "import { logger } from '@/utils/logger';\n"

# Top files to process
TARGET_FILES = [
    "pages/WorkForms/Editor.tsx",
    "components/FlowEditor/utils/containerLayout.ts",
    "pages/WorkForms/Catalog.tsx",
    "utils/searchDiagnostic.ts",
    "services/tenantFormService.ts",
    "pages/Suppliers.tsx",
    "components/WorkForms/FormPreviewModal.tsx",
    "components/FlowEditor/utils/workflowPersistence.ts",
    "components/FlowEditor/nodes/FormProcessGroupNode.tsx",
    "components/FlowEditor/config/nodeConfigSchemas.ts",
    "components/Shared/EntityDetailModal.tsx",
    "components/FormSubmission/FormSubmissionModal.tsx",
    "components/FlowEditor/hooks/useUndoRedo.ts",
    "services/schemaService.ts",
    "components/Navigation/NavigationMenu.tsx",
]

def process_file(filepath: Path) -> int:
    """Replace console calls with logger in a file"""
    if not filepath.exists():
        return 0
    
    content = filepath.read_text()
    original_content = content
    
    # Count console calls before
    before_count = len(re.findall(r'console\.(log|warn|error)', content))
    
    if before_count == 0:
        return 0
    
    # Replace console calls
    content = re.sub(r'console\.log\(', 'logger.debug(', content)
    content = re.sub(r'console\.warn\(', 'logger.warn(', content)
    content = re.sub(r'console\.error\(', 'logger.error(', content)
    
    # Add logger import if not present
    if 'from' in content and 'utils/logger' not in content:
        # Find first import line
        import_match = re.search(r'^import .+;$', content, re.MULTILINE)
        if import_match:
            insert_pos = import_match.end()
            content = content[:insert_pos] + '\n' + LOGGER_IMPORT + content[insert_pos:]
    
    # Count console calls after
    after_count = len(re.findall(r'console\.(log|warn|error)', content))
    replaced = before_count - after_count
    
    if replaced > 0:
        filepath.write_text(content)
        print(f"✓ {filepath.relative_to(FRONTEND_DIR)}: {replaced} replaced")
    
    return replaced

def main():
    os.chdir(Path(__file__).parent.parent)
    
    total_replaced = 0
    
    for file_path in TARGET_FILES:
        full_path = FRONTEND_DIR / file_path
        replaced = process_file(full_path)
        total_replaced += replaced
    
    print(f"\n✅ Total: {total_replaced} console statements replaced")

if __name__ == "__main__":
    main()
