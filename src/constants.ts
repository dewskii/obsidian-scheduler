import type { ScheduledTask, SchedulerSettings } from "./types";

export const DEFAULT_SETTINGS: SchedulerSettings = {
	tasks: [],
	showNotifications: true,
	showRibbonButtons: false,
	debugMode: false,
};

export const DEFAULT_TASK: Omit<ScheduledTask, "id"> = {
	name: "New Task",
	enabled: true,
	type: "command",
	target: "",
	schedule: {
		type: "daily",
		time: "06:00",
		daysOfWeek: [],
	},
	runOnMissed: true,
};

export const DAYS_OF_WEEK = [
	{ value: 0, label: "Sun" },
	{ value: 1, label: "Mon" },
	{ value: 2, label: "Tue" },
	{ value: 3, label: "Wed" },
	{ value: 4, label: "Thu" },
	{ value: 5, label: "Fri" },
	{ value: 6, label: "Sat" },
];

export const SCHEDULER_CHECK_INTERVAL = 60_000; // 1 minute

export const MISSED_TASK_WINDOW = 24 * 60 * 60 * 1000; // 24 hours
