# Copyright & Licensing Documentation Guidelines

> **Standard**: Linux Kernel License & Copyright Model (`Documentation/process/license-rules.rst`)  
> **Project License**: GNU General Public License v2.0 (`GPL-2.0-only`)  
> **SPDX Specification**: Version 3.0 / SPDX 2.3 Short Identifiers  
> **Attribution Policy**: Developer Certificate of Origin (DCO 1.1)

---

## 1. Overview

To comply with the licensing principles that govern the Linux kernel, **Flashcards AI** enforces a standardized, machine-readable licensing and copyright documentation scheme.

Instead of inserting lengthy, error-prone license boilerplates into every file, we utilize **SPDX (Software Package Data Exchange) short-form license identifiers** alongside the **DCO (Developer Certificate of Origin)**.

---

## 2. Source File License Headers

Every source file in the repository must specify its license on the very first lines of the file.

### 2.1 General Rules
1. **First Line**: The `SPDX-License-Identifier:` tag must appear on the first line of the file (or the second line if the first line is an interpreter directive / shebang like `#!/usr/bin/env node` or `#!/bin/bash`).
2. **Comment Style**: The comment syntax appropriate for the file format must be used.
3. **No Redundant Boilerplate**: Do not paste the full 30-line GPL preamble into source files. The SPDX identifier legally references the project's root [`LICENSE`](../LICENSE) file.
4. **Copyright Notice**: Include one or more copyright lines directly below the SPDX line.

---

## 3. Format Examples by File Type

### JavaScript / TypeScript (`.js`, `.mjs`, `.ts`)
```javascript
// SPDX-License-Identifier: GPL-2.0-only
/*
 * Copyright (C) 2026 Arthur <arthur.paludo.c@gmail.com>
 * Copyright (C) 2026 Contributor Name <contributor@example.com>
 */
```

### CSS / SCSS (`.css`, `.scss`)
```css
/* SPDX-License-Identifier: GPL-2.0-only */
/*
 * Copyright (C) 2026 Arthur <arthur.paludo.c@gmail.com>
 */
```

### HTML (`.html`)
Place immediately at the top before `<!DOCTYPE html>` or inside `<head>`:
```html
<!-- SPDX-License-Identifier: GPL-2.0-only -->
<!-- Copyright (C) 2026 Arthur <arthur.paludo.c@gmail.com> -->
```

### Shell Scripts (`.sh`) & Node CLI scripts
The shebang comes first, followed immediately by the SPDX identifier:
```bash
#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Arthur <arthur.paludo.c@gmail.com>
```

### Markdown / Documentation (`.md`)
```markdown
<!-- SPDX-License-Identifier: GPL-2.0-only -->
```
*(Optional for documentation, but recommended for technical architecture documents)*.

---

## 4. Managing Copyright Over Time

### 4.1 Retaining Author Copyright
In the Linux kernel model, contributors retain the copyright to their contributions. **Never delete existing copyright lines** when modifying a file.

### 4.2 Adding Your Notice
When making substantial modifications or additions to an existing file, append your own copyright notice to the file header:

```javascript
// SPDX-License-Identifier: GPL-2.0-only
/*
 * Copyright (C) 2024-2026 Arthur <arthur.paludo.c@gmail.com>
 * Copyright (C) 2026 Jane Doe <jane.doe@example.com>
 */
```

Small bug fixes (e.g., typos, one-line patches) do not meet the threshold of original authorship and do not require adding a new copyright line, but still require a DCO sign-off.

---

## 5. Third-Party Code and License Compatibility

Flashcards AI is licensed under `GPL-2.0-only`. When including third-party code, libraries, or vendored scripts, licenses must be compatible with GPL-2.0.

| License | Compatible with GPL-2.0? | Conditions |
| :--- | :---: | :--- |
| **MIT / Expat** | ✅ Yes | Retain original MIT license and copyright notice |
| **BSD-2-Clause / BSD-3-Clause** | ✅ Yes | Retain original BSD license and copyright notice |
| **ISC** | ✅ Yes | Retain original ISC notice |
| **Apache 2.0** | ⚠️ Complex | Code strictly under Apache-2.0 has patent clause conflicts with pure GPL-2.0 (though compatible with GPL-3.0). Avoid mixing raw Apache-2.0 code directly into GPLv2 source files unless dual-licensed. |
| **GPL-2.0-or-later** | ✅ Yes | Compatible |
| **GPL-3.0-only** | ❌ No | Incompatible with GPL-2.0-only (cannot combine into the same program) |
| **Proprietary / Closed Source** | ❌ No | Strictly forbidden |

---

## 6. Developer Certificate of Origin (DCO) Verification

To mirror the Linux kernel's submission pipeline:
1. Every commit must have a matching `Signed-off-by: Real Name <email@domain>` line.
2. Maintainers verify the DCO sign-off before merging any Pull Request.
3. Automated continuous integration rejects any commit lacking this verification.
