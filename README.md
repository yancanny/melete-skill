# Melete Skill

English | [简体中文](README.zh-CN.md) | [Español](README.es.md)

Look back at how you and AI work together.

Melete is an Agent Skill for reflecting on your conversations with AI. Ask your agent for a debrief and it can offer observations grounded in evidence, possible interpretations, a question to consider, and—when you have stated a goal—small experiments for a later review. The AI's own conduct is part of the review. Melete does not assign a score or decide what good use means for you.

## What it can do

- Review a calendar year, the last 7, 30 or 90 days, the last 12 months, all available history, or a custom period. Coverage depends on the agent and what it can access.
- Show several observations with sources and at least two possible readings. Review the AI's responses as well as your own choices.
- Offer a question and, if you have described an intention, one or two small experiments to revisit later.
- Offer a private letter based on your own words. It may include AI guesses about feelings or health; such guesses can be wrong and are not a medical diagnosis. The letter is kept closed by default and is never included in a share.
- Create a locally saved share image or HTML when you request one.

## Install and use

Copy this repository's contents into the Skill directory of your tool, for example `~/.claude/skills/melete/` for Claude Code or `~/.codex/skills/melete/` for Codex. Other tools that support `SKILL.md` may use their own Skill directory; WorkBuddy compatibility has not yet been verified. Then ask, for example: “Review how I worked with AI this year.”

In a web chat without a Skill installer, upload `references/lens/export/lens-for-chat.md` and ask for a review using it. The review is limited to the conversations and memory the AI can actually access and should say so.

The review itself has no software dependencies. Creating a long image needs Node.js 22 or later and an installed Chrome, Edge or Chromium; otherwise HTML is available.

## Principles and privacy

Melete makes your use visible and leaves judgment to you. Observations should be traceable to conversations, with more than one reading where possible. It reviews the AI as well. The project runs no server and collects no data; how conversation material is processed depends on the AI tool and model you choose. Your private letter never enters shared output. You can ask to delete Melete-generated files, and Melete is not a tool for viewing other people's data.

The framework, the society view, the private letter, possible reference practices, sharing numbers, accounts, sync and future licensing remain open to revision. Existing released versions retain their licenses. The project welcomes critique and contributions; future redesigns may change existing behavior.

## Other Melete versions

- [Melete DSH](https://github.com/yancanny/dsh-plugin-melete): the DeepSeek Harness plugin.
- [Melete Magpie](https://github.com/yancanny/magpie-plugin-melete): review DSH or Codex through Magpie.

## Layout and license

`SKILL.md` is the entry point; `references/` holds the principles, lens and report guidance; `scripts/` contains optional local tools and `assets/share.html` the sharing template.

Code and assets: Apache-2.0. The Lens and written specification: CC BY 4.0. The Melete name is reserved by the author; attribution and limits on viewing other people's data are described in [NOTICE](NOTICE).
