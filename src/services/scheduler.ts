import { CronExpressionParser } from "cron-parser";
import { MISSED_TASK_WINDOW, SCHEDULER_CHECK_INTERVAL } from "../constants";
import type { ScheduledTask } from "../types";

export class SchedulerService {
	private checkInterval: ReturnType<typeof setInterval> | null = null;
	private onTaskExecute: (task: ScheduledTask) => Promise<void>;
	private onTasksUpdated: () => Promise<void>;
	private getTasks: () => ScheduledTask[];
	private debugMode: () => boolean;

	constructor(
		getTasks: () => ScheduledTask[],
		onTaskExecute: (task: ScheduledTask) => Promise<void>,
		onTasksUpdated: () => Promise<void>,
		debugMode: () => boolean,
	) {
		this.getTasks = getTasks;
		this.onTaskExecute = onTaskExecute;
		this.onTasksUpdated = onTasksUpdated;
		this.debugMode = debugMode;
	}

	start(): void {
		this.log("Starting scheduler service");
		this.checkMissedTasks();
		this.startPeriodicCheck();
	}

	stop(): void {
		this.log("Stopping scheduler service");
		if (this.checkInterval) {
			clearInterval(this.checkInterval);
			this.checkInterval = null;
		}
	}

	restart(): void {
		this.stop();
		this.start();
	}

	private startPeriodicCheck(): void {
		this.checkInterval = setInterval(() => {
			this.checkScheduledTasks();
		}, SCHEDULER_CHECK_INTERVAL);
	}

	private async checkScheduledTasks(): Promise<void> {
		const now = new Date();
		const tasks = this.getTasks();

		for (const task of tasks) {
			if (!task.enabled) continue;

			if (this.shouldTaskRun(task, now)) {
				await this.executeTask(task);
			}
		}
	}

	private shouldTaskRun(task: ScheduledTask, now: Date): boolean {
		const { schedule } = task;

		if (schedule.type === "daily") {
			return this.shouldDailyTaskRun(task, now);
		}
		if (schedule.type === "interval") {
			return this.shouldIntervalTaskRun(task, now);
		}
		if (schedule.type === "cron") {
			return this.shouldCronTaskRun(task, now);
		}

		return false;
	}

	private shouldDailyTaskRun(task: ScheduledTask, now: Date): boolean {
		const { schedule, lastRun } = task;
		if (!schedule.time) return false;

		const cronExpression = this.dailyToCron(schedule.time, schedule.daysOfWeek);

		try {
			const interval = CronExpressionParser.parse(cronExpression, { currentDate: now });
			const prevRun = interval.prev().toDate();

			if (!lastRun) return true;
			return prevRun.getTime() > lastRun;
		} catch (error) {
			this.log(`Invalid cron for daily task "${task.name}": ${error}`);
			return false;
		}
	}

	private dailyToCron(time: string, daysOfWeek?: number[]): string {
		const [hours, minutes] = time.split(":").map(Number);
		const daysPart =
			daysOfWeek && daysOfWeek.length > 0 ? daysOfWeek.sort((a, b) => a - b).join(",") : "*";
		return `${minutes} ${hours} * * ${daysPart}`;
	}

	private shouldIntervalTaskRun(task: ScheduledTask, now: Date): boolean {
		const { schedule, lastRun } = task;
		if (!schedule.intervalMinutes) return false;
		if (!lastRun) return true;

		const msSinceLastRun = now.getTime() - lastRun;
		const msInterval = schedule.intervalMinutes * 60 * 1000;

		return msSinceLastRun >= msInterval;
	}

	private shouldCronTaskRun(task: ScheduledTask, now: Date): boolean {
		const { schedule, lastRun } = task;
		if (!schedule.cronExpression) return false;

		try {
			const interval = CronExpressionParser.parse(schedule.cronExpression, { currentDate: now });
			const prevRun = interval.prev().toDate();

			if (!lastRun) return true;
			return prevRun.getTime() > lastRun;
		} catch (error) {
			this.log(`Invalid cron expression for task "${task.name}": ${error}`);
			return false;
		}
	}

	private async checkMissedTasks(): Promise<void> {
		this.log("Checking for missed tasks");
		const now = new Date();
		const tasks = this.getTasks();
		let anyTasksRun = false;

		for (const task of tasks) {
			if (!task.enabled || !task.runOnMissed) continue;

			if (this.wasMissed(task, now)) {
				this.log(`Task "${task.name}" was missed, running now`);
				await this.executeTask(task);
				anyTasksRun = true;
			}
		}

		if (anyTasksRun) {
			await this.onTasksUpdated();
		}
	}

	private wasMissed(task: ScheduledTask, now: Date): boolean {
		const { schedule } = task;

		if (schedule.type === "daily") {
			return this.wasCronTaskMissed(
				task,
				now,
				this.dailyToCron(schedule.time!, schedule.daysOfWeek),
			);
		}
		if (schedule.type === "interval") {
			return this.shouldIntervalTaskRun(task, now);
		}
		if (schedule.type === "cron") {
			return this.wasCronTaskMissed(task, now, schedule.cronExpression!);
		}

		return false;
	}

	private wasCronTaskMissed(task: ScheduledTask, now: Date, cronExpression: string): boolean {
		const { lastRun } = task;

		try {
			const interval = CronExpressionParser.parse(cronExpression, { currentDate: now });
			const prevScheduled = interval.prev().toDate();

			if (!lastRun) return true;

			// Beyond grace period == definitely missed
			if (now.getTime() - lastRun > MISSED_TASK_WINDOW) return true;

			return prevScheduled.getTime() > lastRun;
		} catch (error) {
			this.log(`Invalid cron expression: ${error}`);
			return false;
		}
	}

	private async executeTask(task: ScheduledTask): Promise<void> {
		this.log(`Executing task: ${task.name}`);
		try {
			await this.onTaskExecute(task);
		} catch (error) {
			console.error(`[Scheduler] Error executing task "${task.name}":`, error);
		}
	}

	getNextRunTime(task: ScheduledTask): Date | null {
		if (!task.enabled) return null;

		const now = new Date();
		const { schedule } = task;

		if (schedule.type === "interval") {
			return this.getNextIntervalRunTime(task, now);
		}

		const cronExpression =
			schedule.type === "daily"
				? this.dailyToCron(schedule.time!, schedule.daysOfWeek)
				: schedule.cronExpression;

		if (!cronExpression) return null;

		try {
			const interval = CronExpressionParser.parse(cronExpression, { currentDate: now });
			return interval.next().toDate();
		} catch {
			return null;
		}
	}

	private getNextIntervalRunTime(task: ScheduledTask, now: Date): Date | null {
		const { schedule, lastRun } = task;
		if (!schedule.intervalMinutes) return null;

		if (!lastRun) {
			return now; // RIGHT NOW
		}

		const msInterval = schedule.intervalMinutes * 60 * 1000;
		return new Date(lastRun + msInterval);
	}

	private log(message: string): void {
		if (this.debugMode()) {
			console.log(`[Scheduler] ${message}`);
		}
	}
}
