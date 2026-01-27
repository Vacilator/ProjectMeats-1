/**
 * Form Builder JavaScript
 * Alpine.js components for TenantForm visual editor
 */

// CSRF Token helper
function getCsrfToken() {
    const token = document.querySelector('[name=csrfmiddlewaretoken]');
    return token ? token.value : '';
}

// Alpine.js Form Builder Component
function formBuilder() {
    return {
        // State
        formSteps: [],
        stepCount: 0,
        
        // Modal states
        showFieldModal: false,
        showRuleModal: false,
        showAddStepModal: false,
        showPreviewModal: false,
        
        // Field editor state
        currentStepId: null,
        currentStepName: '',
        selectedFields: [],
        availableFields: [],
        filteredAvailableFields: [],
        fieldSearch: '',
        
        // Rule builder state
        editingRuleId: null,
        ruleForm: {
            name: '',
            conditionStep: '',
            conditionField: '',
            conditionOperator: 'eq',
            conditionValue: '',
            actionType: 'display_fields',
            actionStep: '',
            actionTargetFields: []
        },
        conditionFields: [],
        actionFields: [],
        
        // Add step state
        newStep: {
            entityType: '',
            stepName: ''
        },
        
        // Initialization
        init() {
            this.loadFormSteps();
            this.initSortable();
            console.log('Form Builder initialized');
        },
        
        // Load existing form steps from DOM
        loadFormSteps() {
            const stepCards = document.querySelectorAll('.step-card[data-step-id]');
            this.formSteps = Array.from(stepCards).map((card, index) => ({
                id: card.dataset.stepId,
                order: parseInt(card.dataset.order) || index,
                name: card.querySelector('.step-title')?.textContent.trim() || `Step ${index + 1}`,
                entityType: card.querySelector('.step-entity-badge')?.textContent.trim() || ''
            }));
            this.stepCount = this.formSteps.length;
        },
        
        // Initialize Sortable.js for drag-drop
        initSortable() {
            const container = document.getElementById('step-cards');
            if (container && typeof Sortable !== 'undefined') {
                new Sortable(container, {
                    animation: 150,
                    handle: '.drag-handle',
                    ghostClass: 'sortable-ghost',
                    chosenClass: 'sortable-chosen',
                    filter: '.step-card-add', // Don't drag the "Add" card
                    onEnd: (evt) => {
                        this.onStepReorder(evt);
                    }
                });
            }
        },
        
        // Handle step reorder
        async onStepReorder(evt) {
            const stepCards = document.querySelectorAll('.step-card[data-step-id]');
            const newOrder = Array.from(stepCards).map((card, index) => ({
                id: card.dataset.stepId,
                order: index
            }));
            
            // Update step numbers visually
            stepCards.forEach((card, index) => {
                const stepNum = card.querySelector('.step-number');
                if (stepNum) {
                    stepNum.textContent = `Step ${index + 1}`;
                }
            });
            
            // Update hidden form fields for Django
            this.updateInlineOrder(newOrder);
            
            // Optionally save via AJAX
            // await this.saveStepOrder(newOrder);
            
            console.log('Steps reordered:', newOrder);
        },
        
        // Update Django inline form order fields
        updateInlineOrder(newOrder) {
            newOrder.forEach(item => {
                // Find the corresponding inline form and update its order field
                const orderInput = document.querySelector(
                    `input[name$="-order"][value="${item.id}"]` // This needs refinement based on actual form structure
                );
                if (orderInput) {
                    // Find sibling order field
                    const form = orderInput.closest('tr, .form-row, .inline-related');
                    if (form) {
                        const orderField = form.querySelector('input[name$="-order"]');
                        if (orderField) {
                            orderField.value = item.order;
                        }
                    }
                }
            });
        },
        
        // Toggle preview modal
        togglePreview() {
            this.showPreviewModal = !this.showPreviewModal;
        },
        
        closePreview() {
            this.showPreviewModal = false;
        },
        
        // ==================== FIELD EDITOR ====================
        
        openFieldEditor(stepId) {
            this.currentStepId = stepId;
            const step = this.formSteps.find(s => s.id === stepId);
            this.currentStepName = step ? step.name : 'Unknown Step';
            
            // Load fields for this step's entity type
            this.loadFieldsForEntity(step?.entityType || 'supplier');
            
            this.showFieldModal = true;
        },
        
        closeFieldModal() {
            this.showFieldModal = false;
            this.currentStepId = null;
            this.fieldSearch = '';
        },
        
        loadFieldsForEntity(entityType) {
            // Entity field definitions (will be fetched from API in production)
            const entityFields = {
                supplier: [
                    { key: 'name', label: 'Name', type: 'text', required: true },
                    { key: 'contact_email', label: 'Contact Email', type: 'email', required: true },
                    { key: 'phone', label: 'Phone', type: 'phone', required: false },
                    { key: 'supplier_type', label: 'Supplier Type', type: 'dropdown', required: true },
                    { key: 'address', label: 'Address', type: 'text', required: false },
                    { key: 'website', label: 'Website', type: 'url', required: false },
                    { key: 'tax_id', label: 'Tax ID', type: 'text', required: false },
                    { key: 'payment_terms', label: 'Payment Terms', type: 'dropdown', required: false },
                    { key: 'credit_limit', label: 'Credit Limit', type: 'currency', required: false },
                    { key: 'notes', label: 'Notes', type: 'textarea', required: false },
                ],
                customer: [
                    { key: 'name', label: 'Name', type: 'text', required: true },
                    { key: 'email', label: 'Email', type: 'email', required: true },
                    { key: 'phone', label: 'Phone', type: 'phone', required: false },
                    { key: 'customer_type', label: 'Customer Type', type: 'dropdown', required: true },
                    { key: 'billing_address', label: 'Billing Address', type: 'text', required: false },
                    { key: 'shipping_address', label: 'Shipping Address', type: 'text', required: false },
                    { key: 'tax_exempt', label: 'Tax Exempt', type: 'boolean', required: false },
                    { key: 'credit_limit', label: 'Credit Limit', type: 'currency', required: false },
                ],
                purchase_order: [
                    { key: 'order_number', label: 'Order Number', type: 'text', required: true },
                    { key: 'supplier_id', label: 'Supplier', type: 'reference', required: true },
                    { key: 'order_date', label: 'Order Date', type: 'date', required: true },
                    { key: 'expected_delivery', label: 'Expected Delivery', type: 'date', required: false },
                    { key: 'status', label: 'Status', type: 'dropdown', required: true },
                    { key: 'total_amount', label: 'Total Amount', type: 'currency', required: false },
                    { key: 'notes', label: 'Notes', type: 'textarea', required: false },
                ],
                sales_order: [
                    { key: 'order_number', label: 'Order Number', type: 'text', required: true },
                    { key: 'customer_id', label: 'Customer', type: 'reference', required: true },
                    { key: 'order_date', label: 'Order Date', type: 'date', required: true },
                    { key: 'delivery_date', label: 'Delivery Date', type: 'date', required: false },
                    { key: 'status', label: 'Status', type: 'dropdown', required: true },
                    { key: 'delivery_method', label: 'Delivery Method', type: 'dropdown', required: false },
                    { key: 'shipping_address', label: 'Shipping Address', type: 'text', required: false },
                    { key: 'total_amount', label: 'Total Amount', type: 'currency', required: false },
                ],
                product: [
                    { key: 'name', label: 'Product Name', type: 'text', required: true },
                    { key: 'sku', label: 'SKU', type: 'text', required: true },
                    { key: 'description', label: 'Description', type: 'textarea', required: false },
                    { key: 'category', label: 'Category', type: 'dropdown', required: false },
                    { key: 'unit_price', label: 'Unit Price', type: 'currency', required: true },
                    { key: 'unit_of_measure', label: 'Unit of Measure', type: 'dropdown', required: true },
                ],
                plant: [
                    { key: 'name', label: 'Plant Name', type: 'text', required: true },
                    { key: 'code', label: 'Plant Code', type: 'text', required: true },
                    { key: 'address', label: 'Address', type: 'text', required: false },
                    { key: 'manager', label: 'Manager', type: 'reference', required: false },
                ],
                location: [
                    { key: 'name', label: 'Location Name', type: 'text', required: true },
                    { key: 'plant_id', label: 'Plant', type: 'reference', required: true },
                    { key: 'location_type', label: 'Type', type: 'dropdown', required: false },
                    { key: 'capacity', label: 'Capacity', type: 'number', required: false },
                ],
                contact: [
                    { key: 'first_name', label: 'First Name', type: 'text', required: true },
                    { key: 'last_name', label: 'Last Name', type: 'text', required: true },
                    { key: 'email', label: 'Email', type: 'email', required: false },
                    { key: 'phone', label: 'Phone', type: 'phone', required: false },
                    { key: 'role', label: 'Role', type: 'dropdown', required: false },
                ],
                carrier: [
                    { key: 'name', label: 'Carrier Name', type: 'text', required: true },
                    { key: 'code', label: 'Carrier Code', type: 'text', required: false },
                    { key: 'contact_email', label: 'Contact Email', type: 'email', required: false },
                    { key: 'phone', label: 'Phone', type: 'phone', required: false },
                ],
                invoice: [
                    { key: 'invoice_number', label: 'Invoice Number', type: 'text', required: true },
                    { key: 'customer_id', label: 'Customer', type: 'reference', required: true },
                    { key: 'invoice_date', label: 'Invoice Date', type: 'date', required: true },
                    { key: 'due_date', label: 'Due Date', type: 'date', required: true },
                    { key: 'status', label: 'Status', type: 'dropdown', required: true },
                    { key: 'total_amount', label: 'Total Amount', type: 'currency', required: true },
                ],
            };
            
            const fields = entityFields[entityType] || entityFields.supplier;
            
            // For now, assume first 5 fields are selected (will load from DB in production)
            this.selectedFields = fields.slice(0, 5).map(f => ({ ...f }));
            this.availableFields = fields.slice(5).map(f => ({ ...f }));
            this.filteredAvailableFields = [...this.availableFields];
        },
        
        filterFields() {
            const search = this.fieldSearch.toLowerCase();
            if (!search) {
                this.filteredAvailableFields = [...this.availableFields];
            } else {
                this.filteredAvailableFields = this.availableFields.filter(
                    f => f.label.toLowerCase().includes(search) || f.key.toLowerCase().includes(search)
                );
            }
        },
        
        isFieldSelected(fieldKey) {
            return this.selectedFields.some(f => f.key === fieldKey);
        },
        
        toggleField(fieldKey) {
            if (this.isFieldSelected(fieldKey)) {
                // Remove from selected
                this.selectedFields = this.selectedFields.filter(f => f.key !== fieldKey);
                // Add back to available
                const field = [...this.selectedFields, ...this.availableFields].find(f => f.key === fieldKey);
                if (field && !this.availableFields.some(f => f.key === fieldKey)) {
                    this.availableFields.push(field);
                    this.filterFields();
                }
            } else {
                // Add to selected
                const field = this.availableFields.find(f => f.key === fieldKey);
                if (field) {
                    this.selectedFields.push({ ...field });
                    this.availableFields = this.availableFields.filter(f => f.key !== fieldKey);
                    this.filterFields();
                }
            }
        },
        
        addField(fieldKey) {
            if (!this.isFieldSelected(fieldKey)) {
                this.toggleField(fieldKey);
            }
        },
        
        configureField(fieldKey) {
            // TODO: Open field configuration modal (auto-populate, conditional visibility)
            console.log('Configure field:', fieldKey);
            alert('Field configuration coming in Phase 3!\n\nThis will allow:\n- Auto-populate from previous steps\n- Conditional visibility\n- Custom labels and help text');
        },
        
        async saveFieldSelection() {
            // TODO: Save via AJAX to backend
            console.log('Saving field selection for step:', this.currentStepId);
            console.log('Selected fields:', this.selectedFields.map(f => f.key));
            
            // For now, close the modal
            this.closeFieldModal();
            
            // Show success message
            alert('Field selection saved! (AJAX save coming soon)');
        },
        
        // ==================== RULE EDITOR ====================
        
        openRuleEditor(stepId) {
            // Load rules for this step
            console.log('Open rule editor for step:', stepId);
            this.resetRuleForm();
            this.showRuleModal = true;
        },
        
        showAddRuleModal() {
            this.editingRuleId = null;
            this.resetRuleForm();
            this.showRuleModal = true;
        },
        
        closeRuleModal() {
            this.showRuleModal = false;
            this.editingRuleId = null;
        },
        
        resetRuleForm() {
            this.ruleForm = {
                name: '',
                conditionStep: '',
                conditionField: '',
                conditionOperator: 'eq',
                conditionValue: '',
                actionType: 'display_fields',
                actionStep: '',
                actionTargetFields: []
            };
            this.conditionFields = [];
            this.actionFields = [];
        },
        
        editRule(ruleId) {
            this.editingRuleId = ruleId;
            // TODO: Load rule data from DOM/API
            this.showRuleModal = true;
        },
        
        deleteRule(ruleId) {
            if (confirm('Are you sure you want to delete this rule?')) {
                // TODO: Delete via AJAX
                console.log('Delete rule:', ruleId);
            }
        },
        
        get rulePreviewText() {
            if (!this.ruleForm.conditionStep || !this.ruleForm.conditionField) {
                return 'Configure the condition above to see preview...';
            }
            
            const step = this.formSteps.find(s => s.id === this.ruleForm.conditionStep);
            const stepName = step ? step.name : 'Unknown Step';
            
            const operators = {
                'eq': 'equals',
                'neq': 'does not equal',
                'contains': 'contains',
                'not_contains': 'does not contain',
                'gt': 'is greater than',
                'lt': 'is less than',
                'is_empty': 'is empty',
                'is_not_empty': 'is not empty'
            };
            
            const actions = {
                'display_fields': 'show',
                'hide_fields': 'hide',
                'set_value': 'set value for'
            };
            
            let preview = `When ${this.ruleForm.conditionField} in ${stepName} ${operators[this.ruleForm.conditionOperator] || 'equals'}`;
            
            if (!['is_empty', 'is_not_empty'].includes(this.ruleForm.conditionOperator)) {
                preview += ` "${this.ruleForm.conditionValue}"`;
            }
            
            preview += `, then ${actions[this.ruleForm.actionType] || 'show'}`;
            
            if (this.ruleForm.actionTargetFields.length > 0) {
                preview += ` ${this.ruleForm.actionTargetFields.join(', ')}`;
            } else {
                preview += ' [select target fields]';
            }
            
            return preview;
        },
        
        async saveRule() {
            // TODO: Save via AJAX
            console.log('Save rule:', this.ruleForm);
            this.closeRuleModal();
            alert('Rule saved! (AJAX save coming soon)');
        },
        
        // ==================== ADD STEP ====================
        
        showAddStepModal() {
            this.newStep = { entityType: '', stepName: '' };
            this.showAddStepModal = true;
        },
        
        closeAddStepModal() {
            this.showAddStepModal = false;
        },
        
        async addStep() {
            if (!this.newStep.entityType) {
                alert('Please select an entity type');
                return;
            }
            
            // TODO: Add step via AJAX or Django inline management
            console.log('Add step:', this.newStep);
            
            // For now, we'll need to use Django's inline formset management
            // This requires clicking the "Add another" button in the hidden inlines
            const addButton = document.querySelector('.add-row a, .inline-group .add-row');
            if (addButton) {
                addButton.click();
                
                // Then populate the new inline form
                setTimeout(() => {
                    const inlines = document.querySelectorAll('.inline-related:not(.empty-form)');
                    const lastInline = inlines[inlines.length - 1];
                    if (lastInline) {
                        const entityTypeInput = lastInline.querySelector('[name$="-entity_type"]');
                        const stepNameInput = lastInline.querySelector('[name$="-step_name"]');
                        const orderInput = lastInline.querySelector('[name$="-order"]');
                        
                        if (entityTypeInput) entityTypeInput.value = this.newStep.entityType;
                        if (stepNameInput) stepNameInput.value = this.newStep.stepName;
                        if (orderInput) orderInput.value = this.stepCount;
                    }
                }, 100);
            }
            
            this.closeAddStepModal();
            
            // Reload the page to see changes (temporary until full AJAX implementation)
            alert('Step added! Save the form to see the new step.\n\n(In future versions, this will update instantly)');
        }
    };
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Sortable for selected fields in modal
    const selectedFieldsList = document.getElementById('selected-fields-list');
    if (selectedFieldsList && typeof Sortable !== 'undefined') {
        new Sortable(selectedFieldsList, {
            animation: 150,
            handle: '.drag-handle',
            ghostClass: 'sortable-ghost'
        });
    }
});
