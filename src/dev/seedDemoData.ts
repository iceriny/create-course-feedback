import dayjs from "dayjs";
import type { LessonDraft } from "../domain/lesson";
import { createStudentsFromNames, createStudentsInfo } from "../domain/student";
import {
  readStorageJson,
  readStorageString,
  writeStorageJson,
  writeStorageString,
} from "../services/persistence/localStorageRepository";
import { getRosterStorageKey } from "../services/persistence/rosterRepository";
import type { StudentContentPropsVersion } from "../types";

const demoClasses = [
  {
    name: "示例 · 图形化编程班",
    roster: "林安 周子禾 赵宁 欧阳小满 许思言 宋可 沈嘉亦 司马子言 顾然 方雨晴",
    version: "v1",
    hour: 10,
    courses: [
      [
        "迷宫闯关",
        "使用碰撞检测处理角色与墙面的接触",
        "能用条件积木判断撞墙并让角色退回",
      ],
      [
        "接水果游戏",
        "用变量记录得分并设置游戏结束条件",
        "能在接到水果时更新得分",
      ],
      [
        "角色接力动画",
        "使用广播协调不同角色的出场顺序",
        "能用广播消息触发另一角色的动作",
      ],
    ],
  },
  {
    name: "示例 · Python 编程班",
    roster:
      "叶秋 唐小果 徐舟 上官若晴 罗澄 苏明源 章琪 何雨乔 夏梓桐 诸葛明远 姚欢 郑宇泽",
    version: "v2",
    hour: 14,
    courses: [
      [
        "猜数字游戏",
        "用循环读取猜测并提示数字大小",
        "能根据猜测的结果决定是否结束循环",
      ],
      [
        "校园路线查询",
        "用字典查找地点及对应指引",
        "能在查询前判断字典是否包含指定键",
      ],
      ["班级阅读统计", "遍历列表并统计阅读记录", "能用循环累加数量并输出结果"],
    ],
  },
  {
    name: "示例 · 创意机器人班",
    roster:
      "余白 温亦辰 程望 钟语灿 袁筱 高宇飞 梁晓 东方云舒 蔡晨 陆嘉宁 潘新 皇甫星辰 秦雨 奚知微 杜衡 田溪月",
    version: "v2",
    hour: 16,
    courses: [
      [
        "循线小车",
        "读取光线传感器并调整左右电机转速",
        "能根据传感器读数修正行驶方向",
      ],
      [
        "自动停车小车",
        "用距离传感器检测障碍物",
        "能通过调试设定合适的停车距离",
      ],
      [
        "电机与传动",
        "组装小车底盘并比较不同电机转速",
        "能独立控制小车前进、后退和转向",
      ],
    ],
  },
] satisfies {
  name: string;
  roster: string;
  version: StudentContentPropsVersion;
  hour: number;
  courses: [string, string, string][];
}[];

const observations = [
  "能独立完成课堂练习，并主动讲解操作步骤。",
  "能在提示后完成任务，并复述关键步骤。",
  "愿意参与讨论，遇到问题时能主动提问。",
];

export function seedDemoData() {
  const seedKey = "__devDemoSeeded";
  if (readStorageString(seedKey)) return;

  const storedClasses = readStorageJson<unknown>("class-name", []);
  const classNames = new Set(Array.isArray(storedClasses) ? storedClasses : []);
  const today = dayjs().startOf("day");

  demoClasses.forEach(
    ({ name, roster, version, hour, courses }, classIndex) => {
      const students = createStudentsFromNames(roster.split(" "), version).map(
        (student, index) => ({ ...student, id: `demo-${classIndex}-${index}` }),
      );
      const rosterKey = getRosterStorageKey(name);
      if (readStorageString(rosterKey) === null)
        writeStorageJson(rosterKey, students);

      courses.forEach(([courseName, contents, objectives], courseIndex) => {
        const lessonId = `demo-${classIndex + 1}-lesson-${courseIndex + 1}`;
        const archived = courseIndex > 0;
        const key = archived
          ? `lessonArchive:${lessonId}`
          : `lessonDraft:${name}`;
        if (readStorageString(key) !== null) return;

        const start = today
          .subtract(classIndex + courseIndex * 7, "day")
          .hour(hour);
        const studentsInfo = createStudentsInfo(students);
        students.forEach((student, index) => {
          const info = studentsInfo[index];
          const stage = index % 5;
          info.activated = archived || stage !== 4;
          if (!info.activated || (!archived && stage === 0)) return;

          const observation =
            observations[(index + courseIndex) % observations.length];
          info.performance =
            version === "v1" ? { brief: observation } : { total: observation };
          if (archived || stage >= 2) {
            info.content = `${student.name}在“${courseName}”一课中，${observation}课后可以按课堂步骤再练习一次。`;
            info.confirmed = archived || stage === 3;
          }
        });

        const lesson: LessonDraft = {
          lessonId,
          activeClass: name,
          course: {
            name: courseName,
            start: start.toISOString(),
            end: start.add(90, "minute").toISOString(),
            contents,
            objectives,
          },
          studentsList: students,
          studentsInfo,
          defaultStudentVersion: version,
        };
        writeStorageJson(key, lesson);
      });

      classNames.add(name);
    },
  );

  writeStorageJson("class-name", [...classNames]);
  if (!readStorageString("lastActiveClass"))
    writeStorageString("lastActiveClass", demoClasses[0].name);
  writeStorageString(seedKey, "1");
}
