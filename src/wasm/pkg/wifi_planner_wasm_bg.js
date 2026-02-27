/**
 * Result object returned by `compute_heatmap`.
 *
 * JS fields:
 *   .pixels()           → Uint8Array (RGBA, rows × cols × 4)
 *   .cols               → u32
 *   .rows               → u32
 *   .excellent_count    → u32
 *   .good_count         → u32
 *   .fair_count         → u32
 *   .poor_count         → u32
 *   .no_coverage_count  → u32
 *   .total_count        → u32
 *   .avg_rssi()         → f64
 */
export class HeatmapResult {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(HeatmapResult.prototype);
        obj.__wbg_ptr = ptr;
        HeatmapResultFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        HeatmapResultFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_heatmapresult_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get cols() {
        const ret = wasm.__wbg_get_heatmapresult_cols(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get excellent_count() {
        const ret = wasm.__wbg_get_heatmapresult_excellent_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get fair_count() {
        const ret = wasm.__wbg_get_heatmapresult_fair_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get good_count() {
        const ret = wasm.__wbg_get_heatmapresult_good_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get no_coverage_count() {
        const ret = wasm.__wbg_get_heatmapresult_no_coverage_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get poor_count() {
        const ret = wasm.__wbg_get_heatmapresult_poor_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get rows() {
        const ret = wasm.__wbg_get_heatmapresult_rows(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get total_count() {
        const ret = wasm.__wbg_get_heatmapresult_total_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Average RSSI across cells that have any signal (−90 dBm floor).
     * @returns {number}
     */
    avg_rssi() {
        const ret = wasm.heatmapresult_avg_rssi(this.__wbg_ptr);
        return ret;
    }
    /**
     * RGBA pixel data for the heatmap (rows × cols × 4 bytes).
     * @returns {Uint8Array}
     */
    pixels() {
        const ret = wasm.heatmapresult_pixels(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * @param {number} arg0
     */
    set cols(arg0) {
        wasm.__wbg_set_heatmapresult_cols(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set excellent_count(arg0) {
        wasm.__wbg_set_heatmapresult_excellent_count(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set fair_count(arg0) {
        wasm.__wbg_set_heatmapresult_fair_count(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set good_count(arg0) {
        wasm.__wbg_set_heatmapresult_good_count(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set no_coverage_count(arg0) {
        wasm.__wbg_set_heatmapresult_no_coverage_count(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set poor_count(arg0) {
        wasm.__wbg_set_heatmapresult_poor_count(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set rows(arg0) {
        wasm.__wbg_set_heatmapresult_rows(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set total_count(arg0) {
        wasm.__wbg_set_heatmapresult_total_count(this.__wbg_ptr, arg0);
    }
}
if (Symbol.dispose) HeatmapResult.prototype[Symbol.dispose] = HeatmapResult.prototype.free;

/**
 * Compute the WiFi signal heatmap.
 *
 * Parameters
 * ----------
 * width, height   – canvas dimensions in pixels
 * resolution      – heatmap cell size in pixels (e.g. 8 → one pixel per 8×8 block)
 * ap_data         – flat f64 array, AP_STRIDE values per AP:
 *                   [x, y, tx_power_dbm, gain_dbi, freq_ghz, enabled(0/1)]
 * wall_data       – flat f64 array, WALL_STRIDE values per wall:
 *                   [x1, y1, x2, y2, attenuation_db]
 * pixels_per_meter – spatial scale
 *
 * Returns
 * -------
 * HeatmapResult containing RGBA pixels + coverage statistics.
 * @param {number} width
 * @param {number} height
 * @param {number} resolution
 * @param {Float64Array} ap_data
 * @param {Float64Array} wall_data
 * @param {number} pixels_per_meter
 * @returns {HeatmapResult}
 */
export function compute_heatmap(width, height, resolution, ap_data, wall_data, pixels_per_meter) {
    const ptr0 = passArrayF64ToWasm0(ap_data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF64ToWasm0(wall_data, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.compute_heatmap(width, height, resolution, ptr0, len0, ptr1, len1, pixels_per_meter);
    return HeatmapResult.__wrap(ret);
}

export function init_panic_hook() {
    wasm.init_panic_hook();
}

/**
 * Calculate the best RSSI at a single point across all enabled APs.
 *
 * Parameters match the same layout as `compute_heatmap`.
 * Returns −Infinity (as f64::NEG_INFINITY) if no enabled APs.
 * @param {number} target_x
 * @param {number} target_y
 * @param {Float64Array} ap_data
 * @param {Float64Array} wall_data
 * @param {number} pixels_per_meter
 * @returns {number}
 */
export function point_rssi(target_x, target_y, ap_data, wall_data, pixels_per_meter) {
    const ptr0 = passArrayF64ToWasm0(ap_data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF64ToWasm0(wall_data, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.point_rssi(target_x, target_y, ptr0, len0, ptr1, len1, pixels_per_meter);
    return ret;
}
export function __wbg___wbindgen_throw_39bc967c0e5a9b58(arg0, arg1) {
    throw new Error(getStringFromWasm0(arg0, arg1));
}
export function __wbg_error_a6fa202b58aa1cd3(arg0, arg1) {
    let deferred0_0;
    let deferred0_1;
    try {
        deferred0_0 = arg0;
        deferred0_1 = arg1;
        console.error(getStringFromWasm0(arg0, arg1));
    } finally {
        wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
    }
}
export function __wbg_new_227d7c05414eb861() {
    const ret = new Error();
    return ret;
}
export function __wbg_stack_3b0d974bbf31e44f(arg0, arg1) {
    const ret = arg1.stack;
    const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
}
export function __wbindgen_init_externref_table() {
    const table = wasm.__wbindgen_externrefs;
    const offset = table.grow(4);
    table.set(0, undefined);
    table.set(offset + 0, undefined);
    table.set(offset + 1, null);
    table.set(offset + 2, true);
    table.set(offset + 3, false);
}
const HeatmapResultFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_heatmapresult_free(ptr >>> 0, 1));

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

let cachedFloat64ArrayMemory0 = null;
function getFloat64ArrayMemory0() {
    if (cachedFloat64ArrayMemory0 === null || cachedFloat64ArrayMemory0.byteLength === 0) {
        cachedFloat64ArrayMemory0 = new Float64Array(wasm.memory.buffer);
    }
    return cachedFloat64ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function passArrayF64ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 8, 8) >>> 0;
    getFloat64ArrayMemory0().set(arg, ptr / 8);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;


let wasm;
export function __wbg_set_wasm(val) {
    wasm = val;
}
