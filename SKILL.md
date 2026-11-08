---
name: melete
description: Melete 复盘：回看用户和 AI 一起做事的方式，生成"你的 Melete"复盘，并可导出排版好的分享长图与 HTML。触发场景：(1) 用户说"复盘""回顾""年度复盘""Melete"，且指的是回顾自己使用 AI 的情况；(2) 用户想看自己这段时间怎么用 AI、和 AI 怎么分工；(3) 用户想把复盘做成长图或 HTML 分享。不用于：项目复盘、会议复盘、工作总结、比赛或投资复盘等与"使用 AI"无关的回顾（说不清时见 references/triggers.md）。English: review how the user works with AI; share as a long image or HTML.
---

# Melete · 复盘你和 AI 的协作

Melete 帮用户看见自己和 AI 是怎么一起做事的：几面镜子，而不是一张成绩单。好坏由用户自己定义。

本文件只管**流程和决策**。怎么看、怎么写，以 `references/` 为准；分享的版式一律用 `assets/share.html`，**不要凭记忆手写**。

## 必守的四条（细则见 references/principles.md）

1. **照见，好坏由用户定**：不评分、不贴标签、不排名、不和他人比较；禁用词见 `references/report-template.md`。
2. **每句话都有出处**：每面镜子至少两处出处；看不清就说"未明"。
3. **本地与隐私**：只读用户同意的记录；邮箱、电话、密钥、路径、他人姓名一律略去；不把记录发到任何外部服务（用户自己正在用的这个 AI 除外，并在开头说明）。
4. **写给你自己的信不外传**：域四"自己"单独写成一封信，默认收着；永远不进分享。信里可以有 AI 对用户情绪与健康的猜测，每一处都写明"AI 的判断并不准确，请以医生的诊断为准"。

## 自己判断，只为授权的事提问

能自己定的事，自己定，交付时说明理由。**只在下面这些情况问用户**：

- 读取对话记录的来源（第一次列出找到的来源，问一次"都纳入吗"）；
- 安装依赖、下载任何东西；
- 把文件写到当前工作目录之外；
- 回看范围（推荐一个，问一次；用户说"直接""不用问"就不问）；
- 长图做好后，要不要再给一份 HTML。

不要逐项追问。需要问的，一次问全。

## 工作流

### 0. 先确认这是 Melete 的事

用户说"复盘"时，先看上下文：

- 明显是回顾自己使用 AI 的情况 → 开始。
- 和上下文冲突、或说不清（例如正在做项目时说"复盘一下"）→ **先按用户原来的意思做**，做完补问一句："要不要再用 Melete 复盘一下你使用 AI 的情况？"
- 确实不是一回事 → 不调用 Melete。

正例、反例见 `references/triggers.md`。

### 1. 判断环境，选路径

| 路径 | 环境 | 做法 |
|---|---|---|
| A 完整回顾 | 能执行命令、读本地文件（Claude Code、Codex、WorkBuddy、DSH 等） | 读本机对话记录；能用 `scripts/` 就用 |
| B 上传文件 | 对话里有代码沙箱，用户上传了导出文件 | 分析上传的文件 |
| C 自省回顾 | 纯对话 | 只用平台记忆和当前对话；开头写明"这次只能看到 AI 记得的部分，覆盖范围有限" |

路径 A 里已知的记录位置（会随版本变化，读之前先看一眼结构）：

| 来源 | 位置 |
|---|---|
| DSH | `~/.dsh/sessions/`（可用 `scripts/dsh-digest.ts`） |
| Claude Code | `~/.claude/projects/*/*.jsonl` |
| Codex | `~/.codex/sessions/**/*.jsonl` |
| WorkBuddy | `~/.workbuddy/sessions/` |

只取**用户亲手写的话**和 AI 的回复；系统提示、Skill 目录、插件注入的内容不算用户的话。

### 2. 定回看范围

按 `references/range.md`：默认推荐**年度**（3 月 1 日起推荐当年，1–2 月推荐上一年）；也可选 7 天、30 天、90 天、近 1 年、全部、自定义时间段。

### 3. 回看

读 `references/lens/` 下的 `values.md`、`network.md`、`procedure.md`，按"回顾的做法"写。各域文件用到时再读。纯对话环境读不了多个文件时，用 `references/lens/export/lens-for-chat.md`（合订本）。

范围长（90 天以上）时：先统计（按月、按任务类型分组），再挑代表性的对话细看，不要试图逐段读完。

### 4. 交付复盘

- 在对话里给出完整复盘（骨架见 `procedure.md` 第五节）。
- 能写文件时，存一份 Markdown 到当前工作目录的 `melete/` 下，文件名 `melete-{起}-{止}.md`。
- 写给你自己的信只放信封；用户说"打开"才写出来，不存盘。
- 交出前跑一遍 `procedure.md` 第九节的自查，并对照 `references/gotchas.md`。
- 结尾可以平静地提一句"想要分享版时说一声"，**只提一次，不催**。

### 5. 分享（用户要时）

按 `references/share-spec.md`：

1. 从复盘里摘出分享内容，写成 `share.json`（字段和上限见 share-spec）。
2. 生成长图：

   ```bash
   node <SKILL_ROOT>/scripts/render-share.mjs share.json --out melete --png
   ```

   脚本先用 `scripts/check-share.mjs` 检查，有 ERROR 就停下，改完再来。
3. 没有可用浏览器时，脚本会说明；这时用你自己的浏览器或截图工具把 HTML 截成长图；都没有，就交 HTML，请用户自己截长图。
4. 长图交付后问一句："要不要再给你一份 HTML？" 要就运行同一条命令加 `--html`。

不能执行命令的环境：照 `assets/share.html` 里的注释手工填空，再逐条对照 `references/share-spec.md` 末尾的检查清单。

## 文件

| 文件 | 作用 |
|---|---|
| `references/principles.md` | 必守原则的操作细则 |
| `references/lens/` | 照见图谱：怎么看（CC BY 4.0） |
| `references/report-template.md` | 禁用词、慎用词与替代说法 |
| `references/range.md` | 回看范围与默认推荐 |
| `references/triggers.md` | 该不该触发：正例、反例、说不清时 |
| `references/share-spec.md` | 分享放什么、不放什么、数量上限 |
| `references/gotchas.md` | 真实踩过的坑 |
| `assets/share.html` | 分享长图与 HTML 的唯一模板 |
| `scripts/render-share.mjs` | 填模板、检查、出长图（需要 Node 22 以上和本机 Chrome / Edge） |
| `scripts/check-share.mjs` | 分享内容的确定性检查 |
| `scripts/dsh-digest.ts` | 读 DSH 会话日志，生成摘要 |
