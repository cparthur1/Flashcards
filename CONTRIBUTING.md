# Contributing to Flashcards AI

Thank you for your interest in contributing to **Flashcards AI**! 

To maintain high code quality, clear legal provenance, and long-term open-source sustainability, this project follows the **Linux Kernel contribution model**, including the **GNU General Public License v2 (GPL-2.0-only)**, the **Developer Certificate of Origin (DCO)**, and **SPDX License Identifiers**.

---

## 1. Licensing & Copyleft (Open Source Terms)

All source code in Flashcards AI is licensed under the [GNU General Public License v2.0 (GPL-2.0-only)](./LICENSE).

### What this means for developers:
- **Strong Copyleft**: If you modify, extend, or build derivative works using this project and distribute them (or share binaries/compiled assets), **you must keep your project open source under GPL-2.0-only** and make the full corresponding source code freely available.
- **No Proprietary Lock-in**: You cannot take this code, make closed-source modifications, and redistribute it under proprietary terms.
- **Upstream Contributions**: In the spirit of the Linux open-source ecosystem, developers and organizations creating features, bug fixes, or performance enhancements are strongly encouraged to contribute their improvements back to the primary repository to benefit the entire community.

---

## 2. Developer Certificate of Origin (DCO)

We do not require contributors to sign a complex Contributor License Agreement (CLA) that surrenders copyright ownership. **You retain copyright to your code.**

However, to ensure all contributions are legally authorized and compatible with the GPL-2.0 license, this project uses the **Developer Certificate of Origin (DCO) Version 1.1** (the exact mechanism used by the Linux kernel).

You can read the full text of the DCO in [DCO.txt](./DCO.txt).

### The Sign-off Requirement (`Signed-off-by`)

By contributing, you certify that you wrote the code or have the right to submit it under the GPL-2.0 license. You express this by including a `Signed-off-by:` line in every commit message:

```text
Signed-off-by: Your Full Name <your.email@example.com>
```

#### How to automatically sign off commits with Git:
Use Git's `-s` (or `--signoff`) flag whenever you commit:

```bash
git commit -s -m "feat(spaced-repetition): improve review interval calculation"
```

If you forgot to sign off on your last commit:
```bash
git commit --amend -s --no-edit
```

> [!IMPORTANT]
> Pull Requests containing commits without a valid `Signed-off-by:` line matching your Git author credentials cannot be merged.

---

## 3. SPDX License Identifiers & Copyright Headers

Following Linux kernel documentation rules, every new source file added to the repository must contain an **SPDX-License-Identifier** tag and a copyright notice on the very first lines.

### JavaScript (`.js`, `.mjs`)
```javascript
// SPDX-License-Identifier: GPL-2.0-only
/*
 * Copyright (C) 2026 Your Name <your.email@example.com>
 */
```

### CSS (`.css`)
```css
/* SPDX-License-Identifier: GPL-2.0-only */
/*
 * Copyright (C) 2026 Your Name <your.email@example.com>
 */
```

### HTML (`.html`)
```html
<!-- SPDX-License-Identifier: GPL-2.0-only -->
<!-- Copyright (C) 2026 Your Name <your.email@example.com> -->
```

For more details on copyright documentation across different file types, refer to our [Copyright & Licensing Guidelines](./dev_guidelines/COPYRIGHT_AND_LICENSING.md).

---

## 4. How to Submit a Contribution

### Step 1: Open an Issue or Discussion
Before starting major work or architecture refactoring, open an issue to discuss your proposal. For small bug fixes or documentation improvements, you can proceed directly to a PR.

### Step 2: Fork and Clone
1. Fork the repository on GitHub: `https://github.com/cparthur1/Flashcards`
2. Clone your fork locally:
   ```bash
   git clone https://github.com/<your-username>/Flashcards.git
   cd Flashcards
   ```
3. Create a descriptive feature branch:
   ```bash
   git checkout -b feature/audio-pronunciation
   ```

### Step 3: Develop & Test
- Follow the visual rules in [`dev_guidelines/DESIGN_LANGUAGE.md`](./dev_guidelines/DESIGN_LANGUAGE.md) (Material Design 3 / Material You).
- Follow the game loop and state management rules in [`dev_guidelines/GAME_ARCHITECTURE_AND_RULES.md`](./dev_guidelines/GAME_ARCHITECTURE_AND_RULES.md).
- Test locally using a simple HTTP server:
  ```bash
  python3 -m http.server 8000
  ```
- Verify that your changes work offline and do not break the PWA Service Worker (`sw.js`).

### Step 4: Commit with DCO Sign-off
Write clear, imperative commit messages and remember the `-s` flag:

```bash
git add .
git commit -s -m "fix(gemini): handle network timeout during streaming card generation"
```

### Step 5: Submit a Pull Request
1. Push your branch to GitHub:
   ```bash
   git push origin feature/audio-pronunciation
   ```
2. Open a Pull Request against the `main` branch of `cparthur1/Flashcards`.
3. Fill out the PR description with:
   - Summary of changes
   - Motivation & context
   - Verification steps tested
   - Confirmation that all commits are signed off under the DCO

---

## 5. Review & Merging

All submissions are reviewed by maintainers. We verify:
1. **DCO Validation**: All commits must pass the automated sign-off check.
2. **SPDX Headers**: Any new source files must have proper SPDX headers.
3. **No Incompatible Licenses**: No code under copyleft-incompatible licenses (e.g., GPL-3.0 without compatibility provisions, AGPL, proprietary code) can be introduced. Permissive code (MIT, BSD-2-Clause, Apache-2.0) is acceptable provided attribution is preserved.
4. **Code Quality & Architecture**: Alignment with project design patterns and zero external build-step requirements.
