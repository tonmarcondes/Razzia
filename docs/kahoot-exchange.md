# Kahoot spreadsheet exchange

In **Settings → Quizzes**, use **Import Kahoot XLSX** or the **XLSX** button next to a quiz. Review the compatibility report and confirm before creating a new quiz or downloading a spreadsheet. Cancel leaves the quiz unchanged. Existing JSON import/export remains available.

## Supported interchange

The adapter uses the question template documented in [Kahoot's official import guide](https://support.kahoot.com/hc/en-us/articles/115002812547-How-to-import-questions-from-a-spreadsheet-to-your-kahoot), checked on 2026-10-31. Export places the header in row 8 and data from row 9, with question, four answer columns, time and correct answer numbers in columns B–H. Correct answer numbers are converted between Kahoot's one-based and Razzia's zero-based indices.

- Standard choice questions only, 2–4 alternatives, 120 characters per question and 75 per answer.
- Times: 5, 10, 20, 30, 60 or 120 seconds, following the current guide. Other values are blocked rather than rounded.
- Maximum 100 questions per exchange. Import accepts up to ten worksheets with exactly one recognized question sheet (supporting sheets are ignored with a review warning), maximum 1 MiB compressed, 256 ZIP entries and 16 MiB declared expanded contents, 1,000 rows and 20 columns.
- Question and answer text, order, correct answer indices and supported time values are retained. Formulas, links, rich text cells and embedded cell values are rejected, never evaluated.
- Import uses the filename as the title, a five-second reading delay and default points. Multiple correct answers become a multi question with strict selection; the review explains these defaults.
- Unsupported types, surveys, excessive lengths, invalid alternatives, unsupported times and invalid solution indices block conversion. No questions are silently dropped.
- Media, notes and categories cannot be transported through this template. Export requires confirmation of their omission and warns about scoring and multi-answer behavior differences. Scoring equivalence is not claimed.

The XLSX parser loads only on demand in the browser. The authenticated existing quiz API performs final validation and persistence; there is no additional server or persistence format. Imported spreadsheets create new quizzes rather than choosing an existing quiz ID.

## Validation and limits

Unit tests cover round trips, Portuguese text, official cell coordinates, multiple solutions, unsupported data and malformed imports. Browser tests cover download, review-before-save, import and blocked export. The unmodified official template was also downloaded and read successfully as a separate local check.

Acceptance by the actual Kahoot importer still requires a signed-in Kahoot account and an import test. Until then this is an adapter targeting the documented template, not a claim of 100% product interoperability.

Kahoot game-report XLSX files are a different format and are rejected. Importing those reports needs anonymized real examples before implementation. Complete quizzes with media, other question types, original scoring and historical results are outside this exchange. Keep native JSON and the separate media files for backup.

## Portuguese question workbooks

Import also recognizes an adapted Portuguese layout, distinct from the official Kahoot template. Its contiguous headers are `Número`, `Tema`, `Pergunta Kahoot`, `Alternativa A`, `Alternativa B`, `Alternativa C`, `Alternativa D`, `Resposta correta`, `Justificativa / foco de estudo` in columns A–I. Correct answers may be letters A–D (comma-separated for multiple answers) or one-based numbers. Topic and explanation become the native category and note; no content is executed. Missing time defaults explicitly to 30 seconds in the review.

Native import preserves longer question/answer text and warns when it cannot be exported to the official template. Official import/export limits are unchanged; text is never truncated to pass them. Supporting topic sheets are not imported as questions. Ambiguous workbooks with more than one recognized question sheet are rejected. This format does not add support for Kahoot game reports or establish product-wide export compatibility.
