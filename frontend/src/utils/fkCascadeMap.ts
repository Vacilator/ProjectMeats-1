/**
 * FK Cascade Map — defines parent→child dropdown filtering rules.
 *
 * When a parent field changes, child FK options are filtered so only
 * related records appear. E.g. selecting a Supplier filters Plants
 * to only that supplier's plants.
 */

export type FkOption = { id: string | number; name: string; [k: string]: unknown };
export type FkOptionsMap = Record<string, FkOption[]>;

interface CascadeRule {
  parentField: string;
  childField: string;
  /** Key on the child option that must equal the selected parent value */
  foreignKey: string;
}

/**
 * Registry keyed by normalised entity type (lowercase).
 * Each entity lists its cascade rules.
 */
const CASCADE_RULES: Record<string, CascadeRule[]> = {
  purchaseorder: [
    { parentField: 'supplier', childField: 'plant', foreignKey: 'supplier' },
    { parentField: 'supplier', childField: 'supplier_contact', foreignKey: 'supplier' },
  ],
  salesorder: [
    { parentField: 'customer', childField: 'customer_location', foreignKey: 'customer' },
    { parentField: 'customer', childField: 'customer_contact', foreignKey: 'customer' },
  ],
  invoice: [
    { parentField: 'customer', childField: 'customer_location', foreignKey: 'customer' },
    { parentField: 'customer', childField: 'customer_contact', foreignKey: 'customer' },
  ],
  carrierpo: [
    { parentField: 'carrier', childField: 'carrier_contact', foreignKey: 'carrier' },
  ],
  inquiry: [
    { parentField: 'customer', childField: 'customer_contact', foreignKey: 'customer' },
    { parentField: 'supplier', childField: 'plant', foreignKey: 'supplier' },
    { parentField: 'supplier', childField: 'supplier_contact', foreignKey: 'supplier' },
  ],
};

/**
 * Filters FK options for child fields based on the currently selected
 * parent value. Options without a matching foreignKey pass through.
 *
 * Unknown entity types or fields without rules return unmodified.
 */
export function applyCascadeFilter(
  entityType: string,
  fkOptions: FkOptionsMap,
  formValues: Record<string, unknown>,
): FkOptionsMap {
  const rules = CASCADE_RULES[entityType.toLowerCase()];
  if (!rules || rules.length === 0) return fkOptions;

  const result = { ...fkOptions };

  for (const rule of rules) {
    const parentValue = formValues[rule.parentField];
    const childOptions = fkOptions[rule.childField];

    if (!parentValue || !childOptions) continue;

    const parentId =
      typeof parentValue === 'object' && parentValue !== null
        ? (parentValue as Record<string, unknown>).id ?? parentValue
        : parentValue;

    result[rule.childField] = childOptions.filter((opt) => {
      const fkVal = opt[rule.foreignKey];
      if (fkVal === undefined) return true; // no FK info → keep visible
      const fkId =
        typeof fkVal === 'object' && fkVal !== null
          ? (fkVal as Record<string, unknown>).id ?? fkVal
          : fkVal;
      return String(fkId) === String(parentId);
    });
  }

  return result;
}
