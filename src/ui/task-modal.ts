import { type App, Modal, Setting } from "obsidian";
import { DAYS_OF_WEEK, DEFAULT_TASK } from "../constants";
import type { CommandInfo, ScheduledTask } from "../types";
import { FilePathSuggest } from "./file-path-suggest";

export class TaskModal extends Modal {
	private task: ScheduledTask;
	private isNew: boolean;
	private onSave: (task: ScheduledTask) => void;
	private commands: CommandInfo[] = [];

	constructor(app: App, task: ScheduledTask | null, onSave: (task: ScheduledTask) => void) {
		super(app);
		this.onSave = onSave;
		this.isNew = task === null;
		this.task = task ?? {
			...DEFAULT_TASK,
			id: crypto.randomUUID(),
		};
	}

	onOpen(): void {
		this.commands = this.getAvailableCommands();
		this.render();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("scheduler-modal");

		contentEl.createEl("h2", { text: this.isNew ? "New Scheduled Task" : "Edit Scheduled Task" });

		new Setting(contentEl).setName("Task Name").addText((text) =>
			text
				.setPlaceholder("My scheduled task")
				.setValue(this.task.name)
				.onChange((value) => {
					this.task.name = value;
				}),
		);

		new Setting(contentEl)
			.setName("Enabled")
			.setDesc("Turn this task on or off")
			.addToggle((toggle) =>
				toggle.setValue(this.task.enabled).onChange((value) => {
					this.task.enabled = value;
				}),
			);

		new Setting(contentEl)
			.setName("Task Type")
			.setDesc("What to execute")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("command", "Obsidian Command")
					.addOption("script", "JavaScript File")
					.setValue(this.task.type)
					.onChange((value) => {
						this.task.type = value as "command" | "script";
						this.task.target = "";
						this.render();
					}),
			);

		if (this.task.type === "command") {
			this.renderCommandPicker(contentEl);
		} else {
			this.renderScriptPicker(contentEl);
		}

		new Setting(contentEl).setName("Schedule").setHeading();

		new Setting(contentEl).setName("Schedule Type").addDropdown((dropdown) =>
			dropdown
				.addOption("daily", "Daily at specific time")
				.addOption("interval", "Every X minutes")
				.addOption("cron", "Cron expression")
				.setValue(this.task.schedule.type)
				.onChange((value) => {
					this.task.schedule.type = value as "daily" | "interval" | "cron";
					this.render();
				}),
		);

		if (this.task.schedule.type === "daily") {
			this.renderDailySchedule(contentEl);
		} else if (this.task.schedule.type === "interval") {
			this.renderIntervalSchedule(contentEl);
		} else if (this.task.schedule.type === "cron") {
			this.renderCronSchedule(contentEl);
		}

		// Run on Missed
		new Setting(contentEl)
			.setName("Run if missed")
			.setDesc("Execute this task on startup if it was missed while Obsidian was closed")
			.addToggle((toggle) =>
				toggle.setValue(this.task.runOnMissed).onChange((value) => {
					this.task.runOnMissed = value;
				}),
			);

		// Action Buttons
		new Setting(contentEl)
			.addButton((btn) =>
				btn.setButtonText("Cancel").onClick(() => {
					this.close();
				}),
			)
			.addButton((btn) =>
				btn
					.setButtonText("Save")
					.setCta()
					.onClick(() => {
						if (!this.task.target) {
							// Show error
							return;
						}
						this.onSave(this.task);
						this.close();
					}),
			);
	}

	private renderCommandPicker(containerEl: HTMLElement): void {
		const setting = new Setting(containerEl)
			.setName("Command")
			.setDesc("Select the command to run");

		setting.addDropdown((dropdown) => {
			dropdown.addOption("", "Select a command...");

			for (const cmd of this.commands) {
				dropdown.addOption(cmd.id, cmd.name);
			}

			dropdown.setValue(this.task.target);
			dropdown.onChange((value) => {
				this.task.target = value;
			});
		});

		// Show currently selected command info
		if (this.task.target) {
			const selected = this.commands.find((c) => c.id === this.task.target);
			if (selected) {
				setting.setDesc(`Selected: ${selected.name}`);
			}
		}
	}

	private renderScriptPicker(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName("Script Path")
			.setDesc(
				"Path to JavaScript file (relative to vault root). Script receives 'app' and 'Notice'.",
			)
			.addText((text) => {
				text.setPlaceholder("templates/scripts/my-script.js");
				text.setValue(this.task.target);
				text.inputEl.style.width = "100%";
				text.inputEl.addClass("scheduler-script-input");
				text.onChange((value) => {
					this.task.target = value;
				});

				// Attach fuzzy file suggester
				new FilePathSuggest(this.app, text.inputEl, ".js");

				return text;
			});
	}

	private renderDailySchedule(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName("Time")
			.setDesc("Time of day to run (24-hour format)")
			.addText((text) =>
				text
					.setPlaceholder("06:00")
					.setValue(this.task.schedule.time ?? "06:00")
					.onChange((value) => {
						// Validate HH:mm format
						if (/^\d{2}:\d{2}$/.test(value)) {
							this.task.schedule.time = value;
						}
					}),
			);

		// Days of week
		new Setting(containerEl)
			.setName("Days of Week")
			.setDesc("Leave empty for every day, or select specific days");

		const daysContainer = containerEl.createDiv({ cls: "scheduler-days-container" });
		daysContainer.style.display = "flex";
		daysContainer.style.gap = "8px";
		daysContainer.style.marginBottom = "16px";
		daysContainer.style.paddingLeft = "16px";

		for (const day of DAYS_OF_WEEK) {
			const dayEl = daysContainer.createEl("label", {
				cls: "scheduler-day-checkbox",
			});
			dayEl.style.display = "flex";
			dayEl.style.alignItems = "center";
			dayEl.style.gap = "4px";

			const checkbox = dayEl.createEl("input", { type: "checkbox" });
			checkbox.checked = this.task.schedule.daysOfWeek?.includes(day.value) ?? false;
			checkbox.addEventListener("change", () => {
				if (!this.task.schedule.daysOfWeek) {
					this.task.schedule.daysOfWeek = [];
				}
				if (checkbox.checked) {
					if (!this.task.schedule.daysOfWeek.includes(day.value)) {
						this.task.schedule.daysOfWeek.push(day.value);
					}
				} else {
					this.task.schedule.daysOfWeek = this.task.schedule.daysOfWeek.filter(
						(d) => d !== day.value,
					);
				}
			});

			dayEl.createSpan({ text: day.label });
		}
	}

	private renderIntervalSchedule(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName("Interval")
			.setDesc("Run every X minutes")
			.addText((text) =>
				text
					.setPlaceholder("60")
					.setValue(String(this.task.schedule.intervalMinutes ?? 60))
					.onChange((value) => {
						const num = Number.parseInt(value, 10);
						if (!Number.isNaN(num) && num > 0) {
							this.task.schedule.intervalMinutes = num;
						}
					}),
			);
	}

	private renderCronSchedule(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName("Cron Expression")
			.setDesc("Standard cron syntax: minute hour day month weekday")
			.addText((text) =>
				text
					.setPlaceholder("0 0 * * *")
					.setValue(this.task.schedule.cronExpression ?? "")
					.onChange((value) => {
						this.task.schedule.cronExpression = value;
					}),
			);

		// Help text
		const helpEl = containerEl.createDiv({ cls: "scheduler-cron-help" });
		helpEl.style.paddingLeft = "16px";
		helpEl.style.marginBottom = "16px";
		helpEl.style.fontSize = "0.85em";
		helpEl.style.color = "var(--text-muted)";

		helpEl.innerHTML = `
			<div style="margin-bottom: 8px;"><strong>Examples:</strong></div>
			<div><code>0 0 * * *</code> — Midnight daily</div>
			<div><code>0 9,17 * * *</code> — 9am and 5pm daily</div>
			<div><code>0 9 * * 1-5</code> — 9am weekdays</div>
			<div><code>0 0 1 * *</code> — 1st of each month</div>
			<div style="margin-top: 8px;"><a href="https://crontab.guru/" target="_blank">crontab.guru</a> — cron helper</div>
		`;
	}

	private getAvailableCommands(): CommandInfo[] {
		const commands: CommandInfo[] = [];

		// @ts-expect-error - commands.commands is not in types but exists
		const cmdRegistry = this.app.commands.commands;
		if (cmdRegistry) {
			for (const cmd of Object.values(cmdRegistry)) {
				const command = cmd as { id: string; name: string };
				commands.push({
					id: command.id,
					name: command.name,
				});
			}
		}

		return commands.sort((a, b) => a.name.localeCompare(b.name));
	}
}
