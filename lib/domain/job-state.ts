import type { JobStatus } from "../contracts/assessment";

const allowedTransitions: Record<JobStatus, readonly JobStatus[]> = {
  queued: ["processing", "failed"],
  processing: ["completed", "failed"],
  completed: [],
  failed: [],
};

export class InvalidJobTransitionError extends Error {
  readonly from: JobStatus;
  readonly to: JobStatus;

  constructor(from: JobStatus, to: JobStatus) {
    super(`Invalid job transition: ${from} -> ${to}`);
    this.name = "InvalidJobTransitionError";
    this.from = from;
    this.to = to;
  }
}

export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return allowedTransitions[from].includes(to);
}

export function transitionJobState(from: JobStatus, to: JobStatus): JobStatus {
  if (!canTransition(from, to)) {
    throw new InvalidJobTransitionError(from, to);
  }

  return to;
}

export function allowedJobTransitions(from: JobStatus): readonly JobStatus[] {
  return allowedTransitions[from];
}
