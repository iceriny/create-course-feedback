import dayjs from "dayjs";

/**
 * 模板替换参数接口
 */
export interface TemplateReplaceParams {
    // 课程名称
    courseName?: string;
    // 课程时间范围
    courseTime?: [dayjs.Dayjs, dayjs.Dayjs];
    // 课程内容
    courseContents?: string[];
    // 教学目标
    courseObjectives?: string[];
    // 签名
    signature?: string;
    // 学生课堂表现
    courseFeedback?: string;
    // 可选自定义日期（默认使用当前日期）
    customDate?: dayjs.Dayjs;
}

/**
 * 替换模板中的占位符
 *
 * @param template 原始模板字符串
 * @param params 替换参数
 * @returns 替换后的字符串
 */
export function replaceTemplate(
    template: string,
    params: TemplateReplaceParams
): string {
    let result = template;

    // 替换课程名称
    if (params.courseName) {
        result = result.replace(/{{courseName}}/g, `《${params.courseName}》`);
    }

    // 替换课程时间
    if (params.courseTime) {
        result = result.replace(
            /{{courseTime}}/g,
            `@${params.courseTime[0].format(
                "YYYY[年] MM[月]DD[日] HH:mm"
            )} -> ${params.courseTime[1].format("HH:mm")}`
        );
    }

    // 替换课程内容
    if (params.courseContents) {
        result = result.replace(
            /{{courseContents}}/g,
            params.courseContents.join("")
        );
    }

    // 替换教学目标
    if (params.courseObjectives) {
        result = result.replace(
            /{{courseObjectives}}/g,
            params.courseObjectives.join("")
        );
    }

    // 替换签名
    if (params.signature) {
        result = result.replace(/{{signature}}/g, params.signature);
    }

    // 替换当前日期
    const currentDate = params.customDate || dayjs();
    result = result.replace(
        /{{currentDate}}/g,
        currentDate.format("YYYY[年] MM[月]DD[日]")
    );

    // 替换学生课堂表现
    if (params.courseFeedback) {
        result = result.replace(/{{courseFeedback}}/g, params.courseFeedback);
    }

    return result;
}
