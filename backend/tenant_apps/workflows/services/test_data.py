"""
Test Data Generator Service

Generates realistic test data for form preview functionality.
Uses pattern-based generation to create field-appropriate fake data.
"""

import random
import string
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional


# Sample data pools for realistic generation
FIRST_NAMES = [
    'James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda',
    'David', 'Elizabeth', 'William', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
    'Thomas', 'Sarah', 'Christopher', 'Karen', 'Daniel', 'Lisa', 'Matthew', 'Nancy'
]

LAST_NAMES = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
    'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
    'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White'
]

COMPANY_NAMES = [
    'Acme Foods', 'Pacific Meats', 'Mountain Fresh', 'Valley Provisions', 'Coast Distributors',
    'Prime Quality Foods', 'Central Meats', 'Heritage Farms', 'Western Supply', 'Northern Foods',
    'Golden Gate Meats', 'Sunrise Provisions', 'Blue Ridge Foods', 'River Valley Meats'
]

STREET_NAMES = [
    'Main', 'Oak', 'Maple', 'Cedar', 'Pine', 'Elm', 'Washington', 'Lincoln', 
    'Park', 'Lake', 'Hill', 'River', 'Valley', 'Industrial', 'Commerce'
]

STREET_TYPES = ['Street', 'Avenue', 'Boulevard', 'Drive', 'Road', 'Lane', 'Way', 'Court']

CITIES = [
    ('Los Angeles', 'CA', '90001'), ('San Francisco', 'CA', '94102'), ('San Diego', 'CA', '92101'),
    ('Seattle', 'WA', '98101'), ('Portland', 'OR', '97201'), ('Denver', 'CO', '80201'),
    ('Phoenix', 'AZ', '85001'), ('Las Vegas', 'NV', '89101'), ('Chicago', 'IL', '60601'),
    ('New York', 'NY', '10001'), ('Miami', 'FL', '33101'), ('Dallas', 'TX', '75201')
]

MEAT_PRODUCTS = [
    'USDA Choice Ribeye', 'Prime Beef Tenderloin', 'Ground Chuck 80/20', 'Pork Loin',
    'Chicken Breast', 'Lamb Chops', 'Bacon Slab', 'Italian Sausage', 'Brisket',
    'NY Strip Steak', 'Pork Belly', 'Chicken Thighs', 'Turkey Breast', 'Ham'
]

DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'company.com', 'business.net']


def generate_test_value(field_type: str, field_key: str, config: Dict[str, Any] = None) -> Any:
    """
    Generate a realistic test value based on field type and key.
    
    Args:
        field_type: The type of field (text, email, phone, etc.)
        field_key: The field key/name for context-aware generation
        config: Optional field configuration (for choices, min/max, etc.)
        
    Returns:
        A realistic test value appropriate for the field
    """
    config = config or {}
    key_lower = field_key.lower()
    
    # Try context-aware generation first based on field key
    contextual_value = _generate_contextual_value(key_lower, field_type, config)
    if contextual_value is not None:
        return contextual_value
    
    # Fall back to type-based generation
    return _generate_type_value(field_type, config)


def _generate_contextual_value(key: str, field_type: str, config: Dict) -> Optional[Any]:
    """Generate value based on field key context."""
    
    # Name fields
    if 'first_name' in key or key == 'first':
        return random.choice(FIRST_NAMES)
    if 'last_name' in key or key == 'last':
        return random.choice(LAST_NAMES)
    if 'name' in key and 'company' not in key:
        return f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
    
    # Company fields
    if 'company' in key or 'business' in key or 'organization' in key:
        return random.choice(COMPANY_NAMES)
    if 'supplier' in key:
        return random.choice(COMPANY_NAMES)
    if 'customer' in key:
        return random.choice(COMPANY_NAMES)
    
    # Contact fields
    if 'email' in key:
        first = random.choice(FIRST_NAMES).lower()
        last = random.choice(LAST_NAMES).lower()
        domain = random.choice(DOMAINS)
        return f"{first}.{last}@{domain}"
    
    if 'phone' in key or 'cell' in key or 'mobile' in key or 'tel' in key:
        return _generate_phone()
    
    if 'fax' in key:
        return _generate_phone()
    
    # Address fields
    if 'street' in key or 'address' in key and 'email' not in key:
        return _generate_street_address()
    if key == 'city':
        return random.choice(CITIES)[0]
    if key == 'state' or key == 'province':
        return random.choice(CITIES)[1]
    if 'zip' in key or 'postal' in key:
        return random.choice(CITIES)[2]
    if 'country' in key:
        return 'United States'
    
    # Product fields
    if 'product' in key or 'item' in key:
        return random.choice(MEAT_PRODUCTS)
    
    # Quantity/Amount fields
    if 'quantity' in key or 'qty' in key:
        return random.randint(1, 100)
    if 'price' in key or 'cost' in key or 'amount' in key:
        return round(random.uniform(10.00, 1000.00), 2)
    if 'weight' in key:
        return round(random.uniform(1.0, 50.0), 2)
    
    # Date fields
    if 'date' in key or 'due' in key or 'delivery' in key:
        return _generate_future_date()
    
    # Status fields
    if 'status' in key:
        choices = config.get('choices', [])
        if choices:
            return choices[0].get('value', 'active') if isinstance(choices[0], dict) else choices[0]
        return 'active'
    
    # Notes/Description
    if 'note' in key or 'description' in key or 'comment' in key:
        return _generate_note()
    
    # Title/Position
    if 'title' in key or 'position' in key or 'job' in key:
        return random.choice(['Manager', 'Director', 'Owner', 'Buyer', 'Sales Rep', 'Coordinator'])
    
    return None


def _generate_type_value(field_type: str, config: Dict) -> Any:
    """Generate value based on field type."""
    
    if field_type in ('text', 'string'):
        return _generate_random_text(10, 30)
    
    if field_type == 'email':
        first = random.choice(FIRST_NAMES).lower()
        last = random.choice(LAST_NAMES).lower()
        return f"{first}.{last}@{random.choice(DOMAINS)}"
    
    if field_type == 'phone':
        return _generate_phone()
    
    if field_type == 'url':
        return f"https://www.{random.choice(['example', 'company', 'business'])}.com"
    
    if field_type in ('number', 'integer'):
        min_val = config.get('min', 1)
        max_val = config.get('max', 100)
        return random.randint(int(min_val), int(max_val))
    
    if field_type in ('decimal', 'currency', 'float'):
        min_val = config.get('min', 0.01)
        max_val = config.get('max', 1000.00)
        return round(random.uniform(float(min_val), float(max_val)), 2)
    
    if field_type == 'date':
        return _generate_future_date()
    
    if field_type == 'datetime':
        date = datetime.now() + timedelta(days=random.randint(1, 30))
        return date.strftime('%Y-%m-%d %H:%M')
    
    if field_type == 'time':
        hour = random.randint(8, 17)
        minute = random.choice([0, 15, 30, 45])
        return f"{hour:02d}:{minute:02d}"
    
    if field_type == 'boolean':
        return random.choice([True, False])
    
    if field_type == 'checkbox':
        return random.choice([True, False])
    
    if field_type in ('select', 'dropdown', 'radio'):
        choices = config.get('choices', [])
        if choices:
            choice = random.choice(choices)
            return choice.get('value', choice) if isinstance(choice, dict) else choice
        return ''
    
    if field_type == 'multiselect':
        choices = config.get('choices', [])
        if choices:
            num = min(random.randint(1, 3), len(choices))
            selected = random.sample(choices, num)
            return [c.get('value', c) if isinstance(c, dict) else c for c in selected]
        return []
    
    if field_type == 'textarea':
        return _generate_note()
    
    if field_type == 'rating':
        max_rating = config.get('max', 5)
        return random.randint(3, max_rating)  # Skew positive
    
    if field_type == 'slider':
        min_val = config.get('min', 0)
        max_val = config.get('max', 100)
        step = config.get('step', 1)
        value = random.randint(int(min_val), int(max_val))
        # Align to step
        return value - (value % step) if step > 1 else value
    
    if field_type == 'signature':
        return None  # Cannot generate signatures
    
    if field_type == 'richtext':
        return f"<p>{_generate_note()}</p>"
    
    # Default fallback
    return _generate_random_text(5, 20)


def _generate_phone() -> str:
    """Generate realistic US phone number."""
    area = random.randint(200, 999)
    prefix = random.randint(200, 999)
    suffix = random.randint(1000, 9999)
    return f"({area}) {prefix}-{suffix}"


def _generate_street_address() -> str:
    """Generate realistic street address."""
    number = random.randint(100, 9999)
    street = random.choice(STREET_NAMES)
    street_type = random.choice(STREET_TYPES)
    return f"{number} {street} {street_type}"


def _generate_future_date() -> str:
    """Generate a date within the next 30 days."""
    future = datetime.now() + timedelta(days=random.randint(1, 30))
    return future.strftime('%Y-%m-%d')


def _generate_note() -> str:
    """Generate a realistic note/comment."""
    notes = [
        "Please confirm delivery date before shipping.",
        "Customer prefers morning delivery.",
        "Rush order - priority handling required.",
        "Standard terms apply.",
        "Quality inspection required upon receipt.",
        "Contact buyer for special instructions.",
        "Refrigerated transport required.",
        "Deliver to warehouse entrance B.",
    ]
    return random.choice(notes)


def _generate_random_text(min_len: int, max_len: int) -> str:
    """Generate random text of specified length."""
    length = random.randint(min_len, max_len)
    words = []
    while len(' '.join(words)) < length:
        word_len = random.randint(3, 8)
        word = ''.join(random.choices(string.ascii_lowercase, k=word_len))
        words.append(word.capitalize() if len(words) == 0 else word)
    return ' '.join(words)[:length]


def generate_form_test_data(form_snapshot: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    """
    Generate complete test data for a form based on its snapshot.
    
    Args:
        form_snapshot: The form structure snapshot with steps and fields
        
    Returns:
        Dictionary of test data: { step_id: { field_key: value } }
    """
    test_data = {}
    
    steps = form_snapshot.get('steps', [])
    for step in steps:
        step_id = step.get('id', '')
        step_data = {}
        
        for field in step.get('fields', []):
            field_key = field.get('field_key', field.get('key', ''))
            field_type = field.get('type', field.get('field_type', 'text'))
            config = field.get('config', {})
            
            # Add choices from field definition
            if field.get('choices'):
                config['choices'] = field['choices']
            if field.get('options'):
                config['choices'] = field['options']
            
            # Generate value
            value = generate_test_value(field_type, field_key, config)
            if value is not None:
                step_data[field_key] = value
        
        if step_data:
            test_data[step_id] = step_data
    
    return test_data
