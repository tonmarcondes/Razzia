# Comparison with Kahoot: 2026-11-12

This describes the implemented fork, not planned features. Kahoot capabilities vary by account and subscription; links below are the official references checked on this date. No complete file-format or scoring equivalence is claimed.

| Area                | This fork                                                                                                                                           | Kahoot reference                                                                                                |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Hosting and control | MIT source, self-hosted runtime, instance-controlled data and branding. Infrastructure and maintenance still have costs.                            | Commercial hosted service with plan-dependent features and participant limits.                                  |
| Live teaching       | PIN/QR entry, browser players, scores, streaks, ranking, reconnection, teacher-controlled advancement and stop.                                     | Live games, with plan-dependent participant limits and additional modes.                                        |
| Teacher accounts    | Local administrators/teachers, revocable sessions, private quizzes, authenticated public library and per-host reports.                              | Workspaces, libraries and collaboration vary by plan.                                                           |
| Branding            | Runtime name, favicon, logo, colors and stage backgrounds; administrator management.                                                                | Themes and branding capabilities vary by plan.                                                                  |
| Question formats    | Single choice, multiple choice, numeric estimation and survey mode; up to four alternatives. Media and presenter explanation notes.                 | A broader question catalog, including typed answers, puzzles, word clouds and slides; availability varies.      |
| Reuse               | Share complete quizzes inside the authenticated instance. No searchable standalone question bank yet.                                               | Question bank searches public questions and the user's library, subject to plan restrictions.                   |
| Independent study   | No learner-paced assignments with deadlines or attempts.                                                                                            | Learner-paced assignments and self-study modes.                                                                 |
| Courses/classes     | Concurrent rooms are isolated. No persistent class roster, course sequence or learner progress history across classes.                              | Courses and assignment tracking, subject to account/plan.                                                       |
| Reports             | Per-game question/player results, preserved applied content and host isolation. No consolidated cross-class analytics or XLSX result-export UI.     | Spreadsheet reports and additional reporting/consolidation options, depending on plan.                          |
| Exchange            | Native JSON plus official and adapted Portuguese question XLSX. No real Kahoot game-report import.                                                  | Spreadsheet question import is limited to standard quiz questions. A game-report download is a separate format. |
| Capacity            | Measure against the deployed infrastructure and actual workload; no hardcoded per-license player cap was introduced. See the dated capacity report. | Participant limits depend on subscription and mode.                                                             |

## Official references

- [Question types](https://support.kahoot.com/hc/en-us/articles/115002308428-Kahoot-question-types)
- [Question bank](https://support.kahoot.com/hc/en-us/articles/16130620877971-How-to-use-Kahoot-question-bank)
- [Team workspaces](https://support.kahoot.com/hc/en-us/articles/360053998413-How-to-use-workspaces)
- [Themes](https://support.kahoot.com/hc/en-us/articles/4433531677715-How-to-use-themes)
- [Assignments](https://support.kahoot.com/hc/en-us/articles/360039411334-How-to-assign-a-kahoot-in-web-platform)
- [Courses](https://support.kahoot.com/hc/en-us/articles/14281102654867-Kahoot-courses-How-to-assign-host-and-study)
- [Spreadsheet reports](https://support.kahoot.com/hc/en-us/articles/360035547493-How-to-download-and-use-spreadsheet-reports)
- [Question spreadsheet import](https://support.kahoot.com/hc/en-us/articles/115002812547-How-to-import-questions-from-a-spreadsheet-to-your-kahoot)
- [Participant limits](https://support.kahoot.com/hc/en-us/articles/115003072287-How-many-participants-can-play-a-kahoot)

## Product priorities

1. Searchable reusable questions by topic, retaining question provenance and permissions.
2. Persistent courses/classes and consolidated learning reports.
3. Learner-paced assignments with deadlines, attempt policy and student identity.
4. Broader question formats when a concrete teaching need justifies them.

Keep each feature in a separate branch and review its authorization/data model before implementation. Real anonymized game-report files and a signed-in Kahoot import test are still needed to extend and validate interoperability.
