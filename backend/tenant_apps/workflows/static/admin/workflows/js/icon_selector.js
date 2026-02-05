/**
 * Icon Selector Widget JavaScript
 * Note: Most functionality is inline in the template to ensure it works
 * with dynamically added widgets.
 */

// Re-initialize Lucide icons when needed
function reinitLucideIcons() {
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', reinitLucideIcons);

// Also initialize after any AJAX calls (for inline admin forms)
if (typeof django !== 'undefined' && django.jQuery) {
    django.jQuery(document).on('formset:added', function() {
        setTimeout(reinitLucideIcons, 100);
    });
}
