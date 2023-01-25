"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processArray = exports.processSortedSet = void 0;
const util_1 = __importDefault(require("util"));
const database_1 = __importDefault(require("./database"));
const utils_1 = __importDefault(require("./utils"));
const DEFAULT_BATCH_SIZE = 100;
const sleep = util_1.default.promisify(setTimeout);
const defaultOpt = {
    progress: null,
    batch: null,
    doneIf: null,
    alwaysStartAt: null,
    withScores: null,
    interval: null,
};
async function processSortedSet(setKey, process, options) {
    options = options || defaultOpt;
    if (typeof process !== 'function') {
        throw new Error('[[error:process-not-a-function]]');
    }
    // Progress bar handling (upgrade scripts)
    if (options.progress) {
        // The next line calls a function in a module that has not been updated to TS yet,
        // and the variable's type cannot be inferred
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        options.progress.total = await database_1.default.sortedSetCard(setKey);
    }
    options.batch = options.batch || DEFAULT_BATCH_SIZE;
    // use the fast path if possible
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    if (database_1.default.processSortedSet && typeof options.doneIf !== 'function' && !utils_1.default.isNumber(options.alwaysStartAt)) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const retval = await database_1.default.processSortedSet(setKey, process, options);
        return retval;
    }
    // custom done condition
    options.doneIf = typeof options.doneIf === 'function' ? options.doneIf : function () { return undefined; };
    let start = 0;
    let stop = options.batch - 1;
    if (process && process.constructor && process.constructor.name !== 'AsyncFunction') {
        process = util_1.default.promisify(process);
    }
    while (true) {
        /* eslint-disable no-await-in-loop */
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const ids = await database_1.default[`getSortedSetRange${options.withScores ? 'WithScores' : ''}`](setKey, start, stop);
        const l = ids.length;
        if (!l || options.doneIf(start, stop, ids)) {
            return;
        }
        await process(ids);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        start += utils_1.default.isNumber(options.alwaysStartAt) ? options.alwaysStartAt : options.batch;
        stop = start + options.batch - 1;
        if (options.interval) {
            await sleep(options.interval);
        }
    }
}
exports.processSortedSet = processSortedSet;
async function processArray(array, process, options) {
    options = options || defaultOpt;
    if (!Array.isArray(array) || !array.length) {
        return;
    }
    if (typeof process !== 'function') {
        throw new Error('[[error:process-not-a-function]]');
    }
    const batch = options.batch || DEFAULT_BATCH_SIZE;
    let start = 0;
    if (process && process.constructor && process.constructor.name !== 'AsyncFunction') {
        process = util_1.default.promisify(process);
    }
    while (true) {
        const currentBatch = array.slice(start, start + batch);
        if (!currentBatch.length) {
            return;
        }
        await process(currentBatch);
        start += batch;
        if (options.interval) {
            await sleep(options.interval);
        }
    }
}
exports.processArray = processArray;
