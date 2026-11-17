// Vorbelegte Kategorien: [Name, Typ, Farbe, ist Sparen]
export const DEFAULT_CATEGORIES: Array<[string, 'income' | 'expense', string, number]> = [
  ['Wohnen', 'expense', '#2a78d6', 0],
  ['Lebensmittel', 'expense', '#1baf7a', 0],
  ['Mobilität', 'expense', '#eb6834', 0],
  ['Versicherungen', 'expense', '#6250d6', 0],
  ['Abos', 'expense', '#e87ba4', 0],
  ['Freizeit', 'expense', '#eda100', 0],
  ['Restaurants', 'expense', '#e34948', 0],
  ['Gesundheit', 'expense', '#008300', 0],
  ['Sparen', 'expense', '#9aa83c', 1],
  ['Sonstiges', 'expense', '#8b8a85', 0],
  ['Gehalt', 'income', '#2a78d6', 0],
  ['Nebeneinkünfte', 'income', '#1baf7a', 0],
  ['Sonstiges', 'income', '#8b8a85', 0],
];
