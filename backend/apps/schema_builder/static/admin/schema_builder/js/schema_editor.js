/**
 * Schema Editor JavaScript
 * Alpine.js component for DataSchema visual editor
 * 
 * Features:
 * - Visual field cards with drag-drop reordering
 * - Add/Edit/Delete field modals
 * - Field type selection with preview
 * - AJAX-based CRUD operations
 */

// CSRF Token helper
function getCsrfToken() {
    const token = document.querySelector('[name=csrfmiddlewaretoken]');
    return token ? token.value : '';
}

// Field type icons mapping
const FIELD_TYPE_ICONS = {
    'text': '📝',
    'textarea': '📄',
    'integer': '#️⃣',
    'decimal': '🔢',
    'dropdown': '📋',
    'multiselect': '☑️',
    'currency': '💰',
    'phone': '📞',
    'email': '📧',
    'date': '📅',
    'datetime': '🕐',
    'boolean': '✅',
    'url': '🔗',
    'relation': '🔗'
};

// Field type labels
const FIELD_TYPE_LABELS = {
    'text': 'Text',
    'textarea': 'Text Area',
    'integer': 'Integer',
    'decimal': 'Decimal',
    'dropdown': 'Dropdown',
    'multiselect': 'Multi-select',
    'currency': 'Currency',
    'phone': 'Phone',
    'email': 'Email',
    'date': 'Date',
    'datetime': 'Date & Time',
    'boolean': 'Yes/No',
    'url': 'URL',
    'relation': 'Relation'
};

// Alpine.js Schema Editor Component
function schemaEditor() {
    return {
        // State
        schemaId: null,
        schemaName: '',
        fields: [],
        loading: true,
        
        // Modal states
        showAddModal: false,
        showEditModal: false,
        showDeleteConfirm: false,
        showConfigModal: false,
        
        // Current field being edited/deleted
        currentField: null,
        deleteFieldId: null,
        
        // New field form
        newField: {
            label: '',
            key: '',
            field_type: 'text',
            is_required: false,
            is_visible: true,
            is_searchable: true,
            help_text: '',
            placeholder: '',
            options: [],
            saving: false
        },
        
        // Edit field form
        editField: {
            id: null,
            label: '',
            key: '',
            field_type: 'text',
            is_required: false,
            is_visible: true,
            is_searchable: true,
            help_text: '',
            placeholder: '',
            options: [],
            saving: false
        },
        
        // Options input for dropdown/multiselect
        optionsText: '',
        
        // Notification
        notification: {
            show: false,
            message: '',
            type: 'success'
        },
        
        // Sortable instance
        sortable: null,
        
        // Initialize
        init() {
            // Get schema ID from URL
            const pathParts = window.location.pathname.split('/');
            const changeIndex = pathParts.indexOf('change');
            if (changeIndex > 0) {
                this.schemaId = pathParts[changeIndex - 1];
            }
            
            // Get schema name from page title
            const h1 = document.querySelector('#content h1');
            if (h1) {
                const match = h1.textContent.match(/Change Data Schema[:\s]*(.+)/i);
                if (match) {
                    this.schemaName = match[1].trim();
                }
            }
            
            if (this.schemaId) {
                this.loadFields();
            } else {
                this.loading = false;
            }
            
            // Initialize Sortable after DOM ready
            this.$nextTick(() => {
                this.initSortable();
            });
            
            // Keyboard shortcuts
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.closeAllModals();
                }
            });
            
            console.log('Schema Editor initialized', { schemaId: this.schemaId });
        },
        
        // Initialize Sortable.js for drag-drop reordering
        initSortable() {
            const list = this.$refs.fieldsList;
            if (!list || typeof Sortable === 'undefined') return;
            
            this.sortable = new Sortable(list, {
                handle: '.drag-handle',
                animation: 150,
                ghostClass: 'dragging',
                onEnd: (evt) => {
                    this.handleReorder(evt.oldIndex, evt.newIndex);
                }
            });
        },
        
        // Load fields from API
        async loadFields() {
            if (!this.schemaId) return;
            
            this.loading = true;
            try {
                const response = await fetch(`/api/v1/schema-builder/admin/schemas/${this.schemaId}/fields/`);
                if (!response.ok) {
                    throw new Error('Failed to load fields');
                }
                const data = await response.json();
                this.fields = data.fields || [];
            } catch (error) {
                console.error('Error loading fields:', error);
                this.showNotification('Failed to load fields', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // Get field type icon
        getFieldIcon(fieldType) {
            return FIELD_TYPE_ICONS[fieldType] || '📝';
        },
        
        // Get field type label
        getFieldTypeLabel(fieldType) {
            return FIELD_TYPE_LABELS[fieldType] || fieldType;
        },
        
        // Auto-generate key from label
        generateKey(label) {
            return label
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/^_+|_+$/g, '')
                .substring(0, 100);
        },
        
        // Open add field modal
        openAddModal() {
            this.newField = {
                label: '',
                key: '',
                field_type: 'text',
                is_required: false,
                is_visible: true,
                is_searchable: true,
                help_text: '',
                placeholder: '',
                options: [],
                saving: false
            };
            this.optionsText = '';
            this.showAddModal = true;
        },
        
        // Close add field modal
        closeAddModal() {
            this.showAddModal = false;
        },
        
        // Open edit field modal
        openEditModal(field) {
            this.editField = {
                id: field.id,
                label: field.label,
                key: field.key,
                field_type: field.field_type,
                is_required: field.is_required,
                is_visible: field.is_visible,
                is_searchable: field.is_searchable,
                help_text: field.help_text || '',
                placeholder: field.placeholder || '',
                options: field.options || [],
                saving: false
            };
            // Convert options to text format
            if (field.options && Array.isArray(field.options)) {
                this.optionsText = field.options.map(o => 
                    typeof o === 'object' ? o.label || o.value : o
                ).join('\n');
            } else {
                this.optionsText = '';
            }
            this.showEditModal = true;
        },
        
        // Close edit field modal
        closeEditModal() {
            this.showEditModal = false;
        },
        
        // Open delete confirmation
        openDeleteConfirm(field) {
            this.deleteFieldId = field.id;
            this.currentField = field;
            this.showDeleteConfirm = true;
        },
        
        // Close delete confirmation
        closeDeleteConfirm() {
            this.showDeleteConfirm = false;
            this.deleteFieldId = null;
            this.currentField = null;
        },
        
        // Close all modals
        closeAllModals() {
            this.showAddModal = false;
            this.showEditModal = false;
            this.showDeleteConfirm = false;
            this.showConfigModal = false;
        },
        
        // Parse options text to array
        parseOptions(text) {
            if (!text) return [];
            return text.split('\n')
                .map(line => line.trim())
                .filter(line => line)
                .map(line => ({
                    value: this.generateKey(line),
                    label: line
                }));
        },
        
        // Needs options (dropdown or multiselect)
        needsOptions(fieldType) {
            return ['dropdown', 'multiselect'].includes(fieldType);
        },
        
        // Add new field
        async addField() {
            if (!this.newField.label) {
                this.showNotification('Label is required', 'error');
                return;
            }
            
            this.newField.saving = true;
            
            // Auto-generate key if not provided
            if (!this.newField.key) {
                this.newField.key = this.generateKey(this.newField.label);
            }
            
            // Parse options
            const options = this.parseOptions(this.optionsText);
            
            try {
                const response = await fetch(`/api/v1/schema-builder/admin/schemas/${this.schemaId}/fields/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCsrfToken()
                    },
                    body: JSON.stringify({
                        label: this.newField.label,
                        key: this.newField.key,
                        field_type: this.newField.field_type,
                        is_required: this.newField.is_required,
                        is_visible: this.newField.is_visible,
                        is_searchable: this.newField.is_searchable,
                        help_text: this.newField.help_text,
                        placeholder: this.newField.placeholder,
                        options: options
                    })
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to add field');
                }
                
                const data = await response.json();
                this.fields.push(data.field);
                this.closeAddModal();
                this.showNotification(`Field "${this.newField.label}" added successfully!`, 'success');
                
            } catch (error) {
                console.error('Error adding field:', error);
                this.showNotification(error.message || 'Failed to add field', 'error');
            } finally {
                this.newField.saving = false;
            }
        },
        
        // Update existing field
        async updateField() {
            if (!this.editField.label) {
                this.showNotification('Label is required', 'error');
                return;
            }
            
            this.editField.saving = true;
            
            // Parse options
            const options = this.parseOptions(this.optionsText);
            
            try {
                const response = await fetch(`/api/v1/schema-builder/admin/fields/${this.editField.id}/`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCsrfToken()
                    },
                    body: JSON.stringify({
                        label: this.editField.label,
                        field_type: this.editField.field_type,
                        is_required: this.editField.is_required,
                        is_visible: this.editField.is_visible,
                        is_searchable: this.editField.is_searchable,
                        help_text: this.editField.help_text,
                        placeholder: this.editField.placeholder,
                        options: options
                    })
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to update field');
                }
                
                const data = await response.json();
                
                // Update field in local array
                const index = this.fields.findIndex(f => f.id === this.editField.id);
                if (index !== -1) {
                    this.fields[index] = data.field;
                }
                
                this.closeEditModal();
                this.showNotification(`Field "${this.editField.label}" updated successfully!`, 'success');
                
            } catch (error) {
                console.error('Error updating field:', error);
                this.showNotification(error.message || 'Failed to update field', 'error');
            } finally {
                this.editField.saving = false;
            }
        },
        
        // Delete field
        async deleteField() {
            if (!this.deleteFieldId) return;
            
            try {
                const response = await fetch(`/api/v1/schema-builder/admin/fields/${this.deleteFieldId}/`, {
                    method: 'DELETE',
                    headers: {
                        'X-CSRFToken': getCsrfToken()
                    }
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to delete field');
                }
                
                // Remove field from local array
                this.fields = this.fields.filter(f => f.id !== this.deleteFieldId);
                this.closeDeleteConfirm();
                this.showNotification('Field deleted successfully!', 'success');
                
            } catch (error) {
                console.error('Error deleting field:', error);
                this.showNotification(error.message || 'Failed to delete field', 'error');
            }
        },
        
        // Handle reorder after drag-drop
        async handleReorder(oldIndex, newIndex) {
            if (oldIndex === newIndex) return;
            
            // Update local array
            const [movedField] = this.fields.splice(oldIndex, 1);
            this.fields.splice(newIndex, 0, movedField);
            
            // Build new order
            const fieldOrder = this.fields.map((f, i) => ({
                id: f.id,
                order: i
            }));
            
            try {
                const response = await fetch(`/api/v1/schema-builder/admin/schemas/${this.schemaId}/reorder/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCsrfToken()
                    },
                    body: JSON.stringify({ field_order: fieldOrder })
                });
                
                if (!response.ok) {
                    throw new Error('Failed to save order');
                }
                
                this.showNotification('Field order updated', 'success');
                
            } catch (error) {
                console.error('Error saving order:', error);
                this.showNotification('Failed to save field order', 'error');
                // Reload to restore correct order
                this.loadFields();
            }
        },
        
        // Show notification
        showNotification(message, type = 'success') {
            this.notification = { show: true, message, type };
            setTimeout(() => {
                this.notification.show = false;
            }, 4000);
        },
        
        // Get all available field types
        getFieldTypes() {
            return Object.entries(FIELD_TYPE_LABELS).map(([value, label]) => ({
                value,
                label,
                icon: FIELD_TYPE_ICONS[value]
            }));
        }
    };
}
