# Scheduler
Run commands or javascript functions on a schedule.

## Features
Tasks can be scheduled using either an existing command, or you're own javascript.

**Schedule types:**
- **Daily** — Run at a specific time, optionally on certain days of the week
- **Interval** — Run every n minutes
- **Cron** — Cron scheduling if you need more granular scheduling (i.e. [0 9,17 * * 1-5](https://crontab.guru/#0_9,17_*_*_1-5))

## Quick start
Basic scheduled command setup
1. Click the scheduler calendar icon in the ribbon bar
2. Pick a command or script, set your schedule
3. Optionally, execute you script adhoc

## User scripts
Plugin supports custom user scripts as well. Scripts have full access to the Obsidian API.

```javascript
// my_scripts/hello.js
new Notice("Hello from Scheduler!");

// Access the vault
const files = app.vault.getMarkdownFiles();
console.log(`You have ${files.length} notes`);

// Access other plugins
const templater = app.plugins.plugins["templater"];
if (templater) {
	//syntax {plugin name}:{command slug}
	app.commands.executeCommandById('templater:create/basic-note')
}
// Create a file
await app.vault.create("generated-note.md", "# Created by Scheduler");
```

> [!NOTE] 
> Plugin handles sync and async functions, no need to wrap your scripts in async().

## Missed tasks
Enable **"Run if missed"** on a task, and Scheduler will catch up when Obsidian starts. Useful for daily routines that might get skipped if Obsidian wasn't open.

## Commands
- `Scheduler: Add scheduled task` — Create a new task
- `Scheduler: Run all enabled tasks now` — Trigger everything immediately
- `Scheduler: List scheduled tasks` — See what's configured

## Cron syntax

Scheduler support cron schedules if you require more specific scheduling.

| Expression          | Meaning                          |
| ------------------- | -------------------------------- |
| `0 0 * * *`         | Midnight daily                   |
| `0 9,17 * * *`      | 9am and 5pm                      |
| `0 9 * * 1-5`       | 9am on weekdays                  |
| `0 0 1 * *`         | 1st of each month                |
| `*/15 * * * *`      | Every 15 minutes                 |
| `0 9,12,17 * * 2,4` | 9am, 12pm, 5pm on Tues and Thurs |

See [crontab.guru](https://crontab.guru/) for help building expressions.

## Installation

Until the plugin is reviewed and published by Obsidian, It's recommended to use the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin to install Scheduler.

### Manual Installation
Download the zip file from the most recent release and copy `main.js`, `manifest.json`, and `styles.css` to your obsidian's plugin directory (`your-vault/.obsidian/plugins/scheduler/`)
