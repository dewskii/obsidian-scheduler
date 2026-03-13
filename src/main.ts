import { Notice, Plugin } from "obsidian";
import { DEFAULT_SETTINGS } from "./constants";
import { SchedulerService } from "./services/scheduler";
import type { ScheduledTask, SchedulerSettings } from "./types";
import { RunTaskModal } from "./ui/run-task-modal";
import { SchedulerSettingsTab } from "./ui/settings-tab";
import { TaskModal } from "./ui/task-modal";

export default class SchedulerPlugin extends Plugin {
	settings: SchedulerSettings = DEFAULT_SETTINGS;
	scheduler: SchedulerService | null = null;
	addTaskRibbonEl: HTMLElement | null = null;
	runTaskRibbonEl: HTMLElement | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.scheduler = new SchedulerService(
			() => this.settings.tasks,
			(task) => this.executeTask(task),
			() => this.saveSettings(),
			() => this.settings.debugMode,
		);

		// Wait for workspace to be ready before starting scheduler
		this.app.workspace.onLayoutReady(() => {
			this.scheduler?.start();
		});

		this.addSettingTab(new SchedulerSettingsTab(this.app, this));

		this.addCommand({
			id: "add-scheduled-task",
			name: "Add scheduled task",
			callback: () => {
				new TaskModal(this.app, null, (task) => {
					task.lastRun = Date.now();
					this.settings.tasks.push(task);
					void this.saveSettings().then(() => {
						this.restartScheduler();
						new Notice(`Scheduled: "${task.name}"`);
					});
				}).open();
			},
		});

		this.addCommand({
			id: "run-all-tasks",
			name: "Run all enabled tasks now",
			callback: async () => {
				const enabledTasks = this.settings.tasks.filter((t) => t.enabled);
				for (const task of enabledTasks) {
					await this.executeTask(task);
				}
			},
		});

		this.addCommand({
			id: "run-task-adhoc",
			name: "Run task ad-hoc",
			callback: () => this.openRunTaskModal(),
		});

		this.updateRibbonButtons();

		this.addCommand({
			id: "list-scheduled-tasks",
			name: "List scheduled tasks",
			callback: () => {
				const tasks = this.settings.tasks;
				if (tasks.length === 0) {
					new Notice("No scheduled tasks configured");
					return;
				}

				const summary = tasks
					.map((t) => {
						const status = t.enabled ? "✓" : "✗";
						return `${status} ${t.name}`;
					})
					.join("\n");

				new Notice(`Scheduled Tasks:\n${summary}`, 5000);
			},
		});

		this.log("Scheduler plugin loaded");
	}

	onunload(): void {
		this.scheduler?.stop();
		this.log("Scheduler plugin unloaded");
	}

	async loadSettings(): Promise<void> {
		const loaded = (await this.loadData()) as Partial<SchedulerSettings> | null;
		this.settings = { ...DEFAULT_SETTINGS, ...loaded };
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	restartScheduler(): void {
		this.scheduler?.restart();
	}

	async executeTask(task: ScheduledTask): Promise<void> {
		this.log(`Executing task: ${task.name}`);

		try {
			if (task.type === "command") {
				this.executeCommand(task);
			} else if (task.type === "script") {
				await this.executeScript(task);
			}

			task.lastRun = Date.now();
			await this.saveSettings();

			if (this.settings.showNotifications) {
				new Notice(`Scheduler: Ran "${task.name}"`);
			}
		} catch (error) {
			console.error(`[Scheduler] Error executing task "${task.name}":`, error);
			new Notice(`Scheduler: Failed to run "${task.name}"`);
		}
	}

	private executeCommand(task: ScheduledTask): void {
		const commandId = task.target;

		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- executeCommandById exists but isn't in types
		const result = this.app.commands.executeCommandById(commandId);

		if (result === false) {
			throw new Error(`Command "${commandId}" not found or failed to execute`);
		}

		this.log(`Executed command: ${commandId}`);
	}

	private async executeScript(task: ScheduledTask): Promise<void> {
		const scriptPath = task.target;
		const scriptFile = this.app.vault.getAbstractFileByPath(scriptPath);
		if (!scriptFile) {
			throw new Error(`Script file not found: ${scriptPath}`);
		}

		// @ts-expect-error - TFile check
		const scriptContent = await this.app.vault.read(scriptFile);

		// Wrap in async to support top-level await
		try {
			const wrappedScript = `return (async (app, Notice) => { ${scriptContent} })(app, Notice)`;
			// eslint-disable-next-line @typescript-eslint/no-implied-eval -- Dynamic script execution requires Function constructor
			const scriptFn = new Function("app", "Notice", wrappedScript);
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call -- Dynamic script execution
			await scriptFn(this.app, Notice);
			this.log(`Executed script: ${scriptPath}`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(`Script execution failed: ${message}`);
		}
	}

	private openRunTaskModal(): void {
		new RunTaskModal(this.app, this.settings.tasks, async (task) => this.executeTask(task)).open();
	}

	updateRibbonButtons(): void {
		// Remove existing ribbons if present
		if (this.addTaskRibbonEl) {
			this.addTaskRibbonEl.remove();
			this.addTaskRibbonEl = null;
		}
		if (this.runTaskRibbonEl) {
			this.runTaskRibbonEl.remove();
			this.runTaskRibbonEl = null;
		}

		// Add ribbons if setting is enabled
		if (this.settings.showRibbonButtons) {
			this.addTaskRibbonEl = this.addRibbonIcon("calendar-clock", "Add scheduled task", () => {
				new TaskModal(this.app, null, (task) => {
					task.lastRun = Date.now();
					this.settings.tasks.push(task);
					void this.saveSettings().then(() => {
						this.restartScheduler();
						new Notice(`Scheduled: "${task.name}"`);
					});
				}).open();
			});
			this.runTaskRibbonEl = this.addRibbonIcon("play", "Run task ad-hoc", () => {
				this.openRunTaskModal();
			});
		}
	}

	private log(message: string): void {
		if (this.settings.debugMode) {
			console.debug(`[Scheduler] ${message}`);
		}
	}
}
