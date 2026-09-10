# ЗборЧе wordlists

`w4.json`–`w7.json` are the valid Macedonian words of each length (uppercase
Cyrillic), used by `/api/zborche/validate` to reject non-word guesses.

- **Source:** [whoeverest/macedonian-words](https://github.com/whoeverest/macedonian-words)
  (`MK-dict.txt`), itself derived from a Mozilla Macedonian word database.
- **Processing:** trimmed, uppercased, de-duplicated, and filtered to 4–7 letters
  (the range of ЗборЧе puzzle lengths).

These are read at runtime by `app/api/zborche/validate/route.ts`; the folder is
force-included in that route's serverless bundle via `outputFileTracingIncludes`
in `next.config.ts`. To regenerate or extend the length range, re-run the same
filter over `MK-dict.txt`.
