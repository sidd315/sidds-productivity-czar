export type Priority = "Urgent" | "Important" | "Inevitably important";
export type RecurrenceFreq = "daily" | "weekly" | "monthly";
export type SubTask = { id: string; title: string; done: boolean };
export type Recurrence = { freq: RecurrenceFreq };

export type Task = {
  id: string;
  title: string;
  note?: string;
  createdAt: number;
  dueAt?: number | null;
  priority?: Priority;
  tags?: string[];
  recurrence?: Recurrence;
  subtasks?: SubTask[];
};

export const COLUMN_DEFS = [
  { id: "pending", title: "Pending", accent: "#0866FF" },
  { id: "inprogress", title: "In Progress", accent: "#0866FF" },
  { id: "action", title: "Action Taken", accent: "#0866FF" },
  { id: "done", title: "Completed", accent: "#0866FF" },
] as const;

export type ColumnId = typeof COLUMN_DEFS[number]["id"];

export type RecurringSchedule = {
  id: string;
  template: { title: string; note?: string; priority?: Priority; tags?: string[]; recurrence: Recurrence };
  nextAt: number; // epoch ms (local) when the next instance should be created
};

export type BoardState = Record<ColumnId, Task[]> & {
  archived: Task[];
  schedules: RecurringSchedule[];
};

export const META_BLUE = "#0866FF";
export const BG_SURFACE = "#f6f7f9";
export const STORAGE_KEY = "sidd_productivity_czar_v1";

export const SUGGESTED_TAGS = [
  "housekeeping","health","work","fitness","errands","learning","finance","family","personal"
];
