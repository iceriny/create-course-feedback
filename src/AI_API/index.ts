import API from "./API";

window["API"] = new API();

export default API.getInstance;
export { API };
