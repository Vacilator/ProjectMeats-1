/**
 * Auto-Populate Suggestion Engine
 *
 * Analyzes upstream nodes and suggests field auto-population.
 * Scoring algorithm based on name similarity, type matching, and context.
 *
 * Created: 2026-02-21
 * Phase: 5 - Smart Features
 */

import { Variable } from '../components/VariablePicker';
import { FormField, AutoPopulateSuggestion } from '../../form-builder/types';

/**
 * Calculate string similarity using Levenshtein distance
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  // Exact match
  if (s1 === s2) return 100;

  // Contains match
  if (s1.includes(s2) || s2.includes(s1)) return 80;

  // Levenshtein distance
  const matrix: number[][] = [];

  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  const distance = matrix[s1.length][s2.length];
  const maxLength = Math.max(s1.length, s2.length);
  const similarity = ((maxLength - distance) / maxLength) * 100;

  return Math.round(similarity);
}

/**
 * Check if types are compatible
 */
function areTypesCompatible(sourceType: string, targetType: string): boolean {
  // Exact match
  if (sourceType === targetType) return true;

  // Compatible type groups
  const typeGroups = [
    ['text', 'textarea', 'email', 'phone'],
    ['number', 'rating', 'slider'],
    ['date', 'datetime'],
    ['select', 'radio'],
    ['multiSelect', 'checkbox']
  ];

  for (const group of typeGroups) {
    if (group.includes(sourceType) && group.includes(targetType)) {
      return true;
    }
  }

  return false;
}

/**
 * Extract meaningful keywords from field name
 */
function extractKeywords(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2);
}

/**
 * Calculate context score based on field semantics
 */
function calculateContextScore(sourceField: Variable, targetField: FormField): number {
  const sourceKeywords = extractKeywords(sourceField.displayName);
  const targetKeywords = extractKeywords(targetField.label);

  // Check for common keywords
  const commonKeywords = sourceKeywords.filter(kw =>
    targetKeywords.some(tkw => tkw.includes(kw) || kw.includes(tkw))
  );

  if (commonKeywords.length === 0) return 0;

  // More common keywords = higher score
  const keywordRatio = commonKeywords.length / Math.max(sourceKeywords.length, targetKeywords.length);
  return Math.round(keywordRatio * 100);
}

/**
 * Generate auto-populate suggestions for a field
 */
export function generateAutoPopulateSuggestions(
  targetField: FormField,
  availableVariables: Variable[],
  maxSuggestions: number = 3
): AutoPopulateSuggestion[] {
  const suggestions: AutoPopulateSuggestion[] = [];

  for (const variable of availableVariables) {
    // Calculate name similarity
    const nameSimilarity = calculateSimilarity(variable.displayName, targetField.label);

    // Check type compatibility
    const typeCompatible = areTypesCompatible(variable.type, targetField.type);
    const typeScore = typeCompatible ? 100 : 0;

    // Calculate context score
    const contextScore = calculateContextScore(variable, targetField);

    // Combined score (weighted average)
    const score = Math.round(
      (nameSimilarity * 0.5) + // 50% weight on name similarity
      (typeScore * 0.3) +      // 30% weight on type compatibility
      (contextScore * 0.2)     // 20% weight on context
    );

    // Only suggest if score is meaningful
    if (score >= 40) {
      // Determine confidence level
      let confidence: 'high' | 'medium' | 'low' = 'low';
      if (score >= 80) confidence = 'high';
      else if (score >= 60) confidence = 'medium';

      // Build reason string
      const reasons: string[] = [];
      if (nameSimilarity >= 80) reasons.push('Similar name');
      else if (nameSimilarity >= 60) reasons.push('Related name');

      if (typeCompatible) reasons.push('Compatible type');
      if (contextScore >= 50) reasons.push('Matching context');

      const reason = reasons.length > 0 ? reasons.join(', ') : 'Possible match';

      suggestions.push({
        sourceStep: variable.nodeId,
        sourceField: variable.path,
        targetField: targetField.id,
        score,
        reason,
        confidence
      });
    }
  }

  // Sort by score (descending) and return top N
  return suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSuggestions);
}

/**
 * Auto-Map algorithm for field mappings
 * Finds best matches between source and target fields
 */
export function autoMapFields(
  sourceVariables: Variable[],
  targetFields: FormField[],
  threshold: number = 60
): Array<{
  sourceVariable: Variable;
  targetField: FormField;
  score: number;
  confidence: 'high' | 'medium' | 'low';
}> {
  const mappings: Array<{
    sourceVariable: Variable;
    targetField: FormField;
    score: number;
    confidence: 'high' | 'medium' | 'low';
  }> = [];

  const usedSources = new Set<string>();
  const usedTargets = new Set<string>();

  // For each target field, find best source match
  for (const targetField of targetFields) {
    let bestMatch: {
      variable: Variable;
      score: number;
    } | null = null;

    for (const variable of sourceVariables) {
      if (usedSources.has(variable.id)) continue;

      const nameSimilarity = calculateSimilarity(variable.displayName, targetField.label);
      const typeCompatible = areTypesCompatible(variable.type, targetField.type);
      const typeScore = typeCompatible ? 100 : 0;
      const contextScore = calculateContextScore(variable, targetField);

      const score = Math.round(
        (nameSimilarity * 0.5) +
        (typeScore * 0.3) +
        (contextScore * 0.2)
      );

      if (score >= threshold && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { variable, score };
      }
    }

    if (bestMatch) {
      let confidence: 'high' | 'medium' | 'low' = 'low';
      if (bestMatch.score >= 80) confidence = 'high';
      else if (bestMatch.score >= 70) confidence = 'medium';

      mappings.push({
        sourceVariable: bestMatch.variable,
        targetField,
        score: bestMatch.score,
        confidence
      });

      usedSources.add(bestMatch.variable.id);
      usedTargets.add(targetField.id);
    }
  }

  return mappings.sort((a, b) => b.score - a.score);
}

/**
 * Get variable suggestions for expression input
 * Returns variables sorted by relevance to current context
 */
export function getExpressionSuggestions(
  currentExpression: string,
  availableVariables: Variable[],
  contextHint?: string
): Variable[] {
  // If no expression, return all variables
  if (!currentExpression && !contextHint) {
    return availableVariables;
  }

  // Score each variable based on relevance
  const scored = availableVariables.map(variable => {
    let score = 0;

    // Match against current expression
    if (currentExpression) {
      const similarity = calculateSimilarity(variable.displayName, currentExpression);
      score += similarity;
    }

    // Match against context hint
    if (contextHint) {
      const contextSimilarity = calculateSimilarity(variable.displayName, contextHint);
      score += contextSimilarity * 0.5;
    }

    return { variable, score };
  });

  // Return top matches
  return scored
    .filter(item => item.score > 30)
    .sort((a, b) => b.score - a.score)
    .map(item => item.variable);
}
