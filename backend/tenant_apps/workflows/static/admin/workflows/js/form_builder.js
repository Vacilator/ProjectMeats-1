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
        showFieldConfigModal: false,
        showTemplatesModal: false,
        
        // Field editor state
        currentStepId: null,
        currentStepName: '',
        selectedFields: [],
        availableFields: [],
        filteredAvailableFields: [],
        fieldSearch: '',
        
        // Field templates state
        fieldTemplates: [],
        templatesLoading: false,
        selectedTemplate: null,
        templateFields: [],
        
        // Field config state (Phase 3)
        fieldConfig: {
            fieldId: null,
            fieldKey: '',
            customLabel: '',
            customHelpText: '',
            isRequired: false,
            defaultValue: null,
            autoPopulate: {
                sourceStep: null,
                sourceField: '',
                mode: ''
            },
            availableSourceSteps: [],
            suggestions: [],
            loading: false,
            saving: false
        },
        
        // Rule builder state
        formRules: [],
        rulesLoading: false,
        editingRuleId: null,
        ruleForm: {
            name: '',
            conditionStep: '',
            conditionField: '',
            conditionOperator: 'eq',
            conditionValue: '',
            conditionLogic: 'and',
            actionType: 'display_fields',
            actionStep: '',
            actionTargetFields: [],
            actionTargetSteps: [],
            fieldValues: {}  // For set_value action: { fieldKey: 'value', ... }
        },
        conditionFields: [],
        actionFields: [],
        ruleSaving: false,
        
        // Preview state (Phase 5)
        previewData: {
            loading: false,
            steps: [],
            currentStep: 0
        },
        
        // Add step state
        newStep: {
            entityType: '',
            stepName: ''
        },
        
        // Field Mappings state
        fieldMappings: [],
        mappingsLoading: false,
        autoMapSuggestions: [],
        autoMapLoading: false,
        showMappingModal: false,
        showManualMappingModal: false,
        editingMapping: null,
        manualMapping: {
            targetStep: '',
            targetField: '',
            sourceStep: '',
            sourceField: '',
            mode: 'copy',
            targetStepFields: [],
            sourceStepFields: [],
            saving: false
        },
        
        // Initialization
        init() {
            this.loadFormSteps();
            this.initSortable();
            this.loadFormRules();
            this.loadFieldMappings();
            
            // Add keyboard event listener
            document.addEventListener('keydown', (e) => this.handleKeyboard(e));
            
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
            
            // Save via AJAX
            await this.saveStepOrder(newOrder);
            
            console.log('Steps reordered:', newOrder);
        },
        
        async saveStepOrder(newOrder) {
            // Get form ID from URL
            const pathParts = window.location.pathname.split('/');
            const formIdIndex = pathParts.findIndex(p => p === 'tenantform') + 1;
            const formId = pathParts[formIdIndex];
            
            if (!formId || formId === 'add') {
                console.log('New form - order will be saved with form submission');
                return;
            }
            
            try {
                const response = await fetch(`/api/v1/workflows/admin/forms/${formId}/reorder/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCsrfToken(),
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({ step_order: newOrder.map(s => s.id) })
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const result = await response.json();
                console.log('Step order saved:', result);
                
                // Show success notification
                this.showNotification('✅ Step order saved', 'success');
            } catch (error) {
                console.error('Error saving step order:', error);
                this.showNotification('❌ Failed to save step order', 'error');
            }
        },
        
        // Show notification toast
        showNotification(message, type = 'info') {
            // Create notification element if it doesn't exist
            let notification = document.getElementById('form-builder-notification');
            if (!notification) {
                notification = document.createElement('div');
                notification.id = 'form-builder-notification';
                notification.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 12px 20px;
                    border-radius: 4px;
                    z-index: 10000;
                    font-weight: 500;
                    transition: opacity 0.3s;
                `;
                document.body.appendChild(notification);
            }
            
            // Set colors based on type
            const colors = {
                success: { bg: '#d4edda', border: '#c3e6cb', text: '#155724' },
                error: { bg: '#f8d7da', border: '#f5c6cb', text: '#721c24' },
                info: { bg: '#d1ecf1', border: '#bee5eb', text: '#0c5460' }
            };
            const color = colors[type] || colors.info;
            
            notification.style.backgroundColor = color.bg;
            notification.style.border = `1px solid ${color.border}`;
            notification.style.color = color.text;
            notification.textContent = message;
            notification.style.opacity = '1';
            notification.style.display = 'block';
            
            // Auto-hide after 3 seconds
            setTimeout(() => {
                notification.style.opacity = '0';
                setTimeout(() => {
                    notification.style.display = 'none';
                }, 300);
            }, 3000);
        },
        
        // Update Django inline form order fields
        updateInlineOrder(newOrder) {
            // Find the inline formset in the hidden container
            const inlineContainer = document.querySelector('.original-inlines');
            if (!inlineContainer) {
                console.warn('Could not find .original-inlines container');
                return;
            }
            
            newOrder.forEach(item => {
                // Find the inline form by looking for hidden input with this step's ID
                // Django generates inputs like: entities-0-id, entities-0-order, etc.
                const idInput = inlineContainer.querySelector(`input[name$="-id"][value="${item.id}"]`);
                if (idInput) {
                    // Extract the form prefix (e.g., "entities-0")
                    const name = idInput.getAttribute('name');
                    const prefix = name.replace(/-id$/, '');
                    
                    // Find and update the order field for this form
                    const orderInput = inlineContainer.querySelector(`input[name="${prefix}-order"]`);
                    if (orderInput) {
                        orderInput.value = item.order;
                        console.log(`Updated ${prefix}-order to ${item.order}`);
                    } else {
                        console.warn(`Could not find order input for ${prefix}`);
                    }
                }
            });
        },
        
        // ==================== FORM PREVIEW ====================
        
        async openPreview() {
            this.previewData.loading = true;
            this.previewData.currentStep = 0;
            this.showPreviewModal = true;
            
            // Load preview data for all steps
            await this.loadPreviewData();
        },
        
        async loadPreviewData() {
            this.previewData.steps = [];
            
            for (const step of this.formSteps) {
                try {
                    // Get fields for this step
                    const response = await fetch(`/api/v1/workflows/admin/steps/${step.id}/fields/`, {
                        method: 'GET',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'same-origin'
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        // API returns selected_fields (already saved fields) and available_fields
                        const selectedFields = data.selected_fields || [];
                        
                        // Get auto-populate info for each field
                        const fieldsWithConfig = await Promise.all(
                            selectedFields.map(async (field) => {
                                if (field.id) {
                                    try {
                                        const configRes = await fetch(`/api/v1/workflows/admin/fields/${field.id}/config/`, {
                                            method: 'GET',
                                            headers: { 'Content-Type': 'application/json' },
                                            credentials: 'same-origin'
                                        });
                                        if (configRes.ok) {
                                            const config = await configRes.json();
                                            return { ...field, config };
                                        }
                                    } catch (e) { /* ignore */ }
                                }
                                return field;
                            })
                        );
                        
                        this.previewData.steps.push({
                            id: step.id,
                            name: step.name,
                            entityType: step.entityType,
                            order: step.order,
                            fields: fieldsWithConfig
                        });
                    }
                } catch (error) {
                    console.error('Error loading preview for step:', step.id, error);
                }
            }
            
            this.previewData.loading = false;
        },
        
        closePreview() {
            this.showPreviewModal = false;
        },
        
        nextPreviewStep() {
            if (this.previewData.currentStep < this.previewData.steps.length - 1) {
                this.previewData.currentStep++;
            }
        },
        
        prevPreviewStep() {
            if (this.previewData.currentStep > 0) {
                this.previewData.currentStep--;
            }
        },
        
        get currentPreviewStep() {
            return this.previewData.steps[this.previewData.currentStep] || null;
        },
        
        getFieldTypeIcon(type) {
            const icons = {
                'text': '📝',
                'email': '📧',
                'phone': '📞',
                'url': '🔗',
                'number': '🔢',
                'decimal': '💰',
                'integer': '🔢',
                'boolean': '☑️',
                'date': '📅',
                'datetime': '📅',
                'time': '🕐',
                'textarea': '📄',
                'select': '📋',
                'foreignkey': '🔗',
                'file': '📎',
                'image': '🖼️'
            };
            return icons[type] || '📝';
        },
        
        getRulesForField(stepId, fieldKey) {
            return this.formRules.filter(rule => {
                // Check if any action targets this field
                return rule.actions?.some(action => {
                    const fields = action.params?.fields || [];
                    return fields.some(f => f.includes(fieldKey));
                });
            });
        },
        
        // Test data fill functionality
        async fillWithTestData() {
            const formId = this.formId;
            if (!formId) {
                console.error('No form ID available');
                return;
            }
            
            try {
                const response = await fetch(`/api/v1/workflows/forms/${formId}/test-data/`, {
                    method: 'GET',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCsrfToken()
                    },
                    credentials: 'same-origin'
                });
                
                if (response.ok) {
                    const data = await response.json();
                    const testData = data.test_data || {};
                    
                    // Fill preview fields with test data
                    this.previewData.steps.forEach(step => {
                        const stepData = testData[step.id] || {};
                        step.fields.forEach(field => {
                            if (stepData[field.key] !== undefined) {
                                field.testValue = stepData[field.key];
                                // Also update any input elements if they exist
                                const input = document.querySelector(`[data-field-key="${field.key}"]`);
                                if (input) {
                                    input.value = stepData[field.key];
                                }
                            }
                        });
                    });
                    
                    console.log('Filled with test data:', testData);
                } else {
                    console.error('Failed to fetch test data');
                }
            } catch (error) {
                console.error('Error fetching test data:', error);
            }
        },
        
        clearPreviewData() {
            this.previewData.steps.forEach(step => {
                step.fields.forEach(field => {
                    field.testValue = null;
                    const input = document.querySelector(`[data-field-key="${field.key}"]`);
                    if (input) {
                        input.value = '';
                    }
                });
            });
        },
        
        // ==================== FIELD EDITOR ====================
        
        async openFieldEditor(stepId) {
            this.currentStepId = stepId;
            const step = this.formSteps.find(s => s.id === stepId);
            this.currentStepName = step ? step.name : 'Unknown Step';
            
            // Load fields from API
            await this.loadFieldsFromAPI(stepId);
            
            this.showFieldModal = true;
        },
        
        closeFieldModal() {
            this.showFieldModal = false;
            this.currentStepId = null;
            this.fieldSearch = '';
        },
        
        async loadFieldsFromAPI(stepId) {
            try {
                const response = await fetch(`/api/v1/workflows/admin/steps/${stepId}/fields/`, {
                    headers: {
                        'X-CSRFToken': getCsrfToken(),
                    },
                    credentials: 'same-origin'
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                
                this.selectedFields = data.selected_fields || [];
                // Filter out already selected fields from available list
                this.availableFields = (data.available_fields || []).filter(f => !f.selected);
                this.filteredAvailableFields = [...this.availableFields];
                this.currentStepName = data.step_name;
                
                console.log('Loaded fields:', {
                    selected: this.selectedFields.length,
                    available: this.availableFields.length
                });
            } catch (error) {
                console.error('Error loading fields:', error);
                // Fallback to showing empty state
                this.selectedFields = [];
                this.availableFields = [];
                this.filteredAvailableFields = [];
            }
        },
        
        // Fallback for when API is not available (during development)
        loadFieldsForEntity(entityType) {
            // Entity field definitions (fallback - will be fetched from API in production)
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
                inquiry: [
                    { key: 'inquiry_number', label: 'Inquiry Number', type: 'text', required: false },
                    { key: 'status', label: 'Status', type: 'dropdown', required: true },
                    { key: 'source_type', label: 'Source Type', type: 'dropdown', required: false },
                    { key: 'entity_type', label: 'Entity Type', type: 'dropdown', required: true },
                    { key: 'supplier_id', label: 'Supplier', type: 'reference', required: false },
                    { key: 'customer_id', label: 'Customer', type: 'reference', required: false },
                    { key: 'contact_id', label: 'Contact', type: 'reference', required: false },
                    { key: 'product_id', label: 'Product', type: 'reference', required: false },
                    { key: 'protein_type', label: 'Protein Type', type: 'dropdown', required: false },
                    { key: 'quantity', label: 'Quantity', type: 'decimal', required: false },
                    { key: 'unit_of_measure', label: 'Unit of Measure', type: 'dropdown', required: false },
                    { key: 'desired_price', label: 'Desired Price', type: 'currency', required: false },
                    { key: 'desired_delivery_date', label: 'Desired Delivery Date', type: 'date', required: false },
                    { key: 'notes', label: 'Notes', type: 'textarea', required: false },
                ],
                fulfillment: [
                    { key: 'fulfillment_number', label: 'Fulfillment Number', type: 'text', required: false },
                    { key: 'inquiry_id', label: 'Inquiry', type: 'reference', required: true },
                    { key: 'status', label: 'Status', type: 'dropdown', required: true },
                    { key: 'supplier_id', label: 'Supplier', type: 'reference', required: false },
                    { key: 'customer_id', label: 'Customer', type: 'reference', required: false },
                    { key: 'carrier_id', label: 'Carrier', type: 'reference', required: false },
                    { key: 'quantity_fulfilled', label: 'Quantity Fulfilled', type: 'decimal', required: false },
                    { key: 'unit_of_measure', label: 'Unit of Measure', type: 'dropdown', required: false },
                    { key: 'actual_price', label: 'Actual Price', type: 'currency', required: false },
                    { key: 'ship_date', label: 'Ship Date', type: 'date', required: false },
                    { key: 'delivery_date', label: 'Delivery Date', type: 'date', required: false },
                    { key: 'tracking_numbers', label: 'Tracking Numbers', type: 'text', required: false },
                    { key: 'notes', label: 'Notes', type: 'textarea', required: false },
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
                // Remove from selected - first get the field data
                const field = this.selectedFields.find(f => f.key === fieldKey);
                this.selectedFields = this.selectedFields.filter(f => f.key !== fieldKey);
                // Add back to available
                if (field && !this.availableFields.some(f => f.key === fieldKey)) {
                    this.availableFields.push({ ...field });
                    // Sort available fields by label
                    this.availableFields.sort((a, b) => a.label.localeCompare(b.label));
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
        
        // ==================== FIELD CONFIGURATION (Phase 3) ====================
        
        async configureField(fieldKey) {
            // Find the field in selected fields to get its ID
            const field = this.selectedFields.find(f => f.key === fieldKey);
            if (!field || !field.id) {
                // Field hasn't been saved yet - need to save first
                this.showNotification('Please save field selection first before configuring.', 'info');
                return;
            }
            
            this.fieldConfig.loading = true;
            this.fieldConfig.fieldId = field.id;
            this.fieldConfig.fieldKey = fieldKey;
            this.showFieldConfigModal = true;
            
            try {
                const response = await fetch(`/api/v1/workflows/admin/fields/${field.id}/config/`, {
                    headers: {
                        'X-CSRFToken': getCsrfToken(),
                    },
                    credentials: 'same-origin'
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                
                // Populate field config state
                this.fieldConfig.customLabel = data.custom_label || '';
                this.fieldConfig.customHelpText = data.custom_help_text || '';
                this.fieldConfig.isRequired = data.is_required || false;
                this.fieldConfig.defaultValue = data.default_value;
                this.fieldConfig.autoPopulate = {
                    sourceStep: data.auto_populate?.source_step || '',
                    sourceField: data.auto_populate?.source_field || '',
                    mode: data.auto_populate?.mode || ''
                };
                this.fieldConfig.availableSourceSteps = data.available_source_steps || [];
                this.fieldConfig.suggestions = data.suggestions || [];
                
                console.log('Loaded field config:', this.fieldConfig);
                
            } catch (error) {
                console.error('Error loading field config:', error);
                this.showNotification('Error loading field configuration.', 'error');
                this.showFieldConfigModal = false;
            } finally {
                this.fieldConfig.loading = false;
            }
        },
        
        closeFieldConfigModal() {
            this.showFieldConfigModal = false;
            this.fieldConfig.fieldId = null;
            this.fieldConfig.fieldKey = '';
            this.fieldConfig.suggestions = [];
        },
        
        getSourceStepFields() {
            // Get fields for the currently selected source step
            if (!this.fieldConfig.autoPopulate.sourceStep) {
                return [];
            }
            const step = this.fieldConfig.availableSourceSteps.find(
                s => s.id === this.fieldConfig.autoPopulate.sourceStep
            );
            return step ? step.fields : [];
        },
        
        applySuggestion(suggestion) {
            // Apply a smart match suggestion
            this.fieldConfig.autoPopulate.sourceStep = suggestion.source_step_id;
            this.fieldConfig.autoPopulate.sourceField = suggestion.source_field_key;
            this.fieldConfig.autoPopulate.mode = 'copy'; // Default to copy
            
            this.showNotification(`Applied suggestion: ${suggestion.source_field_label} from ${suggestion.source_step_name}`, 'success');
        },
        
        async saveFieldConfig() {
            if (!this.fieldConfig.fieldId) {
                return;
            }
            
            this.fieldConfig.saving = true;
            
            try {
                const response = await fetch(`/api/v1/workflows/admin/fields/${this.fieldConfig.fieldId}/config/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCsrfToken(),
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                        custom_label: this.fieldConfig.customLabel,
                        custom_help_text: this.fieldConfig.customHelpText,
                        is_required: this.fieldConfig.isRequired,
                        default_value: this.fieldConfig.defaultValue,
                        auto_populate: {
                            source_step: this.fieldConfig.autoPopulate.sourceStep || null,
                            source_field: this.fieldConfig.autoPopulate.sourceField || '',
                            mode: this.fieldConfig.autoPopulate.mode || ''
                        }
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const result = await response.json();
                console.log('Saved field config:', result);
                
                // Update the field in selectedFields array
                const fieldIndex = this.selectedFields.findIndex(f => f.id === this.fieldConfig.fieldId);
                if (fieldIndex !== -1) {
                    this.selectedFields[fieldIndex].custom_label = this.fieldConfig.customLabel;
                    this.selectedFields[fieldIndex].required = this.fieldConfig.isRequired;
                    // Add visual indicator for auto-populate
                    this.selectedFields[fieldIndex].hasAutoPopulate = !!(
                        this.fieldConfig.autoPopulate.sourceStep && 
                        this.fieldConfig.autoPopulate.sourceField
                    );
                }
                
                this.closeFieldConfigModal();
                this.showNotification('Field configuration saved!', 'success');
                
            } catch (error) {
                console.error('Error saving field config:', error);
                this.showNotification('Error saving field configuration.', 'error');
            } finally {
                this.fieldConfig.saving = false;
            }
        },
        
        // ==================== FIELD SELECTION SAVE ====================
        
        fieldsSaving: false,
        
        async saveFieldSelection() {
            if (!this.currentStepId) {
                this.showNotification('No step selected.', 'error');
                return;
            }
            
            if (this.selectedFields.length === 0) {
                if (!confirm('No fields selected. This will remove all fields from this step. Continue?')) {
                    return;
                }
            }
            
            this.fieldsSaving = true;
            
            try {
                // Prepare field data - include type for proper storage
                const fieldsData = this.selectedFields.map((f, index) => ({
                    key: f.key,
                    type: f.type || 'text',  // Include field type
                    visible: true,
                    required: f.required || false,
                    custom_label: '',
                    help_text: '',
                }));
                
                const response = await fetch(`/api/v1/workflows/admin/steps/${this.currentStepId}/fields/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCsrfToken(),
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({ fields: fieldsData })
                });
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
                }
                
                const result = await response.json();
                console.log('Saved field selection:', result);
                
                // Update the step card to show new field count
                const stepCard = document.querySelector(`.step-card[data-step-id="${this.currentStepId}"]`);
                if (stepCard) {
                    const fieldCountEl = stepCard.querySelector('.stat strong');
                    if (fieldCountEl) {
                        fieldCountEl.textContent = this.selectedFields.length;
                    }
                }
                
                // Close modal
                this.closeFieldModal();
                
                // Show success feedback
                this.showNotification(`${this.selectedFields.length} field(s) saved successfully!`, 'success');
                
            } catch (error) {
                console.error('Error saving fields:', error);
                this.showNotification(`Error saving fields: ${error.message}`, 'error');
            } finally {
                this.fieldsSaving = false;
            }
        },
        
        showNotification(message, type = 'info') {
            // Create enhanced notification with icon
            const container = document.querySelector('.messagelist') || this.createMessageList();
            const li = document.createElement('li');
            li.className = type === 'error' ? 'error' : 'success';
            
            // Add icon based on type
            const icons = {
                'success': '✓',
                'error': '✕',
                'info': 'ℹ️',
                'warning': '⚠️'
            };
            
            li.innerHTML = `<span class="notification-icon">${icons[type] || icons.info}</span> ${message}`;
            container.appendChild(li);
            
            // Scroll notification into view
            li.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            
            // Auto-remove with fade
            setTimeout(() => {
                li.style.opacity = '0';
                li.style.transition = 'opacity 0.3s';
                setTimeout(() => li.remove(), 300);
            }, 4700);
        },
        
        createMessageList() {
            const container = document.createElement('ul');
            container.className = 'messagelist';
            const content = document.querySelector('#content') || document.body;
            content.insertBefore(container, content.firstChild);
            return container;
        },
        
        // ==================== KEYBOARD SHORTCUTS ====================
        
        handleKeyboard(event) {
            // Escape key closes any open modal
            if (event.key === 'Escape') {
                if (this.showFieldModal) this.closeFieldModal();
                if (this.showRuleModal) this.closeRuleModal();
                if (this.showPreviewModal) this.closePreview();
                if (this.showFieldConfigModal) this.closeFieldConfigModal();
                if (this.showAddStepModal) this.closeAddStepModal();
            }
            
            // Ctrl+P to open preview (when not in an input)
            if (event.ctrlKey && event.key === 'p' && !this.isInputFocused()) {
                event.preventDefault();
                this.openPreview();
            }
        },
        
        isInputFocused() {
            const active = document.activeElement;
            return active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT');
        },
        
        // ==================== RULE EDITOR ====================
        
        getFormId() {
            // Extract form ID from URL path
            const pathParts = window.location.pathname.split('/');
            const formIdIndex = pathParts.findIndex(p => p === 'tenantform') + 1;
            const formId = pathParts[formIdIndex];
            return (formId && formId !== 'add') ? formId : null;
        },
        
        async loadFormRules() {
            const formId = this.getFormId();
            if (!formId) {
                console.log('New form - no rules to load');
                return;
            }
            
            this.rulesLoading = true;
            try {
                const response = await fetch(`/api/v1/workflows/admin/forms/${formId}/rules/`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'same-origin'
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                this.formRules = data.rules || [];
                
                // Enrich formSteps with fields data if available
                if (data.steps) {
                    data.steps.forEach(stepData => {
                        const step = this.formSteps.find(s => s.id === stepData.id);
                        if (step) {
                            step.fields = stepData.fields || [];
                            step.entityType = stepData.entity_type;
                        }
                    });
                }
                
                console.log('Loaded rules:', this.formRules.length);
                this.updateRuleCountDisplay();
            } catch (error) {
                console.error('Error loading rules:', error);
            } finally {
                this.rulesLoading = false;
            }
        },
        
        updateRuleCountDisplay() {
            // Update step cards with rule count
            const ruleCountEl = document.querySelector('.rules-count');
            if (ruleCountEl) {
                ruleCountEl.textContent = this.formRules.length;
            }
        },
        
        openRuleEditor(stepId) {
            // Pre-select the step for condition
            this.resetRuleForm();
            this.ruleForm.conditionStep = stepId;
            this.loadConditionFields();
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
            this.ruleSaving = false;
        },
        
        resetRuleForm() {
            this.ruleForm = {
                name: '',
                conditionStep: '',
                conditionField: '',
                conditionOperator: 'eq',
                conditionValue: '',
                conditionLogic: 'and',
                actionType: 'display_fields',
                actionStep: '',
                actionTargetFields: [],
                actionTargetSteps: [],
                fieldValues: {}
            };
            this.conditionFields = [];
            this.actionFields = [];
        },
        
        // Helper methods for action type checking
        isFieldAction() {
            return ['display_fields', 'hide_fields', 'set_value'].includes(this.ruleForm.actionType);
        },
        
        isStepAction() {
            return ['display_steps', 'hide_steps'].includes(this.ruleForm.actionType);
        },
        
        onActionTypeChange() {
            // Clear targets when switching between field and step actions
            if (this.isStepAction()) {
                this.ruleForm.actionTargetFields = [];
                this.ruleForm.actionStep = '';
                this.ruleForm.fieldValues = {};
            } else {
                this.ruleForm.actionTargetSteps = [];
            }
            // Clear field values when switching away from set_value
            if (this.ruleForm.actionType !== 'set_value') {
                this.ruleForm.fieldValues = {};
            }
        },
        
        // Initialize field value when checkbox is toggled
        initFieldValue(fieldKey) {
            if (this.ruleForm.actionTargetFields.includes(fieldKey)) {
                // Field was just selected, ensure it has an entry in fieldValues
                if (!(fieldKey in this.ruleForm.fieldValues)) {
                    this.ruleForm.fieldValues[fieldKey] = '';
                }
            } else {
                // Field was deselected, remove its value
                delete this.ruleForm.fieldValues[fieldKey];
            }
        },
        
        // Show preview submit message (since this is just a preview)
        showPreviewSubmitMessage() {
            this.showNotification('This is a preview. In the actual form, this would submit the data.', 'info');
        },
        
        async loadConditionFields() {
            const step = this.formSteps.find(s => s.id === this.ruleForm.conditionStep);
            if (!step) {
                this.conditionFields = [];
                return;
            }
            
            // If step already has fields loaded, use them
            if (step.fields && step.fields.length > 0) {
                this.conditionFields = step.fields;
                return;
            }
            
            // Otherwise fetch from API
            try {
                const response = await fetch(`/api/v1/workflows/admin/entities/${step.entityType}/fields/`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'same-origin'
                });
                
                if (response.ok) {
                    const data = await response.json();
                    this.conditionFields = data.fields || [];
                    step.fields = this.conditionFields; // Cache for later
                }
            } catch (error) {
                console.error('Error loading condition fields:', error);
                this.conditionFields = [];
            }
        },
        
        async loadActionFields() {
            const step = this.formSteps.find(s => s.id === this.ruleForm.actionStep);
            if (!step) {
                this.actionFields = [];
                return;
            }
            
            // If step already has fields loaded, use them
            if (step.fields && step.fields.length > 0) {
                this.actionFields = step.fields;
                return;
            }
            
            // Otherwise fetch from API
            try {
                const response = await fetch(`/api/v1/workflows/admin/entities/${step.entityType}/fields/`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'same-origin'
                });
                
                if (response.ok) {
                    const data = await response.json();
                    this.actionFields = data.fields || [];
                    step.fields = this.actionFields; // Cache for later
                }
            } catch (error) {
                console.error('Error loading action fields:', error);
                this.actionFields = [];
            }
        },
        
        async editRule(ruleId) {
            const rule = this.formRules.find(r => r.id === ruleId);
            if (!rule) {
                console.error('Rule not found:', ruleId);
                return;
            }
            
            this.editingRuleId = ruleId;
            
            // Parse conditions
            const condition = rule.conditions?.[0] || {};
            const fieldParts = (condition.field || '').split('.');
            
            // Parse actions
            const action = rule.actions?.[0] || {};
            const actionType = action.action || 'display_fields';
            
            // Determine if this is a field action or step action
            const isStepActionType = ['display_steps', 'hide_steps'].includes(actionType);
            
            let actionStep = '';
            let actionTargetFields = [];
            let actionTargetSteps = [];
            let fieldValues = {};
            
            if (isStepActionType) {
                // Step-based action
                actionTargetSteps = action.params?.steps || [];
            } else {
                // Field-based action
                const actionFieldParts = (action.params?.fields?.[0] || '').split('.');
                actionStep = actionFieldParts[0] || '';
                actionTargetFields = (action.params?.fields || []).map(f => f.split('.')[1]).filter(Boolean);
                
                // Load field values if this is a set_value action
                if (actionType === 'set_value' && action.params?.values) {
                    fieldValues = action.params.values;
                }
            }
            
            this.ruleForm = {
                name: rule.name || '',
                conditionStep: fieldParts[0] || '',
                conditionField: fieldParts[1] || '',
                conditionOperator: condition.operator || 'eq',
                conditionValue: condition.value || '',
                conditionLogic: rule.condition_logic || 'and',
                actionType: actionType,
                actionStep: actionStep,
                actionTargetFields: actionTargetFields,
                actionTargetSteps: actionTargetSteps,
                fieldValues: fieldValues
            };
            
            // Load fields for the selected steps
            await this.loadConditionFields();
            if (!isStepActionType) {
                await this.loadActionFields();
            }
            
            this.showRuleModal = true;
        },
        
        async deleteRule(ruleId) {
            if (!confirm('Are you sure you want to delete this rule?')) {
                return;
            }
            
            try {
                const response = await fetch(`/api/v1/workflows/admin/rules/${ruleId}/`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCsrfToken(),
                    },
                    credentials: 'same-origin'
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                // Remove from local state
                this.formRules = this.formRules.filter(r => r.id !== ruleId);
                this.updateRuleCountDisplay();
                this.showNotification('Rule deleted successfully!', 'success');
            } catch (error) {
                console.error('Error deleting rule:', error);
                this.showNotification('Error deleting rule. Please try again.', 'error');
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
                'display_fields': 'show fields',
                'hide_fields': 'hide fields',
                'set_value': 'set values for',
                'display_steps': 'show steps',
                'hide_steps': 'hide steps'
            };
            
            let preview = `When ${this.ruleForm.conditionField} in ${stepName} ${operators[this.ruleForm.conditionOperator] || 'equals'}`;
            
            if (!['is_empty', 'is_not_empty'].includes(this.ruleForm.conditionOperator)) {
                preview += ` "${this.ruleForm.conditionValue}"`;
            }
            
            preview += `, then ${actions[this.ruleForm.actionType] || 'show'}`;
            
            // Handle set_value action with field-value pairs
            if (this.ruleForm.actionType === 'set_value') {
                if (this.ruleForm.actionTargetFields.length > 0) {
                    const fieldValuePairs = this.ruleForm.actionTargetFields.map(f => {
                        const value = this.ruleForm.fieldValues[f] || '(no value)';
                        return `${f}="${value}"`;
                    });
                    preview += `: ${fieldValuePairs.join(', ')}`;
                } else {
                    preview += ' [select target fields]';
                }
            }
            // Handle other field-based actions
            else if (this.isFieldAction()) {
                if (this.ruleForm.actionTargetFields.length > 0) {
                    preview += `: ${this.ruleForm.actionTargetFields.join(', ')}`;
                } else {
                    preview += ' [select target fields]';
                }
            }
            // Handle step-based actions
            else if (this.isStepAction()) {
                if (this.ruleForm.actionTargetSteps.length > 0) {
                    const stepNames = this.ruleForm.actionTargetSteps.map(stepId => {
                        const s = this.formSteps.find(fs => fs.id === stepId);
                        return s ? `Step ${s.order + 1}: ${s.name}` : stepId;
                    });
                    preview += `: ${stepNames.join(', ')}`;
                } else {
                    preview += ' [select target steps]';
                }
            }
            
            return preview;
        },
        
        async saveRule() {
            // Validate condition
            if (!this.ruleForm.conditionStep || !this.ruleForm.conditionField) {
                this.showNotification('Please select a condition step and field.', 'error');
                return;
            }
            
            // Validate action targets based on action type
            if (this.ruleForm.actionType === 'set_value') {
                if (!this.ruleForm.actionStep || this.ruleForm.actionTargetFields.length === 0) {
                    this.showNotification('Please select an action step and at least one field to set.', 'error');
                    return;
                }
                // Check that all selected fields have values
                for (const fieldKey of this.ruleForm.actionTargetFields) {
                    if (!this.ruleForm.fieldValues[fieldKey]) {
                        this.showNotification(`Please enter a value for field "${fieldKey}".`, 'error');
                        return;
                    }
                }
            } else if (this.isFieldAction()) {
                if (!this.ruleForm.actionStep || this.ruleForm.actionTargetFields.length === 0) {
                    this.showNotification('Please select an action step and target fields.', 'error');
                    return;
                }
            } else if (this.isStepAction()) {
                if (this.ruleForm.actionTargetSteps.length === 0) {
                    this.showNotification('Please select at least one target step.', 'error');
                    return;
                }
            }
            
            const formId = this.getFormId();
            if (!formId) {
                this.showNotification('Please save the form first before adding rules.', 'error');
                return;
            }
            
            this.ruleSaving = true;
            
            try {
                // Build the conditions array
                const conditions = [{
                    field: `${this.ruleForm.conditionStep}.${this.ruleForm.conditionField}`,
                    operator: this.ruleForm.conditionOperator,
                    value: this.ruleForm.conditionValue
                }];
                
                // Build the actions array based on action type
                let actionParams = {};
                if (this.ruleForm.actionType === 'set_value') {
                    // For set_value, include field-value pairs
                    actionParams = {
                        fields: this.ruleForm.actionTargetFields.map(f => `${this.ruleForm.actionStep}.${f}`),
                        values: {}
                    };
                    // Add values for each selected field
                    for (const fieldKey of this.ruleForm.actionTargetFields) {
                        actionParams.values[fieldKey] = this.ruleForm.fieldValues[fieldKey] || '';
                    }
                } else if (this.isFieldAction()) {
                    actionParams = {
                        fields: this.ruleForm.actionTargetFields.map(f => `${this.ruleForm.actionStep}.${f}`)
                    };
                } else if (this.isStepAction()) {
                    actionParams = {
                        steps: this.ruleForm.actionTargetSteps
                    };
                }
                
                const actions = [{
                    action: this.ruleForm.actionType,
                    params: actionParams
                }];
                
                const payload = {
                    name: this.ruleForm.name || this.rulePreviewText,
                    conditions: conditions,
                    condition_logic: this.ruleForm.conditionLogic,
                    actions: actions,
                    is_active: true
                };
                
                let url, method;
                if (this.editingRuleId) {
                    url = `/api/v1/workflows/admin/rules/${this.editingRuleId}/`;
                    method = 'PUT';
                } else {
                    url = `/api/v1/workflows/admin/forms/${formId}/rules/`;
                    method = 'POST';
                }
                
                const response = await fetch(url, {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCsrfToken(),
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify(payload)
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const result = await response.json();
                console.log('Rule saved:', result);
                
                // Reload rules to get updated list
                await this.loadFormRules();
                
                this.closeRuleModal();
                this.showNotification(`Rule ${this.editingRuleId ? 'updated' : 'created'} successfully!`, 'success');
            } catch (error) {
                console.error('Error saving rule:', error);
                this.showNotification('Error saving rule. Please try again.', 'error');
            } finally {
                this.ruleSaving = false;
            }
        },
        
        // ==================== ADD STEP ====================
        
        openAddStepModal() {
            this.newStep = { entityType: '', stepName: '', saving: false };
            this.showAddStepModal = true;
        },
        
        closeAddStepModal() {
            this.showAddStepModal = false;
        },
        
        async addStep() {
            if (!this.newStep.entityType) {
                this.showNotification('Please select an entity type', 'error');
                return;
            }
            
            const formId = this.getFormId();
            if (!formId) {
                this.showNotification('Could not determine form ID', 'error');
                return;
            }
            
            this.newStep.saving = true;
            
            try {
                const response = await fetch(`/api/v1/workflows/admin/forms/${formId}/steps/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCsrfToken()
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                        entity_type: this.newStep.entityType,
                        step_name: this.newStep.stepName || ''
                    })
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to add step');
                }
                
                const data = await response.json();
                console.log('Step created:', data);
                
                this.closeAddStepModal();
                this.showNotification(`Step "${data.step.entity_type}" added successfully!`, 'success');
                
                // Reload the page to show the new step card
                // (Django admin needs full reload to render the new inline)
                setTimeout(() => {
                    window.location.reload();
                }, 500);
                
            } catch (error) {
                console.error('Error adding step:', error);
                this.showNotification(error.message || 'Failed to add step', 'error');
            } finally {
                this.newStep.saving = false;
            }
        },
        
        async deleteStep(stepId) {
            if (!confirm('Are you sure you want to delete this step? All field configurations will be lost.')) {
                return;
            }
            
            try {
                const response = await fetch(`/api/v1/workflows/admin/steps/${stepId}/`, {
                    method: 'DELETE',
                    headers: {
                        'X-CSRFToken': getCsrfToken()
                    },
                    credentials: 'same-origin'
                });
                
                if (!response.ok && response.status !== 204) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to delete step');
                }
                
                this.showNotification('Step deleted successfully', 'success');
                
                // Reload to reflect changes
                setTimeout(() => {
                    window.location.reload();
                }, 500);
                
            } catch (error) {
                console.error('Error deleting step:', error);
                this.showNotification(error.message || 'Failed to delete step', 'error');
            }
        },
        
        // ==================== FIELD MAPPINGS ====================
        
        async loadFieldMappings() {
            const formId = this.getFormId();
            if (!formId) {
                console.log('No form ID - skipping mappings load');
                return;
            }
            
            this.mappingsLoading = true;
            
            try {
                const response = await fetch(`/api/v1/workflows/admin/forms/${formId}/mappings/`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin'
                });
                
                if (response.ok) {
                    const data = await response.json();
                    this.fieldMappings = data.mappings || [];
                    console.log('Loaded field mappings:', this.fieldMappings.length);
                } else {
                    console.error('Failed to load mappings:', response.status);
                }
            } catch (error) {
                console.error('Error loading field mappings:', error);
            } finally {
                this.mappingsLoading = false;
            }
        },
        
        async computeAutoMappings() {
            const formId = this.getFormId();
            if (!formId) return;
            
            this.autoMapLoading = true;
            this.autoMapSuggestions = [];
            
            try {
                const response = await fetch(`/api/v1/workflows/admin/forms/${formId}/auto-map/?min_score=50`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin'
                });
                
                if (response.ok) {
                    const data = await response.json();
                    this.autoMapSuggestions = data.suggestions || [];
                    
                    if (this.autoMapSuggestions.length === 0) {
                        this.showNotification('No matching fields found. Try adding more fields with similar names.', 'info');
                    } else {
                        this.showNotification(`Found ${this.autoMapSuggestions.length} potential mapping(s)`, 'success');
                    }
                } else {
                    const errorData = await response.json();
                    this.showNotification(errorData.error || 'Failed to compute mappings', 'error');
                }
            } catch (error) {
                console.error('Error computing auto-mappings:', error);
                this.showNotification('Failed to compute auto-mappings', 'error');
            } finally {
                this.autoMapLoading = false;
            }
        },
        
        async applyAllSuggestions() {
            const formId = this.getFormId();
            if (!formId || this.autoMapSuggestions.length === 0) return;
            
            try {
                const response = await fetch(`/api/v1/workflows/admin/forms/${formId}/auto-map/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCsrfToken()
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({ mappings: this.autoMapSuggestions })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    this.showNotification(`Applied ${data.applied} mapping(s)`, 'success');
                    this.autoMapSuggestions = [];
                    await this.loadFieldMappings();
                } else {
                    const errorData = await response.json();
                    this.showNotification(errorData.error || 'Failed to apply mappings', 'error');
                }
            } catch (error) {
                console.error('Error applying suggestions:', error);
                this.showNotification('Failed to apply mappings', 'error');
            }
        },
        
        async applySingleSuggestion(suggestion) {
            try {
                const response = await fetch(`/api/v1/workflows/admin/fields/${suggestion.target_field_id}/mapping/`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCsrfToken()
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                        source_step_id: suggestion.source_step_id,
                        source_field_key: suggestion.source_field_key,
                        mode: suggestion.mode || 'copy'
                    })
                });
                
                if (response.ok) {
                    // Remove from suggestions
                    const index = this.autoMapSuggestions.findIndex(
                        s => s.target_field_id === suggestion.target_field_id
                    );
                    if (index > -1) {
                        this.autoMapSuggestions.splice(index, 1);
                    }
                    await this.loadFieldMappings();
                    this.showNotification('Mapping applied', 'success');
                } else {
                    const errorData = await response.json();
                    this.showNotification(errorData.error || 'Failed to apply mapping', 'error');
                }
            } catch (error) {
                console.error('Error applying single suggestion:', error);
                this.showNotification('Failed to apply mapping', 'error');
            }
        },
        
        dismissSuggestion(index) {
            this.autoMapSuggestions.splice(index, 1);
        },
        
        clearSuggestions() {
            this.autoMapSuggestions = [];
        },
        
        editMapping(mapping) {
            // Open the manual mapping modal pre-filled with existing mapping data
            this.editingMapping = mapping;
            this.manualMapping.targetStep = mapping.target_step_id;
            this.manualMapping.targetField = mapping.target_field_id;
            this.manualMapping.sourceStep = mapping.source_step_id;
            this.manualMapping.sourceField = mapping.source_field_key;
            this.manualMapping.mode = mapping.mode || 'copy';
            
            // Load fields for the selected steps
            this.loadTargetFieldsForStep(mapping.target_step_id);
            this.loadSourceFieldsForStep(mapping.source_step_id);
            
            this.showManualMappingModal = true;
        },
        
        openManualMappingModal() {
            // Reset the manual mapping state for a new mapping
            this.editingMapping = null;
            this.manualMapping.targetStep = '';
            this.manualMapping.targetField = '';
            this.manualMapping.sourceStep = '';
            this.manualMapping.sourceField = '';
            this.manualMapping.mode = 'copy';
            this.manualMapping.targetStepFields = [];
            this.manualMapping.sourceStepFields = [];
            
            this.showManualMappingModal = true;
        },
        
        closeManualMappingModal() {
            this.showManualMappingModal = false;
            this.editingMapping = null;
        },
        
        async loadTargetFieldsForStep(stepId) {
            if (!stepId) {
                this.manualMapping.targetStepFields = [];
                return;
            }
            
            try {
                const response = await fetch(`/api/v1/workflows/admin/steps/${stepId}/fields/`, {
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin'
                });
                
                if (response.ok) {
                    const data = await response.json();
                    this.manualMapping.targetStepFields = data.fields || [];
                }
            } catch (error) {
                console.error('Error loading target fields:', error);
            }
        },
        
        async loadSourceFieldsForStep(stepId) {
            if (!stepId) {
                this.manualMapping.sourceStepFields = [];
                return;
            }
            
            try {
                const response = await fetch(`/api/v1/workflows/admin/steps/${stepId}/fields/`, {
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin'
                });
                
                if (response.ok) {
                    const data = await response.json();
                    this.manualMapping.sourceStepFields = data.fields || [];
                }
            } catch (error) {
                console.error('Error loading source fields:', error);
            }
        },
        
        getTargetStepsForMapping() {
            // Return steps that can receive mappings (steps after the first one)
            return this.formSteps.filter((step, index) => index > 0);
        },
        
        getSourceStepsForMapping(targetStepId) {
            // Return steps that can be sources (steps before the target step)
            if (!targetStepId) return [];
            const targetIndex = this.formSteps.findIndex(s => s.id === targetStepId);
            if (targetIndex <= 0) return [];
            return this.formSteps.slice(0, targetIndex);
        },
        
        async saveManualMapping() {
            const { targetField, sourceStep, sourceField, mode } = this.manualMapping;
            
            if (!targetField || !sourceStep || !sourceField) {
                this.showNotification('Please select all fields for the mapping', 'error');
                return;
            }
            
            this.manualMapping.saving = true;
            
            try {
                const response = await fetch(`/api/v1/workflows/admin/fields/${targetField}/mapping/`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCsrfToken()
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                        source_step_id: sourceStep,
                        source_field_key: sourceField,
                        mode: mode
                    })
                });
                
                if (response.ok) {
                    await this.loadFieldMappings();
                    this.showNotification(this.editingMapping ? 'Mapping updated' : 'Mapping created', 'success');
                    this.closeManualMappingModal();
                } else {
                    const errorData = await response.json();
                    this.showNotification(errorData.error || 'Failed to save mapping', 'error');
                }
            } catch (error) {
                console.error('Error saving manual mapping:', error);
                this.showNotification('Failed to save mapping', 'error');
            } finally {
                this.manualMapping.saving = false;
            }
        },
        
        copyMappingToClipboard(mapping) {
            const text = `${mapping.source_step_name}.${mapping.source_field_label} → ${mapping.target_step_name}.${mapping.target_field_label}`;
            navigator.clipboard.writeText(text).then(() => {
                this.showNotification('Mapping copied to clipboard', 'success');
            }).catch(err => {
                console.error('Failed to copy:', err);
                this.showNotification('Failed to copy to clipboard', 'error');
            });
        },
        
        async deleteMapping(fieldId) {
            if (!confirm('Remove this field mapping?')) return;
            
            try {
                const response = await fetch(`/api/v1/workflows/admin/fields/${fieldId}/mapping/`, {
                    method: 'DELETE',
                    headers: {
                        'X-CSRFToken': getCsrfToken()
                    },
                    credentials: 'same-origin'
                });
                
                if (response.ok) {
                    await this.loadFieldMappings();
                    this.showNotification('Mapping removed', 'success');
                } else {
                    const errorData = await response.json();
                    this.showNotification(errorData.error || 'Failed to remove mapping', 'error');
                }
            } catch (error) {
                console.error('Error deleting mapping:', error);
                this.showNotification('Failed to remove mapping', 'error');
            }
        },
        
        // ==================== FIELD TEMPLATES ====================
        
        async openTemplatesModal() {
            this.showTemplatesModal = true;
            this.templatesLoading = true;
            this.selectedTemplate = null;
            this.templateFields = [];
            
            try {
                const response = await fetch('/api/v1/workflows/field-templates/', {
                    headers: {
                        'X-CSRFToken': getCsrfToken(),
                    },
                    credentials: 'same-origin'
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                this.fieldTemplates = await response.json();
            } catch (error) {
                console.error('Error loading field templates:', error);
                this.showNotification('Error loading field templates', 'error');
            } finally {
                this.templatesLoading = false;
            }
        },
        
        async selectTemplate(templateId) {
            this.selectedTemplate = templateId;
            
            try {
                const response = await fetch(`/api/v1/workflows/field-templates/${templateId}/`, {
                    headers: {
                        'X-CSRFToken': getCsrfToken(),
                    },
                    credentials: 'same-origin'
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                this.templateFields = data.fields;
            } catch (error) {
                console.error('Error loading template fields:', error);
                this.showNotification('Error loading template fields', 'error');
            }
        },
        
        addTemplateFields() {
            if (!this.templateFields.length) {
                this.showNotification('No fields to add', 'info');
                return;
            }
            
            let addedCount = 0;
            
            for (const field of this.templateFields) {
                // Check if field key already exists
                const exists = this.selectedFields.some(f => f.key === field.key);
                if (!exists) {
                    this.selectedFields.push({
                        key: field.key,
                        label: field.label,
                        type: field.type,
                        required: field.required || false,
                        placeholder: field.placeholder,
                        help_text: field.help_text,
                        choices: field.choices,
                        validation_rules: field.validation_rules,
                    });
                    addedCount++;
                }
            }
            
            this.showTemplatesModal = false;
            
            if (addedCount > 0) {
                this.showNotification(`Added ${addedCount} field(s) from template`, 'success');
            } else {
                this.showNotification('All template fields already exist', 'info');
            }
        },
        
        closeTemplatesModal() {
            this.showTemplatesModal = false;
            this.selectedTemplate = null;
            this.templateFields = [];
        },
        
        // Helper to get form ID from URL
        getFormId() {
            const pathParts = window.location.pathname.split('/');
            const formIdIndex = pathParts.findIndex(p => p === 'tenantform') + 1;
            const formId = pathParts[formIdIndex];
            return (formId && formId !== 'add') ? formId : null;
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
