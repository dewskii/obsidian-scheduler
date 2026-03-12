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
		const statusCls = task.enabled ? "scheduler-status-enabled" : "scheduler-status-disabled";

		container.createSpan({
			text: statusIcon,
			cls: `scheduler-status-icon ${statusCls}`,
		});

		container.createSpan({ text: task.name });

		const typeLabel = task.type === "command" ? "Command" : "Script";
		container.createSpan({
			text: typeLabel,
			cls: "scheduler-run-task-type",
		});
	}

	onChooseSuggestion(task: ScheduledTask, _evt: MouseEvent | KeyboardEvent): void {
		void this.onRun(task).catch((_error) => {
			console.error(_error);
			new Notice(`Failed to run "${task.name}"`);
		});
	}

	onNoSuggestion(): void {
		this.resultContainerEl.empty();
		this.resultContainerEl.createDiv({
			text: "No tasks configured. Add tasks in the plugin settings.",
			cls: "suggestion-empty scheduler-no-tasks",
		});
	}
}
