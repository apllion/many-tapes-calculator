import * as v from 'valibot';

export const TapeEntrySchema = v.object({
  id: v.string(),
  op: v.picklist(['+', '-', '*', '/', '=', 'T', 'text']),
  value: v.number(),
  text: v.optional(v.string()),
  timestamp: v.number(),
});

export const TotalMemberSchema = v.object({
  accountId: v.string(),
  sign: v.picklist(['+', '-']),
});

export const TotalConfigSchema = v.object({
  startingValue: v.optional(v.number(), 0),
  members: v.optional(v.array(TotalMemberSchema), []),
});

export const TapeSchema = v.object({
  id: v.string(),
  name: v.string(),
  tape: v.array(TapeEntrySchema),
  createdAt: v.number(),
  color: v.optional(v.nullable(v.string())),
  totalConfig: v.optional(TotalConfigSchema),
});

export const ShortcutStoreSchema = v.object({
  value: v.optional(v.number()),
  op: v.optional(v.string()),
  text: v.optional(v.string()),
});

export const SettingsSchema = v.object({
  numberFormat: v.optional(v.picklist(['2dec', '0dec', 'eu2dec', 'eu0dec']), '2dec'),
  colorNegatives: v.optional(v.boolean(), false),
  palette: v.optional(v.array(v.string())),
  calculationMode: v.optional(v.picklist(['arithmetic', 'adding']), 'arithmetic'),
  textStores: v.optional(v.array(v.nullable(v.string())), []),
  shortcutStores: v.optional(v.array(v.nullable(ShortcutStoreSchema)), []),
});

export const AppStateSchema = v.object({
  version: v.optional(v.number(), 2),
  tapes: v.pipe(v.array(TapeSchema), v.minLength(1)),
  activeTapeId: v.string(),
  settings: v.optional(SettingsSchema),
  lastModified: v.optional(v.number()),
});
