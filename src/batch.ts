import util from 'util';
import db from './database';
import utils from './utils';

const DEFAULT_BATCH_SIZE = 100;


const sleep = util.promisify(setTimeout);

type Customfunc = (start? : number, stop? : number, ids? : number[]) => boolean
// type Customfunc = Function

interface Progress {
    total : number;
}

interface Options {
    progress: Progress;
    batch: number;
    doneIf: Customfunc;
    alwaysStartAt: number;
    withScores: boolean;
    interval: number;
}

const defaultOpt : Options = {
    progress: null,
    batch: null,
    doneIf: null,
    alwaysStartAt: null,
    withScores: null,
    interval: null,
};

export async function processSortedSet(
    setKey : string, process : ((ar : number[], next? : () => void) => unknown) | undefined, options : Options
): Promise<unknown> {
    options = options || defaultOpt;

    if (typeof process !== 'function') {
        throw new Error('[[error:process-not-a-function]]');
    }

    // Progress bar handling (upgrade scripts)
    if (options.progress) {
        // The next line calls a function in a module that has not been updated to TS yet,
        // and the variable's type cannot be inferred
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        options.progress.total = await db.sortedSetCard(setKey) as number;
    }

    options.batch = options.batch || DEFAULT_BATCH_SIZE;

    // use the fast path if possible

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    if (db.processSortedSet && typeof options.doneIf !== 'function' && !utils.isNumber(options.alwaysStartAt)) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const retval = await db.processSortedSet(setKey, process, options) as unknown;
        return retval;
    }

    // custom done condition
    options.doneIf = typeof options.doneIf === 'function' ? options.doneIf : function () { return undefined; } as Customfunc;

    let start = 0;
    let stop = options.batch - 1;

    if (process && process.constructor && process.constructor.name !== 'AsyncFunction') {
        process = util.promisify(process);
    }

    while (true) {
        /* eslint-disable no-await-in-loop */
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const ids = await db[`getSortedSetRange${options.withScores ? 'WithScores' : ''}`](setKey, start, stop) as number[];
        const l : number = ids.length;
        if (!l || options.doneIf(start, stop, ids)) {
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
}

export async function processArray(
    array : number[],
    process : ((ar : number[], next? : () => void) => unknown) | undefined,
    options : Options
) {
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
        process = util.promisify(process);
    }

    while (true) {
        const currentBatch : number[] = array.slice(start, start + batch);

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
