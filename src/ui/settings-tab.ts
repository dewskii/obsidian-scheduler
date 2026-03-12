import { type App, Notice, PluginSettingTab, Setting } from "obsidian";
import type SchedulerPlugin from "../main";
import type { ScheduledTask } from "../types";
import { TaskModal } from "./task-modal";

export class SchedulerSettingsTab extends PluginSettingTab {
	plugin: SchedulerPlugin;

	constructor(app: App, plugin: SchedulerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		new Setting(containerEl).setName("Scheduled tasks").setHeading();

		new Setting(containerEl).setDesc(
			"Schedule Obsidian commands to run automatically at specific times or intervals. " +
				"Tasks will run while Obsidian is open, and missed tasks can optionally run on startup.",
		);

		if (this.plugin.settings.tasks.length === 0) {
			containerEl.createEl("p", {
				text: "No scheduled tasks yet. Click 'Add Task' to create one.",
				cls: "setting-item-description",
			});
		} else {
			for (const task of this.plugin.settings.tasks) {
				this.renderTaskItem(containerEl, task);
			}
		}

		new Setting(containerEl).addButton((btn) =>
			btn
				.setButtonText("Add task")
				.setCta()
				.onClick(() => {
					new TaskModal(this.app, null, async (task) => {
						// don't run as soon as it's created
						task.lastRun = Date.now();

						this.plugin.settings.tasks.push(task);

						await this.plugin.saveSettings();

						this.plugin.restartScheduler();

						this.display();

						new Notice(`Scheduled: "${task.name}"`);
					}).open();
				}),
		);

		new Setting(containerEl).setName("General").setHeading();

		new Setting(containerEl)
			.setName("Show notifications")
			.setDesc("Display a notice when scheduled tasks run")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.showNotifications).onChange(async (value) => {
					this.plugin.settings.showNotifications = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Show ribbon buttons")
			.setDesc("Show ribbon buttons for adding and running tasks")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.showRibbonButtons).onChange(async (value) => {
					this.plugin.settings.showRibbonButtons = value;
					await this.plugin.saveSettings();
					this.plugin.updateRibbonButtons();
				}),
			);

		new Setting(containerEl)
			.setName("Debug mode")
			.setDesc("Log scheduler activity to the console")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.debugMode).onChange(async (value) => {
					this.plugin.settings.debugMode = value;
					await this.plugin.saveSettings();
				}),
			);
	}

	private renderTaskItem(containerEl: HTMLElement, task: ScheduledTask): void {
		const taskEl = containerEl.createDiv({
			cls: `scheduler-task-item ${task.enabled ? "" : "disabled"}`,
		});

		const infoEl = taskEl.createDiv({ cls: "scheduler-task-info" });

		const nameEl = infoEl.createDiv({ cls: "scheduler-task-name" });
		nameEl.createSpan({
			text: task.enabled ? "●" : "○",
			cls: task.enabled ? "scheduler-status-enabled" : "scheduler-status-disabled",
		});
		nameEl.createSpan({ text: task.name });

		const scheduleText = this.getScheduleDescription(task);

		infoEl.createDiv({
			cls: "scheduler-task-schedule",
			text: scheduleText,
		});

		const nextRun = this.plugin.scheduler?.getNextRunTime(task);

		if (nextRun && task.enabled) {
			infoEl.createDiv({
				cls: "scheduler-next-run",
				text: `Next: ${this.formatNextRun(nextRun)}`,
			});
		}

		const actionsEl = taskEl.createDiv({ cls: "scheduler-task-actions" });

		const runBtn = actionsEl.createEl("button", { text: "▶", attr: { "aria-label": "Run now" } });
		runBtn.addEventListener("click", async () => {
			await this.plugin.executeTask(task);
		});

		const editBtn = actionsEl.createEl("button", { text: "✎", attr: { "aria-label": "Edit" } });
		editBtn.addEventListener("click", () => {
			new TaskModal(this.app, { ...task }, async (updatedTask) => {
				const index = this.plugin.settings.tasks.findIndex((t: ScheduledTask) => t.id === task.id);
				if (index !== -1) {
					this.plugin.settings.tasks[index] = updatedTask;
					await this.plugin.saveSettings();
					this.plugin.restartScheduler();
					this.display();
				}
			}).open();
		});

		const deleteBtn = actionsEl.createEl("button", {
			text: "✕",
			attr: { "aria-label": "Delete" },
		});
		deleteBtn.addEventListener("click", async () => {
			this.plugin.settings.tasks = this.plugin.settings.tasks.filter(
				(t: ScheduledTask) => t.id !== task.id,
			);
			await this.plugin.saveSettings();
			this.plugin.restartScheduler();
			this.display();
		});
	}

	private getScheduleDescription(task: ScheduledTask): string {
		const { schedule } = task;

		if (schedule.type === "daily") {
			let desc = `Daily at ${schedule.time}`;
			if (schedule.daysOfWeek && schedule.daysOfWeek.length > 0 && schedule.daysOfWeek.length < 7) {
				const days = schedule.daysOfWeek
					.sort()
					.map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d])
					.join(", ");
				desc = `${schedule.time} on ${days}`;
			}
			return desc;
		}

		if (schedule.type === "interval") {
			const mins = schedule.intervalMinutes ?? 60;
			if (mins >= 60) {
				const hours = mins / 60;
				return `Every ${hours} hour${hours !== 1 ? "s" : ""}`;
			}
			return `Every ${mins} minute${mins !== 1 ? "s" : ""}`;
		}

		return "Unknown schedule";
	}

	private formatNextRun(date: Date): string {
		const now = new Date();
		const isToday = date.toDateString() === now.toDateString();
		const isTomorrow = date.toDateString() === new Date(now.getTime() + 86400000).toDateString();

		const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

		if (isToday) {
			return `Today at ${timeStr}`;
		}
		if (isTomorrow) {
			return `Tomorrow at ${timeStr}`;
		}
		return (
			date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }) +
			` at ${timeStr}`
		);
	}
}
