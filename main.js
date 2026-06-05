const obsidian = require('obsidian');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const DEFAULT_SETTINGS = {
    repoPaths: [
        "C:\\Users\\aljar\\Documents\\Obsidian",
        "C:\\Users\\aljar\\Documents\\Obsidian\\04_Projects\\Dynamical Representation Geometry",
        "C:\\Users\\aljar\\Documents\\Obsidian\\99_System\\GoogleKeepSync",
        "C:\\Users\\aljar\\Documents\\antigravity\\schedule-assistant-focus-timer",
        "C:\\Users\\aljar\\Dev\\chaos-dashboard"
    ].join('\n'),
    gitAuthor: "",
    targetHeading: "## 🪵 Log"
};

class GitLoggerSettingTab extends obsidian.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'Git Logger Settings' });

        new obsidian.Setting(containerEl)
            .setName('Repository Paths')
            .setDesc('Enter the absolute folder paths of the git repositories you want to track, one path per line.')
            .addTextArea(text => {
                text.setPlaceholder('C:\\path\\to\\repo1\nC:\\path\\to\\repo2')
                    .setValue(this.plugin.settings.repoPaths)
                    .onChange(async (value) => {
                        this.plugin.settings.repoPaths = value;
                        await this.plugin.saveSettings();
                    });
                text.inputEl.rows = 6;
                text.inputEl.style.width = '100%';
            });

        new obsidian.Setting(containerEl)
            .setName('Git Author Filter')
            .setDesc('Only track commits by this author (optional, leave empty to track all commits).')
            .addText(text => text
                .setPlaceholder('e.g., John Doe')
                .setValue(this.plugin.settings.gitAuthor)
                .onChange(async (value) => {
                    this.plugin.settings.gitAuthor = value.trim();
                    await this.plugin.saveSettings();
                }));

        new obsidian.Setting(containerEl)
            .setName('Log Section Heading')
            .setDesc('The heading in your daily note under which the Git Activity section will be placed.')
            .addText(text => text
                .setPlaceholder('## 🪵 Log')
                .setValue(this.plugin.settings.targetHeading)
                .onChange(async (value) => {
                    this.plugin.settings.targetHeading = value.trim();
                    await this.plugin.saveSettings();
                }));
    }
}

module.exports = class GitLoggerPlugin extends obsidian.Plugin {
    async onload() {
        await this.loadSettings();

        // Register setting tab
        this.addSettingTab(new GitLoggerSettingTab(this.app, this));

        // Add command to log git history
        this.addCommand({
            id: 'log-today-git-history',
            name: 'Log Today\'s Git History',
            callback: () => this.logGitHistory(),
        });

        // Add ribbon icon as well for quick logging
        this.addRibbonIcon('git-branch', 'Log Git Activity', () => {
            this.logGitHistory();
        });
    }

    async onunload() {
        console.log("Git Logger unloaded");
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    getLocalDateString() {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    runGitLog(repoPath, date, authorFilter) {
        return new Promise((resolve) => {
            const resolvedPath = path.resolve(repoPath.trim());
            if (!fs.existsSync(resolvedPath)) {
                return resolve({ repoPath: resolvedPath, error: "Directory path does not exist" });
            }

            // Command formats details as hash|time|author|message
            let cmd = `git log --since="${date} 00:00:00" --until="${date} 23:59:59" --pretty=format:"%h|%ad|%an|%s" --date=format:"%H:%M"`;
            if (authorFilter) {
                cmd += ` --author="${authorFilter.replace(/"/g, '\\"')}"`;
            }

            exec(cmd, { cwd: resolvedPath }, (error, stdout, stderr) => {
                if (error) {
                    if (stderr.includes("not a git repository")) {
                        return resolve({ repoPath: resolvedPath, error: "Not a Git repository" });
                    }
                    return resolve({ repoPath: resolvedPath, error: stderr.trim() || error.message });
                }
                resolve({ repoPath: resolvedPath, stdout: stdout.trim() });
            });
        });
    }

    async logGitHistory() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new obsidian.Notice("No active file. Please open a note first.");
            return;
        }

        // Detect date from active file name if format is YYYY-MM-DD.md
        let date = this.getLocalDateString();
        const dateMatch = activeFile.name.match(/^(\d{4}-\d{2}-\d{2})\.md$/);
        if (dateMatch) {
            date = dateMatch[1];
        }

        const repoList = this.settings.repoPaths
            .split('\n')
            .map(p => p.trim())
            .filter(p => p.length > 0);

        if (repoList.length === 0) {
            new obsidian.Notice("No repositories configured in settings.");
            return;
        }

        new obsidian.Notice(`Fetching git activity for ${date}...`);

        const results = await Promise.all(
            repoList.map(repo => this.runGitLog(repo, date, this.settings.gitAuthor))
        );

        let markdownLogs = [];
        let totalCommits = 0;
        let errors = [];

        results.forEach(res => {
            if (res.error) {
                errors.push(`${path.basename(res.repoPath)}: ${res.error}`);
                return;
            }

            if (!res.stdout) {
                return;
            }

            const repoName = path.basename(res.repoPath);
            const commits = res.stdout.split('\n').filter(l => l.trim().length > 0);
            
            if (commits.length > 0) {
                totalCommits += commits.length;
                markdownLogs.push(`**${repoName}**`);
                commits.forEach(commitLine => {
                    const [hash, time, author, msg] = commitLine.split('|');
                    markdownLogs.push(`- \`${hash}\` **${time}** (*${author}*) — ${msg}`);
                });
                markdownLogs.push(""); // Spacing
            }
        });

        if (errors.length > 0) {
            console.warn("Git Logger errors:", errors);
        }

        // Format final logs block
        const startMarker = '<!--START_Antigravity_Git_Log-->';
        const endMarker = '<!--END_Antigravity_Git_Log-->';
        
        let formattedLog = "";
        if (totalCommits > 0) {
            formattedLog = `${startMarker}\n### 🐙 Git Activity (${date})\n\n${markdownLogs.join('\n').trim()}\n${endMarker}`;
        } else {
            formattedLog = `${startMarker}\n### 🐙 Git Activity (${date})\n*No commits logged for today.*\n${endMarker}`;
        }

        // Read active file content
        try {
            const content = await this.app.vault.read(activeFile);
            const lines = content.split('\n');

            let startIndex = -1;
            let endIndex = -1;

            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes(startMarker)) {
                    startIndex = i;
                }
                if (lines[i].includes(endMarker)) {
                    endIndex = i;
                    break;
                }
            }

            if (startIndex !== -1 && endIndex !== -1) {
                // Replace the existing block
                lines.splice(startIndex, endIndex - startIndex + 1, formattedLog);
            } else {
                // Find target heading
                let headingIndex = -1;
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].includes(this.settings.targetHeading)) {
                        headingIndex = i;
                        break;
                    }
                }

                if (headingIndex !== -1) {
                    // Find the end of the target heading section (stop before next header or end of file)
                    let insertIndex = headingIndex + 1;
                    while (insertIndex < lines.length) {
                        if (lines[insertIndex].startsWith('#')) {
                            break;
                        }
                        insertIndex++;
                    }

                    // Insert the log block. Ensure there's a clean line separator if necessary.
                    lines.splice(insertIndex, 0, "", formattedLog);
                } else {
                    // Append section to the end of the file if heading doesn't exist
                    lines.push("", this.settings.targetHeading, "", formattedLog);
                }
            }

            await this.app.vault.modify(activeFile, lines.join('\n'));
            new obsidian.Notice(`Logged ${totalCommits} commits to Daily Note.`);
        } catch (e) {
            console.error("Failed to write to daily note:", e);
            new obsidian.Notice("Failed to update Daily Note: " + e.message);
        }
    }
};
