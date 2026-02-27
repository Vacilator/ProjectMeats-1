"""
Unit tests for Workflow Graph Validator

Tests validation logic for detecting:
- Circular dependencies
- Dangling nodes
- Orphan nodes
- Unreachable nodes
- Invalid connection patterns
"""
import unittest
from tenant_apps.workflows.services.validator import (
    WorkflowGraphValidator,
    ValidationError,
    validate_workflow
)


class TestWorkflowGraphValidator(unittest.TestCase):
    """Test suite for WorkflowGraphValidator."""
    
    def test_empty_workflow(self):
        """Empty workflow should be flagged."""
        flow_data = {'nodes': [], 'edges': []}
        is_valid, errors = validate_workflow(flow_data)
        
        self.assertFalse(is_valid)
        self.assertTrue(len(errors) >= 1)
        self.assertTrue(any(e['error_type'] == 'empty_workflow' for e in errors))
    
    def test_valid_simple_workflow(self):
        """Simple start -> action -> end workflow should be valid."""
        flow_data = {
            'nodes': [
                {'id': 'start', 'type': 'start', 'data': {'label': 'Start'}},
                {'id': 'action1', 'type': 'action', 'data': {'label': 'Process'}},
                {'id': 'end', 'type': 'end', 'data': {'label': 'End'}}
            ],
            'edges': [
                {'id': 'e1', 'source': 'start', 'target': 'action1'},
                {'id': 'e2', 'source': 'action1', 'target': 'end'}
            ]
        }
        is_valid, errors = validate_workflow(flow_data)
        
        self.assertTrue(is_valid)
        self.assertEqual(len(errors), 0)
    
    def test_missing_start_node(self):
        """Workflow without start node should be flagged."""
        flow_data = {
            'nodes': [
                {'id': 'action1', 'type': 'action', 'data': {'label': 'Process'}},
                {'id': 'end', 'type': 'end', 'data': {'label': 'End'}}
            ],
            'edges': [
                {'id': 'e1', 'source': 'action1', 'target': 'end'}
            ]
        }
        is_valid, errors = validate_workflow(flow_data)
        
        self.assertFalse(is_valid)
        self.assertTrue(any(e['error_type'] == 'missing_start' for e in errors))
    
    def test_circular_dependency_simple(self):
        """Simple circular dependency: A -> B -> A."""
        flow_data = {
            'nodes': [
                {'id': 'start', 'type': 'start', 'data': {'label': 'Start'}},
                {'id': 'action1', 'type': 'action', 'data': {'label': 'Action 1'}},
                {'id': 'action2', 'type': 'action', 'data': {'label': 'Action 2'}}
            ],
            'edges': [
                {'id': 'e1', 'source': 'start', 'target': 'action1'},
                {'id': 'e2', 'source': 'action1', 'target': 'action2'},
                {'id': 'e3', 'source': 'action2', 'target': 'action1'}  # Creates loop
            ]
        }
        is_valid, errors = validate_workflow(flow_data)
        
        self.assertFalse(is_valid)
        circular_errors = [e for e in errors if e['error_type'] == 'circular_dependency']
        self.assertTrue(len(circular_errors) > 0)
        self.assertIn('action1', circular_errors[0]['message'])
        self.assertIn('action2', circular_errors[0]['message'])
    
    def test_circular_dependency_self_loop(self):
        """Self-referencing loop: A -> A."""
        flow_data = {
            'nodes': [
                {'id': 'start', 'type': 'start', 'data': {'label': 'Start'}},
                {'id': 'action1', 'type': 'action', 'data': {'label': 'Loop Action'}}
            ],
            'edges': [
                {'id': 'e1', 'source': 'start', 'target': 'action1'},
                {'id': 'e2', 'source': 'action1', 'target': 'action1'}  # Self loop
            ]
        }
        is_valid, errors = validate_workflow(flow_data)
        
        self.assertFalse(is_valid)
        self.assertTrue(any(e['error_type'] == 'circular_dependency' for e in errors))
    
    def test_dangling_node(self):
        """Node with no outgoing connections (not an End node)."""
        flow_data = {
            'nodes': [
                {'id': 'start', 'type': 'start', 'data': {'label': 'Start'}},
                {'id': 'action1', 'type': 'action', 'data': {'label': 'Dead End'}}
            ],
            'edges': [
                {'id': 'e1', 'source': 'start', 'target': 'action1'}
                # action1 has no outgoing connections
            ]
        }
        is_valid, errors = validate_workflow(flow_data)
        
        dangling_errors = [e for e in errors if e['error_type'] == 'dangling_node']
        self.assertTrue(len(dangling_errors) > 0)
        self.assertEqual(dangling_errors[0]['node_id'], 'action1')
        self.assertEqual(dangling_errors[0]['severity'], 'warning')
    
    def test_orphan_node(self):
        """Node with no incoming connections (not a Start node)."""
        flow_data = {
            'nodes': [
                {'id': 'start', 'type': 'start', 'data': {'label': 'Start'}},
                {'id': 'action1', 'type': 'action', 'data': {'label': 'Connected'}},
                {'id': 'orphan', 'type': 'action', 'data': {'label': 'Orphan Node'}},
                {'id': 'end', 'type': 'end', 'data': {'label': 'End'}}
            ],
            'edges': [
                {'id': 'e1', 'source': 'start', 'target': 'action1'},
                {'id': 'e2', 'source': 'action1', 'target': 'end'}
                # 'orphan' has no incoming connections
            ]
        }
        is_valid, errors = validate_workflow(flow_data)
        
        orphan_errors = [e for e in errors if e['error_type'] == 'orphan_node']
        self.assertTrue(len(orphan_errors) > 0)
        self.assertTrue(any('orphan' in e['node_id'] for e in orphan_errors))
    
    def test_unreachable_node(self):
        """Node not reachable from Start node."""
        flow_data = {
            'nodes': [
                {'id': 'start', 'type': 'start', 'data': {'label': 'Start'}},
                {'id': 'action1', 'type': 'action', 'data': {'label': 'Reachable'}},
                {'id': 'action2', 'type': 'action', 'data': {'label': 'Unreachable A'}},
                {'id': 'action3', 'type': 'action', 'data': {'label': 'Unreachable B'}},
                {'id': 'end', 'type': 'end', 'data': {'label': 'End'}}
            ],
            'edges': [
                {'id': 'e1', 'source': 'start', 'target': 'action1'},
                {'id': 'e2', 'source': 'action1', 'target': 'end'},
                # action2 and action3 form separate disconnected component
                {'id': 'e3', 'source': 'action2', 'target': 'action3'}
            ]
        }
        is_valid, errors = validate_workflow(flow_data)
        
        self.assertFalse(is_valid)
        unreachable_errors = [e for e in errors if e['error_type'] == 'unreachable_node']
        self.assertTrue(len(unreachable_errors) >= 2)  # action2 and action3
    
    def test_conditional_node_connections(self):
        """Conditional node should have exactly 2 outgoing connections."""
        # Valid conditional with 2 outputs
        flow_data_valid = {
            'nodes': [
                {'id': 'start', 'type': 'start', 'data': {'label': 'Start'}},
                {'id': 'condition', 'type': 'conditional', 'data': {'label': 'Check'}},
                {'id': 'true_path', 'type': 'action', 'data': {'label': 'True Path'}},
                {'id': 'false_path', 'type': 'action', 'data': {'label': 'False Path'}},
                {'id': 'end', 'type': 'end', 'data': {'label': 'End'}}
            ],
            'edges': [
                {'id': 'e1', 'source': 'start', 'target': 'condition'},
                {'id': 'e2', 'source': 'condition', 'target': 'true_path'},
                {'id': 'e3', 'source': 'condition', 'target': 'false_path'},
                {'id': 'e4', 'source': 'true_path', 'target': 'end'},
                {'id': 'e5', 'source': 'false_path', 'target': 'end'}
            ]
        }
        is_valid, errors = validate_workflow(flow_data_valid)
        
        # Should not have connection errors
        connection_errors = [e for e in errors if e['error_type'] == 'invalid_connections']
        self.assertEqual(len(connection_errors), 0)
        
        # Invalid conditional with only 1 output
        flow_data_invalid = {
            'nodes': [
                {'id': 'start', 'type': 'start', 'data': {'label': 'Start'}},
                {'id': 'condition', 'type': 'conditional', 'data': {'label': 'Check'}},
                {'id': 'action', 'type': 'action', 'data': {'label': 'Action'}},
                {'id': 'end', 'type': 'end', 'data': {'label': 'End'}}
            ],
            'edges': [
                {'id': 'e1', 'source': 'start', 'target': 'condition'},
                {'id': 'e2', 'source': 'condition', 'target': 'action'},  # Only 1 output
                {'id': 'e3', 'source': 'action', 'target': 'end'}
            ]
        }
        is_valid, errors = validate_workflow(flow_data_invalid)
        
        connection_errors = [e for e in errors if e['error_type'] == 'invalid_connections']
        self.assertTrue(len(connection_errors) > 0)
        self.assertEqual(connection_errors[0]['node_id'], 'condition')


if __name__ == '__main__':
    unittest.main()
