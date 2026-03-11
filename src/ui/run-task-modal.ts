import { type App, Notice, SuggestModal } from "obsidian";
import type { ScheduledTask } from "../types";

export class RunTaskModal extends SuggestModal<ScheduledTask> {
	private tasks: ScheduledTask[];
	private onRun: (task: ScheduledTask) => Promise<void>;

	constructor(app: App, tasks: ScheduledTask[], onRun: (task: ScheduledTask) => Promise<void>) {
		super(app);
		this.tasks = tasks;
		this.onRun = onRun;
		this.setPlaceholder("Search tasks to run...");
	}

	getSuggestions(query: string): ScheduledTask[] {
		const lowerQuery = query.toLowerCase();
		return this.tasks.filter((task) => task.name.toLowerCase().includes(lowerQuery));
	}

	renderSuggestion(task: ScheduledTask, el: HTMLElement): void {
		const container = el.createDiv({ cls: "scheduler-run-task-item" });

		const statusIcon = task.enabled ? "●" : "○";
		const statusColor = task.enabled ? "var(--text-success)" : "var(--text-muted)";

		container.createSpan({
			text: statusIcon,
			attr: { style: `color: ${statusColor}; margin-right: 8px;` },
		});

		container.createSpan({ text: task.name });

		const typeLabel = task.type === "command" ? "Command" : "Script";
		container.createSpan({
			text: typeLabel,
			cls: "scheduler-run-task-type",
			attr: {
				style: "margin-left: auto; color: var(--text-muted); font-size: 0.85em;",
			},
		});
	}

	async onChooseSuggestion(task: ScheduledTask, _evt: MouseEvent | KeyboardEvent): Promise<void> {
		try {
			await this.onRun(task);
		} catch (_error) {
			new Notice(`Failed to run "${task.name}"`);
		}
	}

	onNoSuggestion(): void {
		this.resultContainerEl.empty();
		this.resultContainerEl.createDiv({
			text: "No tasks configured. Add tasks in the plugin settings.",
			cls: "suggestion-empty",
			attr: { style: "padding: 10px; color: var(--text-muted);" },
		});
	}
}
