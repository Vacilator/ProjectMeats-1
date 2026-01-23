from django.shortcuts import render
from django.views.generic import TemplateView
from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.conf import settings


class IsGlobalSystemAdminMixin(UserPassesTestMixin):
    """
    Mixin to verify user is a Global System Admin.
    Global System Admins are members of the 'Global System Admins' group.
    """
    def test_func(self):
        return self.request.user.groups.filter(name='Global System Admins').exists()


class StudioView(LoginRequiredMixin, IsGlobalSystemAdminMixin, TemplateView):
    """
    Blueprint Studio host view.
    
    This view serves as the bridge between Django and the React-based
    Blueprint Studio. It provides a clean HTML shell that loads the
    React application without inheriting Django admin CSS conflicts.
    
    Permissions:
    - User must be authenticated
    - User must be a member of 'Global System Admins' group
    
    Context:
    - blueprint_id: UUID of the blueprint being edited
    - csrf_token: CSRF token for API requests
    - debug: Debug mode flag for dev/prod asset loading
    """
    template_name = 'admin/studio_host.html'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['blueprint_id'] = kwargs.get('blueprint_id')
        context['debug'] = settings.DEBUG
        return context

