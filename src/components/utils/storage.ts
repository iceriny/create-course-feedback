import { PROMPTS } from "../constants";
import { PromptItem } from "../types";

/**
 * 从本地存储中获取提示词
 * @returns 提示词对象
 */
export function getPromptFromLocalStorage(): Record<string, PromptItem> {
    const prompts = localStorage.getItem("prompts");
    if (prompts) {
        return JSON.parse(prompts);
    }
    return {};
}

/**
 * 保存提示词到本地存储
 * @param prompts 提示词对象
 */
export function savePromptToLocalStorage(prompts: Record<string, PromptItem>) {
    const _t: Record<string, PromptItem> = {};
    for (const [key, item] of Object.entries(prompts)) {
        if (key in PROMPTS) {
            continue;
        }
        _t[key] = item;
    }
    localStorage.setItem("prompts", JSON.stringify(prompts));
}

/**
 * 在LocalStorage中的数组增量添加数据
 * @param key 存储键名
 * @param values 要添加的值
 * @returns 更新后的数组
 */
export function addToLocalStorageArray(key: string, ...values: string[]) {
    // 从本地存储中获取数组
    const array: string[] = JSON.parse(localStorage.getItem(key) ?? "[]");
    // 如果数组中已经存在该值，则不添加
    for (const value of values) {
        if (array.includes(value)) continue;
        // 向数组中添加新值
        array.push(value);
    }
    // 将数组保存到本地存储
    localStorage.setItem(key, JSON.stringify(array));
    return array;
}

/**
 * 获取LocalStorage中的数组数据
 * @param key 存储键名
 * @returns 数组数据
 */
export function getLocalStorage<T>(key: string) {
    const array = JSON.parse(localStorage.getItem(key) ?? "[]") as T[];
    return array;
}
