import * as v from 'valibot';

export const TapeEntrySchema = v.object({
  id: v.string(),
  op: v.picklist(['+', '-', '*', '/', '=', 'T', 'text']),
  value: v.number(),
  text: v.optional(v.string()),
  timestamp: v.number(),
});

export const AccountSchema = v.object({
  id: v.string(),
  name: v.string(),
  tape: v.array(TapeEntrySchema),
  createdAt: v.number(),
  color: v.optional(v.nullable(v.string())),
});

export const SummaryMemberSchema = v.object({
  accountId: v.string(),
  sign: v.picklist(['+', '-']),
});

export const SummarySchema = v.object({
  id: v.string(),
  name: v.string(),
  startingValue: v.optional(v.number(), 0),
  members: v.optional(v.array(SummaryMemberSchema), []),
  color: v.optional(v.nullable(v.string())),
});

export const SettingsSchema = v.object({
  numberFormat: v.optional(v.picklist(['2dec', '0dec', 'eu2dec', 'eu0dec']), '2dec'),
  colorSubtractions: v.optional(v.boolean(), false),
  palette: v.optional(v.array(v.string())),
});

export const AppStateSchema = v.object({
  accounts: v.pipe(v.array(AccountSchema), v.minLength(1)),
  activeAccountId: v.string(),
  settings: v.optional(SettingsSchema),
  summaries: v.optional(v.array(SummarySchema), []),
  activeSummaryId: v.optional(v.nullable(v.string()), null),
});
