# FlowEditor Refactoring Master Plan
**Version:** 1.0  
**Created:** 2026-02-17  
**Status:** Planning Complete - Ready for Execution  
**Estimated Duration:** 7-10 days  
**Files Affected:** 66 files (32,254 lines)

---

## 🎯 EXECUTIVE SUMMARY

The FlowEditor codebase requires comprehensive refactoring to address critical technical debt:

### Current State
- **Total Size**: 32,254 lines across 66 files
- **Largest File**: UnifiedFlowEditor.tsx at 5,954 lines (11x over threshold)
- **Code Duplication**: ~40% (styled components, validation logic, modal patterns)
- **Performance**: Initial render 2,500ms, node selection 150ms
- **Test Coverage**: 15%

### Target State
- **Total Size**: ~20,000 lines (38% reduction)
- **Largest File**: <600 lines (90% reduction)
- **Code Duplication**: <10% (75% reduction)
- **Performance**: Initial render 800ms (68% faster), node selection 30ms (80% faster)
- **Test Coverage**: 80% (5.3x increase)

---

## 🚨 CRITICAL ISSUES IDENTIFIED

### 1. Monolithic UnifiedFlowEditor.tsx (5,954 lines)
**Impact**: 🔴 CRITICAL

**Problems:**
- Contains 4 distinct modes (wizard, expert, visual, debug) in one file
- 40+ styled components defined inline
- 20+ useState hooks causing re-render cascades
- Business logic mixed with UI rendering
- Impossible to test, maintain, or debug individual features

**Solution**: Split into separate mode files (WizardMode.tsx, ExpertMode.tsx, VisualEditor.tsx, NodePalette.tsx) + extract styled components

**Result**: 5,954 lines → 500 lines (91% reduction)

---

### 2. ConfigPanel Duplication (21 files, 13,458 lines)
**Impact**: 🔴 CRITICAL

**Problems:**
- Each panel redefines PanelOverlay, Container, Header, Label, Input, Button
- Same 50-line styled component block found in 12 different files
- Repeated validation logic across 8 panels
- 400+ lines of pure duplication

**Solution**: Create ConfigPanelBase wrapper + shared StyledComponents.ts + merge similar panels

**Result**: 21 panels → 10 panels (52% reduction), eliminates 400+ duplicate lines

---

### 3. State Management Chaos
**Impact**: 🟠 HIGH

**Problems:**
- 12 boolean modal states in UnifiedFlowEditor (formStepModalOpen, formFieldModalOpen, etc.)
- Prop drilling 5 levels deep in some paths
- No centralized state strategy
- No context for shared data

**Solution**: Create FlowEditorContext to manage modals, selected nodes, editor mode

**Result**: Eliminates prop drilling, reduces useState from 20+ to 5

---

### 4. Performance Issues
**Impact**: 🟠 HIGH

**Problems:**
- Zero React.memo() usage on child components
- Inline object creation in render methods
- 40+ styled components recreated on every render
- No useMemo for expensive field calculations
- Long lists not virtualized

**Solution**: Add React.memo to all nodes/panels, extract inline handlers to useCallback, virtualize lists

**Result**: 
- Initial render: 2,500ms → 800ms (68% faster)
- Node selection: 150ms → 30ms (80% faster)
- Config panel open: 200ms → 50ms (75% faster)

---

## 📋 REFACTORING PHASES

### Phase E.1: Foundation (Days 1-2)
**Goal**: Create shared abstractions without breaking existing code

**Tasks:**
- [ ] Create `ConfigPanel/shared/StyledComponents.ts` (eliminates 400+ lines duplication)
- [ ] Create hooks: useModalState, usePanelState, useFieldValidation, useNodeConfig
- [ ] Create FlowEditorContext (centralize state)

**Deliverables**: 6 new files, ~800 lines of shared infrastructure

---

### Phase E.2: Break Up UnifiedFlowEditor (Days 3-4)
**Goal**: Split 5,954-line monolith into manageable components

**Tasks:**
- [ ] Extract WizardMode.tsx (600 lines) - step-by-step form builder
- [ ] Extract ExpertMode.tsx (400 lines) - JSON schema editor
- [ ] Extract VisualEditor.tsx (2,000 lines) - React Flow canvas
- [ ] Extract NodePalette.tsx (400 lines) - draggable node types
- [ ] Extract StyledComponents.ts (300 lines) - all styled definitions
- [ ] Migrate state to FlowEditorContext

**Deliverables**: UnifiedFlowEditor.tsx: 5,954 → 500 lines (91% reduction)

---

### Phase E.3: Consolidate ConfigPanels (Days 5-6)
**Goal**: Reduce 21 panels to 10 with shared base

**Tasks:**
- [ ] Create ConfigPanelBase.tsx (reusable wrapper)
- [ ] Merge EntityFormStepModal + FormStepConfigPanel → FormStepConfig.tsx
- [ ] Merge FormProcessModal + FormProcessConfigPanel → FormProcessConfig.tsx
- [ ] Merge FieldConfigurationPanel + FormFieldConfigPanel → FieldConfig.tsx
- [ ] Extract shared sections: EntitySelector, FieldList, ValidationSection

**Deliverables**: 21 panels → 10 panels (52% reduction)

---

### Phase E.4: Optimize Nodes (Day 7)
**Goal**: Reduce node code, improve performance

**Tasks:**
- [ ] Split BaseNode.tsx (573 lines) into:
  - BaseNode.tsx (200 lines) - core structure
  - NodeControls.tsx (100 lines) - edit/delete/pin
  - NodeStatus.tsx (50 lines) - status badges
  - NodeBadges.tsx (100 lines) - info badges
- [ ] Create types/NodeData.ts (standardize interfaces)
- [ ] Wrap all nodes in React.memo with custom comparison

**Deliverables**: BaseNode: 573 → 200 lines (65% reduction), all nodes memoized

---

### Phase E.5: Performance Optimization (Day 8)
**Goal**: Eliminate unnecessary re-renders

**Tasks:**
- [ ] Add useMemo to field filtering (8 locations)
- [ ] Extract inline handlers to useCallback
- [ ] Virtualize long lists (node palette, field selector, preview panel)
- [ ] Use @tanstack/react-virtual

**Deliverables**: 68% faster initial render, 80% faster node selection

---

### Phase E.6: Organization & Cleanup (Days 9-10)
**Goal**: Clean directory structure, consistent naming

**Tasks:**
- [ ] Restructure directories (modes/, config/, nodes/shared/, hooks/, types/)
- [ ] Rename files for consistency (EntityFormStepModal → FormStepConfig)
- [ ] Create missing index files
- [ ] Add E2E tests for critical paths
- [ ] Update documentation

**Deliverables**: Clean, navigable structure following best practices

---

## 📊 SUCCESS METRICS

### Code Quality
| Metric | Before | Target | Change |
|--------|--------|--------|--------|
| Total Lines | 32,254 | 20,000 | -38% |
| Largest File | 5,954 | 600 | -90% |
| Config Panels | 21 | 10 | -52% |
| Duplication | 40% | 10% | -75% |
| Test Coverage | 15% | 80% | +433% |

### Performance
| Metric | Before | Target | Change |
|--------|--------|--------|--------|
| Initial Render | 2,500ms | 800ms | -68% |
| Node Selection | 150ms | 30ms | -80% |
| Config Panel | 200ms | 50ms | -75% |

### Maintainability
| Metric | Before | Target | Change |
|--------|--------|--------|--------|
| Files >500 lines | 8 | 0 | -100% |
| Cyclomatic Complexity | 12 | 6 | -50% |
| ESLint Warnings | 47 | 0 | -100% |

---

## ⚠️ RISK MANAGEMENT

### High Risk
**Risk**: Breaking changes to UnifiedFlowEditor could break existing workflows  
**Likelihood**: Medium | **Impact**: High  
**Mitigation**: 
- Feature flags for gradual rollout
- Parallel implementation (new code alongside old)
- Extensive E2E testing before cutover
- Quick rollback plan with git tags

**Risk**: State migration to Context could cause data loss  
**Likelihood**: Low | **Impact**: High  
**Mitigation**:
- Preserve localStorage schema completely
- Add migration layer for old state format
- Test with production data snapshots

### Medium Risk
**Risk**: Memoization could introduce bugs if dependencies incorrect  
**Likelihood**: Medium | **Impact**: Medium  
**Mitigation**:
- Performance benchmarks before/after each change
- Thorough testing of all memoized components
- ESLint rules to catch dependency issues

**Risk**: Merge conflicts during 10-day refactor  
**Likelihood**: High | **Impact**: Low  
**Mitigation**:
- Daily syncs with development branch
- Small, focused PRs instead of one massive PR
- Coordinate with team to freeze FlowEditor features

### Low Risk
**Risk**: Visual regressions from styled component consolidation  
**Likelihood**: Low | **Impact**: Low  
**Mitigation**: Screenshot baseline tests before refactor

---

## 🚀 EXECUTION STRATEGY

### Prerequisites
- [ ] Create feature branch: `refactor/floweditor-consolidation`
- [ ] Set up visual regression testing (screenshot baseline)
- [ ] Document current behavior (video walkthrough + screenshots)
- [ ] Coordinate with team (freeze new FlowEditor features during refactor)
- [ ] Create rollback plan (feature flag + git tags)

### Daily Execution Plan
- **Day 1**: Foundation - shared components and hooks
- **Day 2**: Foundation - testing and documentation
- **Day 3**: UnifiedFlowEditor split - extract mode components
- **Day 4**: UnifiedFlowEditor split - migrate state to context
- **Day 5**: ConfigPanels - create base and merge panels (part 1)
- **Day 6**: ConfigPanels - finish merges and extract sections
- **Day 7**: Nodes - split BaseNode and memoize
- **Day 8**: Performance - memoization and virtualization
- **Day 9**: Organization - restructure and rename
- **Day 10**: Testing - E2E tests and documentation

### Post-Refactor Validation
- [ ] All unit tests passing (>80% coverage)
- [ ] All integration tests passing
- [ ] E2E tests for critical workflows passing
- [ ] Performance benchmarks improved
- [ ] Visual regression tests passing (0 diffs)
- [ ] No new ESLint/TypeScript errors
- [ ] Documentation updated (architecture guide, component guide)
- [ ] Migration guide written for team
- [ ] Rollback procedure tested

---

## 📚 DOCUMENTATION UPDATES

### Required Documentation
1. **Architecture Guide**: New folder structure and design patterns
2. **Component Guide**: How to use ConfigPanelBase, BaseNode, shared components
3. **Hook Guide**: When and how to use custom hooks
4. **Performance Guide**: Memoization patterns and best practices
5. **Migration Guide**: How to update code using old patterns
6. **Testing Guide**: How to test FlowEditor components

---

## 🎯 DEFINITION OF DONE

### Phase Complete When:
1. ✅ All code changes committed and pushed
2. ✅ Unit tests written and passing (>80% coverage for changed files)
3. ✅ Integration tests passing
4. ✅ Performance benchmarks show improvement (or no regression)
5. ✅ Visual regression tests passing (0 pixel diffs)
6. ✅ Code reviewed by 2+ team members
7. ✅ Documentation updated
8. ✅ No new ESLint/TypeScript errors introduced

### Entire Refactor Complete When:
1. ✅ All 6 phases (E.1-E.6) complete
2. ✅ All success metrics achieved
3. ✅ E2E tests passing for all critical workflows
4. ✅ Production deployment successful
5. ✅ No P0/P1 bugs for 1 week post-deployment
6. ✅ Team trained on new patterns and architecture
7. ✅ Monitoring shows stable or improved performance
8. ✅ Code review feedback addressed

---

## 🔗 INTEGRATION WITH OTHER PHASES

**Phase E integrates with:**
- **Phase C** (Cascading Field System): Can run in parallel - minimal overlap
- **Phase D** (Dynamic Config Engine): Should wait until E completes - will benefit from refactored foundation

**Phase E depends on:**
- **Phase B**: ✅ Complete (PR #2928 merged)
- **Phase A**: ✅ Complete (entity loading fixed)

**Phase E enables:**
- Easier addition of new node types (clean base pattern)
- Advanced features like variable propagation (clean architecture)
- Performance monitoring (instrumentation points added)
- Third-party integrations (clear extension points)

---

## 📞 STAKEHOLDER COMMUNICATION

### Team Coordination
- **Daily standup updates**: Share progress and blockers
- **Mid-phase demos** (Days 2, 4, 6, 8, 10): Show incremental progress
- **Slack notifications**: Alert team when phases complete
- **Code freeze requests**: Request feature freeze 2 days before starting each phase

### User Communication
- **No user-facing changes**: Refactor is internal, users see no difference
- **Performance improvements**: Users will experience faster editor (communicate after Phase E.5)
- **Bug fix opportunities**: Address long-standing editor issues during refactor

---

**Plan Status**: ✅ APPROVED - Ready for Execution  
**Next Step**: Create feature branch and begin Phase E.1  
**Estimated Start Date**: After Phase C.3 completion (or immediate if parallel execution approved)  
**Estimated Completion Date**: 10 business days after start

---

*This plan is a living document. Updates will be made as phases complete and new insights emerge.*
