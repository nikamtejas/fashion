import { EventEmitter } from "node:events";
import crypto from "node:crypto";

export type PhotoSlot = "studio_front" | "studio_back" | "model_front" | "lifestyle";
export type PhotoStatus = "pending" | "generating" | "checking" | "regenerating" | "done" | "failed" | "flagged";

export interface PhotoSlotState {
  status: PhotoStatus;
  imageUrl?: string;
  imageId?: string;
  attempt: number;
  error?: string;
  issues?: string[];
}

export interface PhotoJobState {
  productId: string;
  photos: Record<PhotoSlot, PhotoSlotState>;
  done: boolean;
  startedAt: number;
}

interface JobEntry {
  state: PhotoJobState;
  emitter: EventEmitter;
}

const jobs = new Map<string, JobEntry>();

function emptySlotState(): PhotoSlotState {
  return { status: "pending", attempt: 0 };
}

export function createJob(productId: string): { jobId: string; entry: JobEntry } {
  const jobId = crypto.randomUUID();
  const entry: JobEntry = {
    state: {
      productId,
      photos: {
        studio_front: emptySlotState(),
        studio_back: emptySlotState(),
        model_front: emptySlotState(),
        lifestyle: emptySlotState(),
      },
      done: false,
      startedAt: Date.now(),
    },
    emitter: new EventEmitter(),
  };
  jobs.set(jobId, entry);
  // Avoid unbounded memory growth across a long dev session.
  setTimeout(() => jobs.delete(jobId), 30 * 60 * 1000).unref();
  return { jobId, entry };
}

export function getJob(jobId: string): JobEntry | undefined {
  return jobs.get(jobId);
}

export function updateSlot(entry: JobEntry, slot: PhotoSlot, patch: Partial<PhotoSlotState>) {
  entry.state.photos[slot] = { ...entry.state.photos[slot], ...patch };
  entry.emitter.emit("update", entry.state);
}

export function finishJob(entry: JobEntry) {
  entry.state.done = true;
  entry.emitter.emit("update", entry.state);
  entry.emitter.emit("done");
}
