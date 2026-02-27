"""
Workflow Graph Validation Service

Validates workflow logic to prevent infinite loops, dead-end nodes, and orphan nodes.
Ensures workflows are logically sound before execution.

Phase 7.1 Readiness - The "Safety Net"
Authority: .github/copilot-instructions.md (Phase 7 - Intelligent Workform Editor)
"""
from typing import Dict, List, Set, Tuple, Optional, Any
from collections import defaultdict, deque


class ValidationError:
    """Represents a single validation error."""
    
    def __init__(self, node_id: str, error_type: str, message: str, severity: str = 'error'):
        self.node_id = node_id
        self.error_type = error_type
        self.message = message
        self.severity = severity
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            'node_id': self.node_id,
            'error_type': self.error_type,
            'message': self.message,
            'severity': self.severity
        }


class WorkflowGraphValidator:
    """
    Validates workflow graph structure and logic.
    
    Detects:
    - Circular dependencies (infinite loops)
    - Dangling nodes (no outgoing connections except End nodes)
    - Orphan nodes (no incoming connections except Start nodes)
    - Unreachable nodes (no path from Start)
    - Multiple Start/End nodes
    - Missing critical node types
    """
    
    # Node types that are expected to have no outgoing connections
    TERMINAL_NODE_TYPES = {'end', 'return', 'stop', 'exit'}
    
    # Node types that are expected to have no incoming connections
    ENTRY_NODE_TYPES = {'start', 'trigger', 'entry'}
    
    def __init__(self, flow_data: Dict[str, Any]):
        """
        Initialize validator with flow data.
        
        Args:
            flow_data: React Flow data structure with 'nodes' and 'edges' keys
        """
        self.flow_data = flow_data
        self.nodes = flow_data.get('nodes', [])
        self.edges = flow_data.get('edges', [])
        self.errors: List[ValidationError] = []
        
        # Build adjacency lists for graph traversal
        self.adjacency_list = self._build_adjacency_list()
        self.reverse_adjacency_list = self._build_reverse_adjacency_list()
        
        # Track node metadata
        self.node_map = {node['id']: node for node in self.nodes}
        self.node_types = {node['id']: self._get_node_type(node) for node in self.nodes}
    
    def _get_node_type(self, node: Dict[str, Any]) -> str:
        """
        Extract node type from node data.
        
        Args:
            node: Node object
            
        Returns:
            Node type string (lowercased)
        """
        # Try 'type' field first (React Flow standard)
        node_type = node.get('type', '')
        
        # Try data.type if type is not at top level
        if not node_type:
            node_type = node.get('data', {}).get('type', '')
        
        # Try data.nodeType for custom implementations
        if not node_type:
            node_type = node.get('data', {}).get('nodeType', '')
        
        return node_type.lower() if node_type else 'unknown'
    
    def _build_adjacency_list(self) -> Dict[str, List[str]]:
        """
        Build adjacency list from edges (forward direction).
        
        Returns:
            Dictionary mapping node_id -> list of connected node_ids
        """
        adjacency = defaultdict(list)
        for edge in self.edges:
            source = edge.get('source')
            target = edge.get('target')
            if source and target:
                adjacency[source].append(target)
        return dict(adjacency)
    
    def _build_reverse_adjacency_list(self) -> Dict[str, List[str]]:
        """
        Build reverse adjacency list from edges (backward direction).
        
        Returns:
            Dictionary mapping node_id -> list of nodes that point to it
        """
        reverse_adjacency = defaultdict(list)
        for edge in self.edges:
            source = edge.get('source')
            target = edge.get('target')
            if source and target:
                reverse_adjacency[target].append(source)
        return dict(reverse_adjacency)
    
    def _find_start_nodes(self) -> List[str]:
        """
        Find all start nodes in the workflow.
        
        Returns:
            List of start node IDs
        """
        start_nodes = []
        for node_id, node_type in self.node_types.items():
            if node_type in self.ENTRY_NODE_TYPES:
                start_nodes.append(node_id)
        return start_nodes
    
    def _find_end_nodes(self) -> List[str]:
        """
        Find all end nodes in the workflow.
        
        Returns:
            List of end node IDs
        """
        end_nodes = []
        for node_id, node_type in self.node_types.items():
            if node_type in self.TERMINAL_NODE_TYPES:
                end_nodes.append(node_id)
        return end_nodes
    
    def validate(self) -> Tuple[bool, List[Dict[str, Any]]]:
        """
        Run all validation checks.
        
        Returns:
            Tuple of (is_valid, list of error dictionaries)
        """
        self.errors = []
        
        # Run all validation checks
        self._validate_empty_workflow()
        self._validate_start_nodes()
        self._validate_end_nodes()
        self._validate_circular_dependencies()
        self._validate_dangling_nodes()
        self._validate_orphan_nodes()
        self._validate_unreachable_nodes()
        self._validate_invalid_connections()
        
        # Convert errors to dictionaries
        error_dicts = [error.to_dict() for error in self.errors]
        
        return len(self.errors) == 0, error_dicts
    
    def _validate_empty_workflow(self):
        """Check if workflow has any nodes."""
        if not self.nodes:
            self.errors.append(ValidationError(
                node_id='',
                error_type='empty_workflow',
                message='Workflow has no nodes',
                severity='error'
            ))
    
    def _validate_start_nodes(self):
        """Validate presence of start nodes."""
        start_nodes = self._find_start_nodes()
        
        if not start_nodes:
            self.errors.append(ValidationError(
                node_id='',
                error_type='missing_start',
                message='Workflow must have at least one Start node',
                severity='error'
            ))
        elif len(start_nodes) > 1:
            for node_id in start_nodes[1:]:
                self.errors.append(ValidationError(
                    node_id=node_id,
                    error_type='multiple_starts',
                    message=f'Workflow has multiple Start nodes. Only one Start node is recommended.',
                    severity='warning'
                ))
    
    def _validate_end_nodes(self):
        """Validate presence of end nodes."""
        end_nodes = self._find_end_nodes()
        
        if not end_nodes and len(self.nodes) > 1:
            self.errors.append(ValidationError(
                node_id='',
                error_type='missing_end',
                message='Workflow should have at least one End node',
                severity='warning'
            ))
    
    def _validate_circular_dependencies(self):
        """
        Detect circular dependencies using Depth-First Search.
        
        A cycle exists if we can reach a node from itself.
        """
        visited = set()
        recursion_stack = set()
        
        def dfs(node_id: str, path: List[str]) -> bool:
            """
            DFS helper to detect cycles.
            
            Args:
                node_id: Current node ID
                path: Current path taken
                
            Returns:
                True if cycle detected
            """
            visited.add(node_id)
            recursion_stack.add(node_id)
            path.append(node_id)
            
            # Check all neighbors
            for neighbor in self.adjacency_list.get(node_id, []):
                if neighbor not in visited:
                    if dfs(neighbor, path.copy()):
                        return True
                elif neighbor in recursion_stack:
                    # Cycle detected
                    cycle_start_idx = path.index(neighbor)
                    cycle_path = path[cycle_start_idx:] + [neighbor]
                    cycle_str = ' → '.join(cycle_path)
                    
                    self.errors.append(ValidationError(
                        node_id=neighbor,
                        error_type='circular_dependency',
                        message=f'Circular dependency detected: {cycle_str}',
                        severity='error'
                    ))
                    return True
            
            recursion_stack.remove(node_id)
            return False
        
        # Check from all nodes (handle disconnected components)
        for node_id in self.node_map.keys():
            if node_id not in visited:
                dfs(node_id, [])
    
    def _validate_dangling_nodes(self):
        """
        Identify nodes with no outgoing connections (unless they are End nodes).
        """
        for node_id in self.node_map.keys():
            node_type = self.node_types.get(node_id, 'unknown')
            has_outgoing = node_id in self.adjacency_list and len(self.adjacency_list[node_id]) > 0
            
            # Skip terminal node types
            if node_type in self.TERMINAL_NODE_TYPES:
                continue
            
            if not has_outgoing:
                node_label = self.node_map[node_id].get('data', {}).get('label', node_id)
                self.errors.append(ValidationError(
                    node_id=node_id,
                    error_type='dangling_node',
                    message=f'Node "{node_label}" has no outgoing connections. Add a connection or mark as End node.',
                    severity='warning'
                ))
    
    def _validate_orphan_nodes(self):
        """
        Identify nodes with no incoming connections (unless they are Start nodes).
        """
        for node_id in self.node_map.keys():
            node_type = self.node_types.get(node_id, 'unknown')
            has_incoming = node_id in self.reverse_adjacency_list and len(self.reverse_adjacency_list[node_id]) > 0
            
            # Skip entry node types
            if node_type in self.ENTRY_NODE_TYPES:
                continue
            
            if not has_incoming:
                node_label = self.node_map[node_id].get('data', {}).get('label', node_id)
                self.errors.append(ValidationError(
                    node_id=node_id,
                    error_type='orphan_node',
                    message=f'Node "{node_label}" has no incoming connections. It will never be executed.',
                    severity='warning'
                ))
    
    def _validate_unreachable_nodes(self):
        """
        Identify nodes that cannot be reached from any Start node using BFS.
        """
        start_nodes = self._find_start_nodes()
        
        if not start_nodes:
            return  # Already flagged by _validate_start_nodes
        
        # BFS from all start nodes to find reachable nodes
        reachable = set()
        queue = deque(start_nodes)
        reachable.update(start_nodes)
        
        while queue:
            current = queue.popleft()
            for neighbor in self.adjacency_list.get(current, []):
                if neighbor not in reachable:
                    reachable.add(neighbor)
                    queue.append(neighbor)
        
        # Check for unreachable nodes
        all_nodes = set(self.node_map.keys())
        unreachable_nodes = all_nodes - reachable
        
        for node_id in unreachable_nodes:
            node_type = self.node_types.get(node_id, 'unknown')
            
            # Skip if it's another start node (already warned about multiple starts)
            if node_type in self.ENTRY_NODE_TYPES:
                continue
            
            node_label = self.node_map[node_id].get('data', {}).get('label', node_id)
            self.errors.append(ValidationError(
                node_id=node_id,
                error_type='unreachable_node',
                message=f'Node "{node_label}" cannot be reached from Start node. Check connections.',
                severity='error'
            ))
    
    def _validate_invalid_connections(self):
        """
        Validate that connections make logical sense.
        
        For example:
        - Conditional nodes should have exactly 2 outgoing connections (true/false)
        - Loop nodes should have specific connection patterns
        """
        for node_id in self.node_map.keys():
            node_type = self.node_types.get(node_id, 'unknown')
            outgoing_count = len(self.adjacency_list.get(node_id, []))
            
            # Conditional branch nodes should have 2 outputs
            if node_type in {'conditional', 'conditionalbranch', 'if', 'branch'}:
                if outgoing_count != 2:
                    node_label = self.node_map[node_id].get('data', {}).get('label', node_id)
                    self.errors.append(ValidationError(
                        node_id=node_id,
                        error_type='invalid_connections',
                        message=f'Conditional node "{node_label}" should have exactly 2 outgoing connections (true/false paths). Found {outgoing_count}.',
                        severity='warning'
                    ))


def validate_workflow(flow_data: Dict[str, Any]) -> Tuple[bool, List[Dict[str, Any]]]:
    """
    Validate workflow graph structure.
    
    This is the main entry point for workflow validation. Call this before
    saving flow_data to ensure the workflow is logically sound.
    
    Args:
        flow_data: React Flow data structure with 'nodes' and 'edges' keys
        
    Returns:
        Tuple of (is_valid: bool, errors: List[Dict])
        
    Example:
        >>> is_valid, errors = validate_workflow(form.flow_data)
        >>> if not is_valid:
        >>>     return Response({"errors": errors}, status=400)
    """
    validator = WorkflowGraphValidator(flow_data)
    return validator.validate()
