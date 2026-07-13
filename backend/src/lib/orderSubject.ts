export interface SubjectItem {
  name: string;
}

/** "TShirt", "TShirt + 2 more" — short enough to sit inside a subject line. */
export function summarizeItems(items: SubjectItem[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0].name;
  return `${items[0].name} + ${items.length - 1} more`;
}

/** Professional subject line with enough context to identify the order
 * without opening it: "Order confirmed: TShirt + 2 more (LL-ABC123)". */
export function orderSubject(verb: string, orderNumber: string, items: SubjectItem[]): string {
  const summary = summarizeItems(items);
  return summary ? `${verb}: ${summary} (${orderNumber})` : `${verb} (${orderNumber})`;
}
