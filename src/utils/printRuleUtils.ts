export type PrintAction = 'save_and_print' | 'save_only' | 'save_and_preview';
export type AmountOperator = '>' | '>=' | '<' | '<=';

export interface PrintRuleConfig {
  defaultAction: PrintAction;
  amountConditionEnabled?: boolean;
  amountOperator?: AmountOperator;
  amountThreshold?: number;
  amountAction?: PrintAction;
}

export interface ResolvedPrintRule {
  action: PrintAction;
  shouldPrint: boolean;
  shouldPreview: boolean;
  source: 'category' | 'global' | 'fallback';
  appliedRule?: PrintRuleConfig;
}

export const BILL_PRINT_RULE_GLOBAL_KEY = 'Bill.PrintRule.Global';
export const BILL_PRINT_RULE_CATEGORY_PREFIX = 'Bill.PrintRule.Category.';

export const DEFAULT_PRINT_RULE: PrintRuleConfig = {
  defaultAction: 'save_and_print',
  amountConditionEnabled: false,
  amountOperator: '>',
  amountThreshold: 1000,
  amountAction: 'save_and_print',
};

export function getCategoryPrintRuleKey(categoryCode: string): string {
  return `${BILL_PRINT_RULE_CATEGORY_PREFIX}${categoryCode}`;
}

const VALID_ACTIONS: PrintAction[] = ['save_and_print', 'save_only', 'save_and_preview'];

export function parsePrintRule(raw?: string | null): PrintRuleConfig | null {
  if (!raw || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!VALID_ACTIONS.includes(parsed.defaultAction)) {
      return null;
    }
    const validOps: AmountOperator[] = ['>', '>=', '<', '<='];
    const amountOperator: AmountOperator = validOps.includes(parsed.amountOperator)
      ? parsed.amountOperator
      : '>';
    const amountThreshold =
      typeof parsed.amountThreshold === 'number' && Number.isFinite(parsed.amountThreshold)
        ? parsed.amountThreshold
        : 0;
    const amountAction: PrintAction = VALID_ACTIONS.includes(parsed.amountAction)
      ? parsed.amountAction
      : 'save_and_print';

    return {
      defaultAction: parsed.defaultAction,
      amountConditionEnabled: Boolean(parsed.amountConditionEnabled),
      amountOperator,
      amountThreshold,
      amountAction,
    };
  } catch {
    return null;
  }
}

export function serializePrintRule(rule: PrintRuleConfig): string {
  return JSON.stringify({
    defaultAction: rule.defaultAction,
    amountConditionEnabled: Boolean(rule.amountConditionEnabled),
    amountOperator: rule.amountOperator || '>',
    amountThreshold: typeof rule.amountThreshold === 'number' && Number.isFinite(rule.amountThreshold)
      ? rule.amountThreshold
      : 0,
    amountAction: rule.amountAction || 'save_and_print',
  });
}

export function evaluatePrintRule(rule: PrintRuleConfig, amount: number): PrintAction {
  const safeAmount = Number.isFinite(amount) ? amount : 0;

  if (
    rule.amountConditionEnabled &&
    typeof rule.amountThreshold === 'number' &&
    Number.isFinite(rule.amountThreshold)
  ) {
    const threshold = rule.amountThreshold;
    const op = rule.amountOperator || '>';
    let matched = false;
    if (op === '>') matched = safeAmount > threshold;
    else if (op === '>=') matched = safeAmount >= threshold;
    else if (op === '<') matched = safeAmount < threshold;
    else if (op === '<=') matched = safeAmount <= threshold;

    if (matched) {
      return rule.amountAction || 'save_and_print';
    }
  }

  return rule.defaultAction;
}

/**
 * Resolves whether the default save action should print, preview, or save only based on:
 * 1. Customer category override rule (if customer has a category with a configured rule)
 * 2. Global print rule (if configured)
 * 3. Fallback to 'save_and_print' to preserve legacy behavior
 */
export function resolveDefaultPrintBehavior(
  settings: Record<string, string>,
  customerCategoryId?: string | null,
  amount: number = 0
): ResolvedPrintRule {
  if (customerCategoryId) {
    const categoryRule = parsePrintRule(settings[getCategoryPrintRuleKey(customerCategoryId)]);
    if (categoryRule) {
      const action = evaluatePrintRule(categoryRule, amount);
      return {
        action,
        shouldPrint: action === 'save_and_print',
        shouldPreview: action === 'save_and_preview',
        source: 'category',
        appliedRule: categoryRule,
      };
    }
  }

  const globalRule = parsePrintRule(settings[BILL_PRINT_RULE_GLOBAL_KEY]);
  if (globalRule) {
    const action = evaluatePrintRule(globalRule, amount);
    return {
      action,
      shouldPrint: action === 'save_and_print',
      shouldPreview: action === 'save_and_preview',
      source: 'global',
      appliedRule: globalRule,
    };
  }

  return {
    action: 'save_and_print',
    shouldPrint: true,
    shouldPreview: false,
    source: 'fallback',
  };
}

export function formatPrintActionLabel(action: PrintAction): string {
  if (action === 'save_and_print') return 'Save & Print';
  if (action === 'save_and_preview') return 'Save & Preview';
  return 'Save Only';
}

export function formatPrintRuleSummary(rule: PrintRuleConfig): string {
  const base = formatPrintActionLabel(rule.defaultAction);
  if (!rule.amountConditionEnabled || rule.amountThreshold === undefined) {
    return base;
  }
  const op = rule.amountOperator || '>';
  const threshold = Number(rule.amountThreshold).toLocaleString();
  const condAction = formatPrintActionLabel(rule.amountAction || 'save_and_print');
  return `${base} (${condAction} if Amount ${op} ${threshold})`;
}
