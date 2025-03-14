import API from "./API";
import type { ModelType } from "./API";

window["API"] = new API();

export default API.getInstance;
export { API };
export type { ModelType };
