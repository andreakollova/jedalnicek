export function shoppingPrompt(dayLabel: string, daysCount: string): string {
  return `${dayLabel} - co chces jest ${daysCount}?

Napis recepty alebo produkty, napr.:
- chicken curry 4 porcie
- losos so zemiakmi
- banany, vajcia, mineralka`;
}

export function planConfirmation(summary: string): string {
  return `Nakupny zoznam:\n\n${summary}\n\nAk chces nieco zmenit, napisy mi. Ked bude Kosik pripojeny, pripravim ti kosik.`;
}

export function correctionApplied(summary: string): string {
  return `Aktualizovany zoznam:\n\n${summary}`;
}

export function clarificationNeeded(question: string): string {
  return `Nerozumela som uplne.\n\n${question}`;
}

export function shoppingRunSummary(params: {
  meals: string[];
  itemCount: number;
  estimatedTotal: number | null;
  substitutions: string[];
  skipped: string[];
  cartUrl: string;
}): string {
  let text = `Kosik je pripraveny\n\n`;

  if (params.meals.length > 0) {
    text += `Jedla:\n${params.meals.map(m => `  ${m}`).join('\n')}\n\n`;
  }

  text += `${params.itemCount} poloziek\n`;
  if (params.estimatedTotal !== null) {
    text += `Priblizne ${params.estimatedTotal.toFixed(2)} EUR\n`;
  }

  if (params.substitutions.length > 0) {
    text += `\nNahrady:\n${params.substitutions.map(s => `  ${s}`).join('\n')}\n`;
  }

  if (params.skipped.length > 0) {
    text += `\nNenasla som:\n${params.skipped.map(s => `  ${s}`).join('\n')}\n`;
  }

  text += `\nOtvorit Kosik: ${params.cartUrl}`;

  return text;
}

export function authExpiredMessage(): string {
  return `Kosik potrebuje nove prihlasenie. Nakup som preto nepripravila.`;
}

export function errorMessage(job: string, error: string): string {
  return `Nastala chyba pri ${job}:\n${error}`;
}
