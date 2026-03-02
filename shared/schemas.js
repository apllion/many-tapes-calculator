import * as v from 'valibot';

export const TapeEntrySchema = v.object({
  id: v.string(),
  op: v.picklist(['+', '-', '*', '/', '=', 'T', 'text']),
  value: v.number(),
  text: v.optional(v.string()),
  timestamp: v.number(),
});

export const TapeSchema = v.object({
  id: v.string(),
  name: v.string(),
  tape: v.array(TapeEntrySchema),
  createdAt: v.number(),
  color: v.optional(v.nullable(v.string())),
});

export const TotalMemberSchema = v.object({
  accountId: v.string(),
  sign: v.picklist(['+', '-']),
});

export const TotalSchema = v.object({
  id: v.string(),
  name: v.string(),
  startingValue: v.optional(v.number(), 0),
  members: v.optional(v.array(TotalMemberSchema), []),
  color: v.optional(v.nullable(v.string())),
});

export const SettingsSchema = v.object({
  numberFormat: v.optional(v.picklist(['2dec', '0dec', 'eu2dec', 'eu0dec']), '2dec'),
  colorNegatives: v.optional(v.boolean(), false),
  palette: v.optional(v.array(v.string())),
  calculationMode: v.optional(v.picklist(['arithmetic', 'adding']), 'arithmetic'),
  textStores: v.optional(v.array(v.nullable(v.string())), []),
});

export const AppStateSchema = v.object({
  tapes: v.pipe(v.array(TapeSchema), v.minLength(1)),
  activeTapeId: v.string(),
  settings: v.optional(SettingsSchema),
  totals: v.optional(v.array(TotalSchema), []),
  activeTotalId: v.optional(v.nullable(v.string()), null),
});
