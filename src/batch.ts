import util from 'util';
import db from './database';
import utils from './utils';

const DEFAULT_BATCH_SIZE : number = 100;

// The next line calls a function in a module that has not been updated to TS yet
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
const sleep = util.promisify(setTimeout);

export async function processSortedSet(setKey, process, options): Promise<void> {
    options = options || {};

    if (typeof process !== 'function') {
        throw new Error('[[error:process-not-a-function]]');
    }

    // Progress bar handling (upgrade scripts)
    if (options.progress) {

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        options.progress.total = await db.sortedSetCard(setKey);
    }

    options.batch = options.batch || DEFAULT_BATCH_SIZE;

    // use the fast path if possible

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    if (db.processSortedSet && typeof options.doneIf !== 'function' && !utils.isNumber(options.alwaysStartAt)) {
        return await db.processSortedSet(setKey, process, options);
    }

    // custom done condition
    options.doneIf = typeof options.doneIf === 'function' ? options.doneIf : function () {};

    let start = 0;
    let stop = options.batch - 1;

    if (process && process.constructor && process.constructor.name !== 'AsyncFunction') {
        process = util.promisify(process);
    }

    while (true) {
        /* eslint-disable no-await-in-loop */
        const ids = await db[`getSortedSetRange${options.withScores ? 'WithScores' : ''}`](setKey, start, stop);
        if (!ids.length || options.doneIf(start, stop, ids)) {
            return;
        }
        await process(ids);

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        start += utils.isNumber(options.alwaysStartAt) ? options.alwaysStartAt : options.batch;
        stop = start + options.batch - 1;

        if (options.interval) {
            await sleep(options.interval);
        }
    }
};

exports.processArray = async function (array, process, options) {
    options = options || {};

    if (!Array.isArray(array) || !array.length) {
        return;
    }
    if (typeof process !== 'function') {
        throw new Error('[[error:process-not-a-function]]');
    }

    const batch = options.batch || DEFAULT_BATCH_SIZE;
    let start = 0;
    if (process && process.constructor && process.constructor.name !== 'AsyncFunction') {
        process = util.promisify(process);
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
};

require('./promisify')(exports);
