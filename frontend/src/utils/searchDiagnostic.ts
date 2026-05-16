/**
 * Search Diagnostic Utility
 * 
 * Helps diagnose why search isn't returning results.
 * Call from browser console: searchDiagnostic()
 */

import { logger } from '@/utils/logger';
import { searchUniversal } from '@/services/searchService';


export const searchDiagnostic = async (query: string = 'test') => {
  logger.debug('[Search Diagnostic] Starting');
  
  try {
    logger.debug('1. Testing search endpoint...');
    logger.debug('   Query:', query);
    
    const response = await searchUniversal({ query, limit: 10 });
    
    logger.debug('2. Response received:', response);
    
    if (response.results) {
      logger.debug('3. Results found:', response.results.length);
      logger.debug('   Results by type:', response.counts);
      
      if (response.results.length === 0) {
        logger.warn('⚠️ No results found. Possible reasons:');
        logger.warn('   - No data in database for current tenant');
        logger.warn('   - Search term too specific');
        logger.warn('   - Tenant context not set properly');
      } else {
        logger.debug('✅ Search working! Sample results:');
        response.results.slice(0, 3).forEach((r) => {
          logger.debug(`   - ${r.type}: ${r.title}`);
        });
      }
    } else {
      logger.error('❌ Invalid response format:', response);
    }
    
  } catch (error: unknown) {
    const errObj = (error && typeof error === 'object' ? error : {}) as Record<string, unknown>;
    const resp = (errObj.response && typeof errObj.response === 'object' ? errObj.response : {}) as Record<string, unknown>;
    logger.error('❌ Search failed:', error);
    logger.error('   Status:', resp.status);
    logger.error('   Message:', resp.data);
    logger.error('   Full error:', error);
    
    if (resp.status === 401) {
      logger.error('   Issue: Not authenticated');
    } else if (resp.status === 403) {
      logger.error('   Issue: Missing tenant context or permissions');
    } else if (resp.status === 404) {
      logger.error('   Issue: Endpoint not found - check URL');
    }
  }
  
  logger.debug('[Search Diagnostic] Finished');
};

// Make available globally in browser console
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).searchDiagnostic = searchDiagnostic;
}
