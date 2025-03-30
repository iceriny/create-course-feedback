import API from "./API";
import type { ModelType, ProviderType, ProviderConfig } from "./API";

window["API"] = new API();

export default API.getInstance;
export { API };
export type { ModelType, ProviderType, ProviderConfig };
