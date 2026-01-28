"""
Field Mapping Service

Provides fuzzy matching and auto-mapping functionality for form field mappings.
Used to automatically suggest and configure field mappings between steps.
"""

import re
from difflib import SequenceMatcher
from typing import Dict, List, Any, Optional, Tuple
from django.db.models import Q

from .field_registry import FieldRegistry, FIELD_TYPE_MAP


# Field types that are compatible for mapping
COMPATIBLE_TYPES = {
    # Text types
    'text': {'text', 'textarea', 'email', 'url'},
    'textarea': {'text', 'textarea'},
    'email': {'text', 'email'},
    'url': {'text', 'url'},
    # Number types
    'number': {'number', 'decimal'},
    'decimal': {'number', 'decimal'},
    # Boolean
    'checkbox': {'checkbox'},
    # Date/time types
    'date': {'date', 'datetime'},
    'datetime': {'date', 'datetime'},
    'time': {'time'},
    # Selection types
    'select': {'select'},
    'multiselect': {'multiselect', 'select'},
    # File types
    'file': {'file', 'image'},
    'image': {'file', 'image'},
    # Others
    'json': {'json'},
}


def normalize_field_name(name: str) -> str:
    """
    Normalize a field name for comparison.
    
    Examples:
        'customer_name' -> 'customer name'
        'CustomerName' -> 'customer name'
        'first_name' -> 'first name'
    """
    # Convert camelCase to snake_case
    name = re.sub(r'([a-z])([A-Z])', r'\1_\2', name)
    # Replace underscores and hyphens with spaces
    name = re.sub(r'[_\-]', ' ', name)
    # Lowercase
    name = name.lower().strip()
    return name


def get_name_tokens(name: str) -> set:
    """Extract meaningful tokens from a field name."""
    normalized = normalize_field_name(name)
    tokens = set(normalized.split())
    # Remove common prefixes/suffixes
    stopwords = {'id', 'fk', 'key', 'ref', 'num', 'number', 'code'}
    return tokens - stopwords


def calculate_name_similarity(name1: str, name2: str) -> float:
    """
    Calculate similarity score between two field names.
    Uses both fuzzy matching and token overlap.
    
    Returns a score between 0.0 and 1.0
    """
    # Normalize names
    norm1 = normalize_field_name(name1)
    norm2 = normalize_field_name(name2)
    
    # Exact match
    if norm1 == norm2:
        return 1.0
    
    # Fuzzy string matching
    fuzzy_score = SequenceMatcher(None, norm1, norm2).ratio()
    
    # Token overlap
    tokens1 = get_name_tokens(name1)
    tokens2 = get_name_tokens(name2)
    
    if tokens1 and tokens2:
        overlap = len(tokens1 & tokens2)
        union = len(tokens1 | tokens2)
        token_score = overlap / union if union > 0 else 0
    else:
        token_score = 0
    
    # Weighted combination
    return (fuzzy_score * 0.6) + (token_score * 0.4)


def are_types_compatible(type1: str, type2: str) -> bool:
    """Check if two field types are compatible for mapping."""
    if type1 == type2:
        return True
    
    compatible_set = COMPATIBLE_TYPES.get(type1, {type1})
    return type2 in compatible_set


def calculate_options_similarity(options1: List[str], options2: List[str]) -> float:
    """
    Calculate similarity between two sets of options (for select fields).
    
    Returns a score between 0.0 and 1.0
    """
    if not options1 or not options2:
        return 0.0
    
    # Normalize options
    set1 = {opt.lower().strip() for opt in options1}
    set2 = {opt.lower().strip() for opt in options2}
    
    # Calculate Jaccard similarity
    intersection = len(set1 & set2)
    union = len(set1 | set2)
    
    return intersection / union if union > 0 else 0.0


def calculate_mapping_score(
    target_field: Dict[str, Any],
    source_field: Dict[str, Any],
    step_distance: int
) -> Tuple[float, List[str]]:
    """
    Calculate a mapping score between a target field and a potential source field.
    
    Args:
        target_field: The field that needs to be populated
        source_field: The potential source field
        step_distance: Number of steps between target and source (higher = further)
    
    Returns:
        Tuple of (score, reasons) where score is 0-100 and reasons explain the score
    """
    score = 0.0
    reasons = []
    
    # Name similarity (max 50 points)
    name_sim = calculate_name_similarity(
        target_field.get('key', ''),
        source_field.get('key', '')
    )
    name_points = name_sim * 50
    score += name_points
    
    if name_sim >= 0.9:
        reasons.append('Exact name match')
    elif name_sim >= 0.7:
        reasons.append('Similar name')
    elif name_sim >= 0.5:
        reasons.append('Partial name match')
    
    # Type compatibility (max 30 points)
    target_type = target_field.get('type', 'text')
    source_type = source_field.get('type', 'text')
    
    if target_type == source_type:
        score += 30
        reasons.append('Same type')
    elif are_types_compatible(target_type, source_type):
        score += 15
        reasons.append('Compatible types')
    
    # Options similarity for select fields (max 10 points)
    if target_type in ('select', 'multiselect') and source_type in ('select', 'multiselect'):
        target_options = target_field.get('options', [])
        source_options = source_field.get('options', [])
        
        if target_options and source_options:
            options_sim = calculate_options_similarity(target_options, source_options)
            options_points = options_sim * 10
            score += options_points
            
            if options_sim >= 0.8:
                reasons.append('Matching options')
            elif options_sim >= 0.5:
                reasons.append('Similar options')
    
    # Step proximity bonus (max 10 points)
    # Closer steps (lower distance) get more points
    proximity_points = max(0, 10 - (step_distance * 2))
    score += proximity_points
    
    if step_distance == 1:
        reasons.append('Previous step')
    elif step_distance <= 2:
        reasons.append('Recent step')
    
    return round(score, 1), reasons


def find_best_mapping(
    target_field: Dict[str, Any],
    source_fields: List[Dict[str, Any]],
    min_score: float = 50.0
) -> Optional[Dict[str, Any]]:
    """
    Find the best mapping source for a target field.
    
    Args:
        target_field: The field that needs a mapping
        source_fields: List of potential source fields with their step info
        min_score: Minimum score threshold for a valid mapping
    
    Returns:
        Best matching source field with score and reasons, or None
    """
    best_match = None
    best_score = min_score - 1  # Must beat min_score
    
    for source in source_fields:
        step_distance = source.get('step_distance', 1)
        score, reasons = calculate_mapping_score(target_field, source, step_distance)
        
        if score > best_score:
            best_score = score
            best_match = {
                **source,
                'score': score,
                'reasons': reasons
            }
        elif score == best_score and best_match:
            # Tie-breaker: prefer more recent step (lower distance)
            if source.get('step_distance', 999) < best_match.get('step_distance', 999):
                best_match = {
                    **source,
                    'score': score,
                    'reasons': reasons
                }
    
    return best_match if best_match and best_match['score'] >= min_score else None


class FieldMappingService:
    """
    Service for managing field mappings in tenant forms.
    """
    
    @staticmethod
    def get_source_fields_for_step(form, target_step_order: int) -> List[Dict[str, Any]]:
        """
        Get all available source fields from steps before the target step.
        
        Args:
            form: TenantForm instance
            target_step_order: Order of the target step
        
        Returns:
            List of source fields with step info
        """
        from ..models import TenantFormEntity, TenantFormField
        
        source_fields = []
        
        # Get all steps before the target step
        prior_steps = form.entities.filter(
            order__lt=target_step_order
        ).order_by('-order')  # Most recent first
        
        for step in prior_steps:
            step_distance = target_step_order - step.order
            
            # Get fields configured for this step
            step_fields = TenantFormField.objects.filter(
                form_entity=step,
                is_visible=True
            ).select_related('form_entity')
            
            # Get field metadata from registry
            entity_fields = FieldRegistry.get_fields(step.entity_type) or []
            field_map = {f['key']: f for f in entity_fields}
            
            for field in step_fields:
                field_meta = field_map.get(field.field_key, {})
                source_fields.append({
                    'step_id': str(step.id),
                    'step_name': step.step_name or step.entity_type.replace('_', ' ').title(),
                    'step_order': step.order,
                    'step_distance': step_distance,
                    'field_id': str(field.id),
                    'key': field.field_key,
                    'label': field.custom_label or field_meta.get('label', field.field_key),
                    'type': field_meta.get('type', 'text'),
                    'options': field_meta.get('options', []),
                })
        
        return source_fields
    
    @staticmethod
    def compute_auto_mappings(form, min_score: float = 50.0) -> List[Dict[str, Any]]:
        """
        Compute automatic field mappings for all unmapped fields in a form.
        
        Args:
            form: TenantForm instance
            min_score: Minimum score threshold for auto-mapping
        
        Returns:
            List of suggested mappings
        """
        from ..models import TenantFormEntity, TenantFormField
        
        mappings = []
        
        # Get all steps ordered
        steps = form.entities.order_by('order')
        
        for step in steps:
            if step.order == 0:
                # First step has no prior steps to map from
                continue
            
            # Get source fields from prior steps
            source_fields = FieldMappingService.get_source_fields_for_step(form, step.order)
            
            if not source_fields:
                continue
            
            # Get fields for this step that don't have auto-populate configured
            step_fields = TenantFormField.objects.filter(
                form_entity=step,
                is_visible=True
            ).filter(
                Q(auto_populate_source_step__isnull=True) |
                Q(auto_populate_source_field='')
            )
            
            # Get field metadata
            entity_fields = FieldRegistry.get_fields(step.entity_type) or []
            field_map = {f['key']: f for f in entity_fields}
            
            for field in step_fields:
                field_meta = field_map.get(field.field_key, {})
                target_field = {
                    'id': str(field.id),
                    'key': field.field_key,
                    'label': field.custom_label or field_meta.get('label', field.field_key),
                    'type': field_meta.get('type', 'text'),
                    'options': field_meta.get('options', []),
                }
                
                # Find best mapping
                best_match = find_best_mapping(target_field, source_fields, min_score)
                
                if best_match:
                    mappings.append({
                        'target_step_id': str(step.id),
                        'target_step_name': step.step_name or step.entity_type.replace('_', ' ').title(),
                        'target_field_id': str(field.id),
                        'target_field_key': field.field_key,
                        'target_field_label': target_field['label'],
                        'source_step_id': best_match['step_id'],
                        'source_step_name': best_match['step_name'],
                        'source_field_key': best_match['key'],
                        'source_field_label': best_match['label'],
                        'score': best_match['score'],
                        'reasons': best_match['reasons'],
                        'mode': 'copy',  # Default to copy mode
                    })
        
        return mappings
    
    @staticmethod
    def get_current_mappings(form) -> List[Dict[str, Any]]:
        """
        Get all current field mappings for a form.
        
        Args:
            form: TenantForm instance
        
        Returns:
            List of current mappings
        """
        from ..models import TenantFormField
        
        mappings = []
        
        # Get all fields with auto-populate configured
        fields = TenantFormField.objects.filter(
            form_entity__form=form,
            auto_populate_source_step__isnull=False
        ).exclude(
            auto_populate_source_field=''
        ).select_related('form_entity', 'auto_populate_source_step')
        
        # Get field metadata for labels
        for field in fields:
            target_step = field.form_entity
            source_step = field.auto_populate_source_step
            
            target_entity_fields = FieldRegistry.get_fields(target_step.entity_type) or []
            target_field_map = {f['key']: f for f in target_entity_fields}
            target_field_meta = target_field_map.get(field.field_key, {})
            
            source_entity_fields = FieldRegistry.get_fields(source_step.entity_type) or []
            source_field_map = {f['key']: f for f in source_entity_fields}
            source_field_meta = source_field_map.get(field.auto_populate_source_field, {})
            
            mappings.append({
                'target_step_id': str(target_step.id),
                'target_step_name': target_step.step_name or target_step.entity_type.replace('_', ' ').title(),
                'target_step_order': target_step.order,
                'target_field_id': str(field.id),
                'target_field_key': field.field_key,
                'target_field_label': field.custom_label or target_field_meta.get('label', field.field_key),
                'source_step_id': str(source_step.id),
                'source_step_name': source_step.step_name or source_step.entity_type.replace('_', ' ').title(),
                'source_step_order': source_step.order,
                'source_field_key': field.auto_populate_source_field,
                'source_field_label': source_field_meta.get('label', field.auto_populate_source_field),
                'mode': field.auto_populate_mode or 'copy',
            })
        
        # Sort by target step order, then field key
        mappings.sort(key=lambda m: (m['target_step_order'], m['target_field_key']))
        
        return mappings
    
    @staticmethod
    def apply_mapping(field, source_step_id: str, source_field_key: str, mode: str = 'copy') -> bool:
        """
        Apply a mapping to a field.
        
        Args:
            field: TenantFormField instance
            source_step_id: UUID of the source step
            source_field_key: Key of the source field
            mode: Auto-populate mode ('copy' or 'lookup')
        
        Returns:
            True if successful
        """
        from ..models import TenantFormEntity
        
        try:
            source_step = TenantFormEntity.objects.get(id=source_step_id)
            field.auto_populate_source_step = source_step
            field.auto_populate_source_field = source_field_key
            field.auto_populate_mode = mode
            field.save(update_fields=[
                'auto_populate_source_step',
                'auto_populate_source_field',
                'auto_populate_mode'
            ])
            return True
        except TenantFormEntity.DoesNotExist:
            return False
    
    @staticmethod
    def remove_mapping(field) -> bool:
        """
        Remove a mapping from a field.
        
        Args:
            field: TenantFormField instance
        
        Returns:
            True if successful
        """
        field.auto_populate_source_step = None
        field.auto_populate_source_field = ''
        field.auto_populate_mode = ''
        field.save(update_fields=[
            'auto_populate_source_step',
            'auto_populate_source_field',
            'auto_populate_mode'
        ])
        return True
    
    @staticmethod
    def apply_auto_mappings(form, mappings: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Apply a list of auto-mappings to a form.
        
        Args:
            form: TenantForm instance
            mappings: List of mappings from compute_auto_mappings()
        
        Returns:
            Dict with 'applied' count and 'errors' list
        """
        from ..models import TenantFormField
        
        applied = 0
        errors = []
        
        for mapping in mappings:
            try:
                field = TenantFormField.objects.get(id=mapping['target_field_id'])
                success = FieldMappingService.apply_mapping(
                    field,
                    mapping['source_step_id'],
                    mapping['source_field_key'],
                    mapping.get('mode', 'copy')
                )
                if success:
                    applied += 1
                else:
                    errors.append(f"Failed to apply mapping for {mapping['target_field_key']}")
            except TenantFormField.DoesNotExist:
                errors.append(f"Field not found: {mapping.get('target_field_id')}")
            except Exception as e:
                errors.append(f"Error mapping {mapping.get('target_field_key')}: {str(e)}")
        
        return {
            'applied': applied,
            'errors': errors
        }
