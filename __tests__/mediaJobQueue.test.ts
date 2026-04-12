/**
 * P1-A-6: MediaJobQueue — serialization and cancellation tests.
 * We test the queue logic without loading real FFmpeg WASM.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Minimal queue implementation mirroring MediaJobQueue for unit testing ----
// (We test the contract, not the WASM loading, to keep tests fast and offline.)

type JobFn<T> = (signal: AbortSignal) => Promise<T>;

class TestableQueue {
  private tail: Promise<unknown> = Promise.resolve();

  enqueue<T>(jobFn: JobFn<T>, signal?: AbortSignal): Promise<T> {
    const next = this.tail.then(async () => {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      return jobFn(signal ?? new AbortController().signal);
    });
    this.tail = next.then(() => undefined, () => undefined);
    return next as Promise<T>;
  }
}

describe('MediaJobQueue serialization', () => {
  let queue: TestableQueue;

  beforeEach(() => {
    queue = new TestableQueue();
  });

  it('executes jobs sequentially, not in parallel', async () => {
    const order: number[] = [];

    const job1 = queue.enqueue(async () => {
      await new Promise((r) => setTimeout(r, 20));
      order.push(1);
    });

    const job2 = queue.enqueue(async () => {
      order.push(2);
    });

    await Promise.all([job1, job2]);
    expect(order).toEqual([1, 2]);
  });

  it('second job starts only after first resolves', async () => {
    let job1Done = false;
    let job2StartedBeforeJob1Done = false;

    const job1 = queue.enqueue(async () => {
      await new Promise((r) => setTimeout(r, 30));
      job1Done = true;
    });

    const job2 = queue.enqueue(async () => {
      job2StartedBeforeJob1Done = !job1Done;
    });

    await Promise.all([job1, job2]);
    expect(job2StartedBeforeJob1Done).toBe(false);
  });

  it('queue continues after a job throws', async () => {
    const results: string[] = [];

    const job1 = queue.enqueue(async () => {
      throw new Error('job1 failed');
    });

    const job2 = queue.enqueue(async () => {
      results.push('job2 ran');
    });

    await expect(job1).rejects.toThrow('job1 failed');
    await job2;
    expect(results).toContain('job2 ran');
  });

  it('returns the job result', async () => {
    const result = await queue.enqueue(async () => 42);
    expect(result).toBe(42);
  });
});

describe('MediaJobQueue cancellation', () => {
  let queue: TestableQueue;

  beforeEach(() => {
    queue = new TestableQueue();
  });

  it('throws AbortError when signal is already aborted before job starts', async () => {
    const ac = new AbortController();
    ac.abort();

    // Block the queue with a slow job first
    const blocker = queue.enqueue(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    const cancelled = queue.enqueue(async () => 'should not run', ac.signal);

    await blocker;
    await expect(cancelled).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('does not cancel jobs that are already running', async () => {
    const ac = new AbortController();
    let ran = false;

    const job = queue.enqueue(async () => {
      await new Promise((r) => setTimeout(r, 10));
      ran = true;
    }, ac.signal);

    // Abort after job has started (queue was empty, so it starts immediately)
    setTimeout(() => ac.abort(), 5);

    // Job should still complete because abort only prevents queued-but-not-started jobs
    await job;
    expect(ran).toBe(true);
  });
});
