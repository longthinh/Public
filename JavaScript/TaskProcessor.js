export default class TaskProcessor {
  #fulfilledData; // Set of indexes for fulfilled tasks
  #pendingData; // Set of pending tasks (or rejected results from the last attempt)
  #failedIndexes; // Indexes of tasks that explicitly failed (due to cancellation/halt)
  #shouldStopAll; // Stop all tasks flag
  #stop; // Function to stop a single task

  /**
   * State initialization function.
   * @private
   */
  #initializeState() {
    this.#fulfilledData = new Map();
    this.#pendingData = new Map();
    this.#failedIndexes = new Set();
    this.#shouldStopAll = false;
  }

  /**
   * Halts all tasks. It is up to the user to decide whether to throw an error.
   * @param {string} [message]
   */
  halt() {
    this.#shouldStopAll = true;
  }

  /**
   * Aborts all tasks and throws an error.
   * @param {string} [message] - The error message.
   */
  abort(message = "Aborting all tasks") {
    this.#shouldStopAll = true;
    throw new Error(message);
  }

  /**
   * Cancels a single task and throws an error.
   * @param {string} [message]
   */
  cancel(message = "Task cancelled") {
    this.#stop();
    throw new Error(message);
  }

  /**
   * Creates a delayed Promise.
   * @param {number} seconds - The delay in seconds.
   * @returns {Promise<void>}
   */
  delay(seconds) {
    return seconds
      ? new Promise((resolve) => setTimeout(resolve, seconds * 1000))
      : Promise.resolve();
  }

  /**
   * Checks if a value is a Promise.
   * @param {any} value
   * @returns {boolean}
   */
  #isPromise(value) {
    return Boolean(value && typeof value.then === "function");
  }

  /**
   * Normalizes the task.
   * @param {Function|Promise|any} task
   * @returns {Function}
   */
  #normalizeTask(task) {
    if (this.#isPromise(task)) return task;
    if (typeof task === "function") return task;
    return () => task;
  }

  /**
   * Processes the array of Promises, classifying and collecting successful and failed results.
   * @param {Array<Promise>} promiseArray - Array of Promises
   * @returns {Promise<{fulfilled?: Array, rejected?: Array}>}
   */
  async #resolvePromises() {
    return {
      fulfilled: [...this.#fulfilledData.values()],
      rejected: [...this.#pendingData.values()],
    };
  }

  /**
   * Executes a group of tasks with a concurrency limit.
   * @param {Array} tasks - Array of tasks.
   * @param {number} concurrencyLimit - The concurrency limit.
   * @returns {Promise<boolean>} Whether all tasks have been fulfilled.
   */
  async #executeTasksWithLimit(tasks, concurrencyLimit) {
    const { promise, resolve } = Promise.withResolvers();
    const executing = new Set();

    for (let i = 0; i < tasks.length; i++) {
      this.#stop = () => this.#failedIndexes.add(i);

      // If the task is already fulfilled or explicitly failed, skip to the next one
      if (this.#fulfilledData.has(i) || this.#failedIndexes.has(i)) continue;

      const task = tasks[i];
      const p = this.#isPromise(task) ? task : Promise.resolve().then(task);

      const e = p
        .then((result) => {
          executing.delete(e);
          this.#pendingData.delete(i);
          this.#fulfilledData.set(i, result);
        })
        .catch((err) => this.#pendingData.set(i, err.message ?? err))
        .finally(() => {
          if (this.#shouldStopAll) {
            resolve(true);
          } else if (
            this.#fulfilledData.size + this.#pendingData.size >=
            tasks.length
          ) {
            resolve(
              this.#fulfilledData.size + this.#failedIndexes.size >=
                tasks.length
            );
          }
        });

      executing.add(e);
      executing.size >= concurrencyLimit &&
        (await Promise.race(executing).catch(() => {}));
      if (this.#shouldStopAll) break;
    }

    return promise;
  }

  /**
   * Main function to handle concurrent tasks.
   * @param {Array} tasks - Array of tasks.
   * @param {number} [concurrencyLimit=10] - The concurrency limit.
   * @param {number} [maxRetry=2] - Maximum number of retries.
   * @param {number} [waitTime=0] - Wait time between retries (seconds).
   * @returns {Promise<{resolve?: Array, reject?: Array}>}
   */
  async runTasks({
    tasks = [],
    concurrencyLimit = 10,
    maxRetry = 2,
    waitTime = 0,
  }) {
    if (!tasks.length) return {};
    this.#initializeState();
    tasks = tasks.map(this.#normalizeTask, this);

    while (maxRetry-- && !this.#shouldStopAll) {
      const isFulfilled = await this.#executeTasksWithLimit(
        tasks,
        concurrencyLimit
      );

      if (isFulfilled) break;
      maxRetry && (await this.delay(waitTime));
    }

    return this.#resolvePromises();
  }
}
