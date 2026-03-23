/**
 * Search Diagnostic Utility
 * 
 * Helps diagnose why search isn't returning results.
 * Call from browser console: searchDiagnostic()
 */

import { apiClient } from '../services/apiService';
import { logger } from '@/utils/logger';


export const searchDiagnostic = async (query: string = 'test') => {
  console.group('🔍 Search Diagnostic');
  
  try {
    logger.debug('1. Testing search endpoint...');
    logger.debug('   Query:', query);
    
    const response = await apiClient.get('/search/universal/', {
      params: { q: query, limit: 10 }
    });
    
    logger.debug('2. Response received:', response);
    logger.debug('   Status:', response.status);
    logger.debug('   Data:', response.data);
    
    if (response.data.results) {
      logger.debug('3. Results found:', response.data.results.length);
      logger.debug('   Results by type:', response.data.counts);
      
      if (response.data.results.length === 0) {
        logger.warn('⚠️ No results found. Possible reasons:');
        logger.warn('   - No data in database for current tenant');
        logger.warn('   - Search term too specific');
        logger.warn('   - Tenant context not set properly');
      } else {
        logger.debug('✅ Search working! Sample results:');
        response.data.results.slice(0, 3).forEach((r: any) => {
          logger.debug(`   - ${r.type}: ${r.title}`);
        });
      }
    } else {
      logger.error('❌ Invalid response format:', response.data);
    }
    
  } catch (error: any) {
    logger.error('❌ Search failed:', error);
    logger.error('   Status:', error.response?.status);
    logger.error('   Message:', error.response?.data);
    logger.error('   Full error:', error);
    
    if (error.response?.status === 401) {
      logger.error('   Issue: Not authenticated');
    } else if (error.response?.status === 403) {
      logger.error('   Issue: Missing tenant context or permissions');
    } else if (error.response?.status === 404) {
      logger.error('   Issue: Endpoint not found - check URL');
    }
  }
  
  console.groupEnd();
};

// Make available globally in browser console
if (typeof window !== 'undefined') {
  (window as any).searchDiagnostic = searchDiagnostic;
}
