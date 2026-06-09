# Git Logger for Obsidian

An automation plugin for Obsidian that bridges the gap between your local version control and your personal knowledge management by aggregating daily Git commit activity across multiple repositories and logging it directly into your daily notes.

## 🛠️ Core Features

* **Multi-Repository Aggregation**: Configure an array of absolute repository paths to track your daily developer activity across multiple disparate codebases.
* **Intelligent Daily Note Injection**: Safely parses your active daily note and dynamically injects a formatted `### 🐙 Git Activity` markdown block underneath a customizable target heading (e.g. `## 🪵 Log`).
* **Author Filtering**: Filter commits by specific Git authors to filter out noisy team activity when logging personal accomplishments.
* **Idempotent Updates**: Uses HTML comment markers (`<!--START_Antigravity_Git_Log-->`) to ensure that multiple daily syncs overwrite the previous log cleanly rather than duplicating entries.

## ⚙️ Architecture

* **Tech Stack**: JavaScript (Obsidian API), Node.js `child_process`.
* **Execution**: Wraps the native `git log` CLI using asynchronous `Promise.all` executions for parallelized log fetching across multiple repositories without blocking the Electron renderer thread. 
