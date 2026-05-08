/**
 * Field Matching Engine
 *
 * Matches fields between nodes based on name similarity and type compatibility.
 * Enables Smart Auto-Map to suggest which upstream fields should map to target fields.
 *
 * Created: 2026-03-04 - Smart Auto-Map Phase 3
 */

import { OutputFieldSchema } from './outputSchemaInference';

/**
 * Match between source and target field
 */
export interface FieldMatch {
  sourceNodeId: string;
  sourceField: OutputFieldSchema;
  targetFieldName: string;
  matchScore: number; // 0-1 confidence
  matchReason: 'exact_name' | 'normalized_name' | 'fuzzy_name' | 'type_compatible';
}

/**
 * Type compatibility matrix
 */
const TYPE_COMPATIBILITY: Record<string, string[]> = {
  'text': ['textarea', 'email', 'url', 'phone'],
  'textarea': ['text'],
  'number': ['text'],
  'email': ['text'],
  'url': ['text'],
  'phone': ['text', 'number'],
  'date': ['datetime', 'text'],
  'datetime': ['date', 'text'],
  'select': ['text', 'multiSelect'],
  'multiSelect': ['select', 'text'],
  'checkbox': ['text'],
  'radio': ['text', 'select'],
};

/**
 * Check if two field types are compatible
 */
export function areTypesCompatible(sourceType: string, targetType: string): boolean {
  if (sourceType === targetType) {
    return true;
  }

  const compatibleTypes = TYPE_COMPATIBILITY[sourceType] || [];
  return compatibleTypes.includes(targetType);
}

/**
 * Normalize field name for comparison
 * Removes common prefixes/suffixes and converts to lowercase
 */
export function normalizeFieldName(fieldName: string): string {
  const original = fieldName
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();
  let normalized = original;

  const normalizeToName =
    (original.startsWith('customer_') || original.startsWith('user_')) && original.endsWith('_name');

  // Remove common suffixes first
  const suffixes = ['_id', '_name', '_number', '_code', '_value'];
  for (const suffix of suffixes) {
    if (normalized.endsWith(suffix)) {
      normalized = normalized.substring(0, normalized.length - suffix.length);
    }
  }

  // Remove common prefixes
  const prefixes = ['customer_', 'product_', 'order_', 'user_', 'item_'];
  for (const prefix of prefixes) {
    if (normalized.startsWith(prefix)) {
      normalized = normalized.substring(prefix.length);
    }
  }

  if (normalizeToName) {
    return 'name';
  }

  return normalized;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= str1.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str2.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= str1.length; i++) {
    for (let j = 1; j <= str2.length; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[str1.length][str2.length];
}

/**
 * Calculate similarity score between two field names
 */
export function calculateNameSimilarity(sourceName: string, targetName: string): number {
  const source = sourceName.toLowerCase();
  const target = targetName.toLowerCase();

  // Exact match
  if (source === target) {
    return 1.0;
  }

  // Normalized match (remove prefixes/suffixes)
  const normalizedSource = normalizeFieldName(source);
  const normalizedTarget = normalizeFieldName(target);

  if (normalizedSource === normalizedTarget) {
    return 0.9;
  }

  // Substring match (token-boundary only)
  // Treat as a strong match only when the match occurs on a boundary (e.g. email_address -> email),
  // not when it's an internal substring (e.g. email -> mail).
  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const isTokenMatch = (haystack: string, needle: string) => {
    const re = new RegExp(`(^|[_-])${escapeRegExp(needle)}($|[_-])`);
    return re.test(haystack);
  };

  if (isTokenMatch(source, target) || isTokenMatch(target, source)) {
    return 0.7;
  }

  // Levenshtein distance (fuzzy match)
  const maxLength = Math.max(source.length, target.length);
  const distance = levenshteinDistance(source, target);
  const similarity = 1 - (distance / maxLength);

  // Only consider good fuzzy matches
  if (similarity >= 0.6) {
    return similarity * 0.6; // Scale down fuzzy matches
  }

  return 0.0;
}

/**
 * Find field matches between source fields and target field names
 */
export function findFieldMatches(
  sourceNodeId: string,
  sourceFields: OutputFieldSchema[],
  targetFieldNames: string[],
  targetFieldTypes?: Record<string, string> // Optional: field name -> type
): FieldMatch[] {
  const matches: FieldMatch[] = [];

  for (const targetFieldName of targetFieldNames) {
    let bestMatch: FieldMatch | null = null;

    for (const sourceField of sourceFields) {
      // Calculate name similarity
      const nameSimilarity = calculateNameSimilarity(sourceField.fieldName, targetFieldName);

      if (nameSimilarity === 0) {
        continue; // No similarity, skip
      }

      // Check type compatibility if target type is known
      let matchReason: FieldMatch['matchReason'] = 'exact_name';

      if (targetFieldTypes && targetFieldTypes[targetFieldName]) {
        const targetType = targetFieldTypes[targetFieldName];
        const typeCompatible = areTypesCompatible(sourceField.fieldType, targetType);

        if (!typeCompatible) {
          continue; // Skip incompatible types
        }

        matchReason = 'type_compatible';
      }

      // Determine match reason
      if (nameSimilarity === 1.0) {
        matchReason = 'exact_name';
      } else if (nameSimilarity >= 0.9) {
        matchReason = 'normalized_name';
      } else {
        matchReason = 'fuzzy_name';
      }

      const match: FieldMatch = {
        sourceNodeId,
        sourceField,
        targetFieldName,
        matchScore: nameSimilarity,
        matchReason,
      };

      // Keep best match for this target field
      if (!bestMatch || match.matchScore > bestMatch.matchScore) {
        bestMatch = match;
      }
    }

    // Add best match if score is above threshold
    if (bestMatch && bestMatch.matchScore >= 0.6) {
      matches.push(bestMatch);
    }
  }

  return matches;
}

/**
 * Group matches by target field (deduplicate)
 */
export function deduplicateMatches(matches: FieldMatch[]): FieldMatch[] {
  const bestMatches = new Map<string, FieldMatch>();

  matches.forEach(match => {
    const existing = bestMatches.get(match.targetFieldName);

    if (!existing || match.matchScore > existing.matchScore) {
      bestMatches.set(match.targetFieldName, match);
    }
  });

  return Array.from(bestMatches.values());
}

/**
 * Sort matches by score (highest first)
 */
export function sortMatchesByScore(matches: FieldMatch[]): FieldMatch[] {
  return [...matches].sort((a, b) => b.matchScore - a.matchScore);
}
