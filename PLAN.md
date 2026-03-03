# Plan

- [x] Move tape row up and down
- [x] Move number under text in shortcuts
- [x] Find a better place for shortcuts in portrait mode
- [x] Should C work on tape lines? (need alternative way to clear whole tape)
  - C + tap entry = delete entry (done)
  - Clear whole tape moved to MODE > TAPE > Clear Tape (done)
- [x] Rows without numbers in calculation
  - `value: null` treated as 0 via `entry.value ?? 0` in calculate.js:56
  - Doesn't crash but corrupts multiplication chains: `5 × [empty] × 3` = 0 instead of skipping
  - Options: skip null-value entries (like text entries), or prevent empty entries from existing
