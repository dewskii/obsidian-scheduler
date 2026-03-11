export interface ScheduledTask {
	id: string;
	name: string;
	enabled: boolean;
	type: "command" | "script";
	target: string;
	schedule: TaskSchedule;
	lastRun?: number;
	runOnMissed: boolean;
}

export interface TaskSchedule {
	type: "daily" | "interval" | "cron";
	time?: string;
	intervalMinutes?: number;
	daysOfWeek?: number[];
	cronExpression?: string;
}

export interface SchedulerSettings {
	tasks: ScheduledTask[];
	showNotifications: boolean;
	showRibbonButtons: boolean;
	debugMode: boolean;
}

export interface CommandInfo {
	id: string;
	name: string;
}
