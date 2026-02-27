/* @ts-self-types="./wifi_planner_wasm.d.ts" */

import * as wasm from "./wifi_planner_wasm_bg.wasm";
import { __wbg_set_wasm } from "./wifi_planner_wasm_bg.js";
__wbg_set_wasm(wasm);
wasm.__wbindgen_start();
export {
    HeatmapResult, compute_heatmap, init_panic_hook, point_rssi
} from "./wifi_planner_wasm_bg.js";
