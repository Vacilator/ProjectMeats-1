import type { components, paths } from './generated/openapi';

export type OpenApiComponents = components;
export type OpenApiPaths = paths;

export type ContractTenantWorkFormsListResponse = components['schemas']['PaginatedTenantWorkFormListList'];
export type ContractTenantWorkFormListItem = components['schemas']['TenantWorkFormList'];
export type ContractTenantWorkFormDetailResponse = components['schemas']['TenantWorkForm'];

export type ContractAiChatRequest = components['schemas']['ChatBotRequestRequest'];
export type ContractAiChatResponse = components['schemas']['ChatBotResponse'];
export type ContractPendingReviewListResponse = components['schemas']['PendingReviewListResponse'];
export type ContractPendingReviewItem = ContractPendingReviewListResponse['pending_reviews'][number];
export type ContractPendingReviewResolveRequest =
  components['schemas']['PendingReviewResolveRequestRequest'];
export type ContractPendingReviewResolveResponse =
  components['schemas']['PendingReviewResolveResponse'];
export type ContractSwarmInvokeRequest = components['schemas']['SwarmInvokeRequestRequest'];
export type ContractSwarmInvokeResponse = components['schemas']['SwarmInvokeResponse'];
